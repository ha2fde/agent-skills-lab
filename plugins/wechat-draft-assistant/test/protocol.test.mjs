import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { request } from 'node:http';
import { createHttpServer } from '../src/http.mjs';
import { handleMessage, serveStdio, MAX_REQUEST_BYTES } from '../src/protocol.mjs';
import { article, fixture } from './helpers.mjs';

const token = 'mock-http-bearer-token-only-for-tests-0000000000';
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
async function httpFixture(t) {
  const f = fixture(t);
  const server = createHttpServer(f.service, { token, allowedHosts: ['mcp.test'] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  // Native fetch intentionally normalizes Host. Use node:http to test hostile Host values.
  const post = (message, headers = {}, path = url, chunked = false) => new Promise((resolve, reject) => {
    const body = typeof message === 'string' ? message : JSON.stringify(message);
    const req = request(path, { method: 'POST', headers: { Host: 'mcp.test', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(chunked ? {} : { 'Content-Length': Buffer.byteLength(body) }), ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c)); res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    });
    req.on('error', reject);
    if (chunked) { req.write(body.slice(0, MAX_REQUEST_BYTES)); req.write(body.slice(MAX_REQUEST_BYTES)); req.end(); }
    else req.end(body);
  });
  return { ...f, post, url };
}

test('real stdio process initializes, lists tools and recovers from JSON and tool errors', t => {
  const f = fixture(t);
  const messages = [JSON.stringify(rpc(1, 'initialize', { protocolVersion: '2025-11-25' })), '{broken-json',
    JSON.stringify(rpc(2, 'tools/list')), JSON.stringify(rpc(3, 'tools/call', { name: 'wechat_check_connection', arguments: {} })),
    JSON.stringify(rpc(4, 'tools/call', { name: 'wechat_connection_status', arguments: {} }))].join('\n') + '\n';
  const result = spawnSync(process.execPath, ['src/server.mjs'], { cwd: new URL('..', import.meta.url), input: messages, encoding: 'utf8', env: { PATH: process.env.PATH, WECHAT_DATA_DIR: f.directory }, timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 5); assert.equal(lines[0].result.protocolVersion, '2025-11-25');
  assert.equal(lines[1].error.code, -32700); assert.equal(lines[2].result.tools.length, 8);
  assert.equal(lines[3].result.isError, true); assert.equal(lines[4].result.structuredContent.configured, false);
  assert.doesNotMatch(result.stdout, /mock-app-secret|mock-access-token/);
});

test('oversized stdio frame is rejected and the next valid frame still works', async t => {
  const { service } = fixture(t), output = [];
  const input = Readable.from([Buffer.alloc(MAX_REQUEST_BYTES + 1, 120), Buffer.from('\n' + JSON.stringify(rpc(2, 'ping')) + '\n')]);
  await serveStdio(input, new Writable({ write(chunk, _encoding, callback) { output.push(chunk.toString()); callback(); } }), service);
  const messages = output.join('').trim().split('\n').map(JSON.parse);
  assert.equal(messages[0].error.code, -32600); assert.deepEqual(messages[1], { jsonrpc: '2.0', id: 2, result: {} });
});

test('notifications never perform writes; malformed requests keep valid JSON-RPC envelopes', async t => {
  const { service, calls } = fixture(t);
  assert.equal(await handleMessage({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'wechat_create_draft', arguments: { request_id: 'notification-0001', articles: [article] } } }, service), null);
  assert.equal(calls.length, 0);
  assert.equal((await handleMessage([], service)).error.code, -32600);
  assert.equal((await handleMessage(rpc(null, 'ping'), service)).error.code, -32600);
  assert.equal((await handleMessage(rpc(3, 'unknown'), service)).error.code, -32601);
  assert.equal((await handleMessage(rpc(4, 'tools/list', []), service)).error.code, -32602);
});

test('HTTP refuses missing/wrong bearer, forged platform identity, hostile Host and Origin', async t => {
  const { post, calls } = await httpFixture(t), message = rpc(1, 'tools/list');
  assert.equal((await post(message, { Authorization: '' })).status, 401);
  assert.equal((await post(message, { Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await post(message, { Authorization: '', 'oai-authenticated-user-id': 'pretend-owner' })).status, 401);
  assert.equal((await post(message, { Host: 'evil.example' })).status, 403);
  assert.equal((await post(message, { Origin: 'https://evil.example' })).status, 403);
  assert.equal(calls.length, 0);
});

test('HTTP full workflow uses durable idempotency and preserves later requests after errors', async t => {
  const { post, calls } = await httpFixture(t);
  const initialized = await (await post(rpc(1, 'initialize', { protocolVersion: '2025-11-25' }))).json();
  assert.equal(initialized.result.serverInfo.name, 'wechat-draft-assistant');
  assert.equal((await (await post('{bad')).json()).error.code, -32700);
  const bad = await (await post(rpc(2, 'tools/call', { name: 'not_a_tool' }))).json();
  assert.equal(bad.result.isError, true);
  const message = rpc(3, 'tools/call', { name: 'wechat_create_draft', arguments: { request_id: 'http-create-0001', articles: [article] } });
  const first = await (await post(message)).json(), replay = await (await post({ ...message, id: 4 })).json();
  assert.equal(first.result.structuredContent.readback_verified, true);
  assert.deepEqual(replay.result, first.result);
  assert.equal(calls.filter(c => c.path === '/cgi-bin/draft/add').length, 1);
  const good = await (await post(rpc(5, 'tools/list'))).json();
  assert.equal(good.result.tools.length, 8);
  assert.doesNotMatch(JSON.stringify([first, replay, good, bad]), /mock-app-secret|mock-access-token/);
});

test('HTTP validates MIME/version/size and accepts notifications with 202', async t => {
  const { post, url } = await httpFixture(t);
  assert.equal((await post(rpc(1, 'ping'), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(rpc(1, 'ping'), { 'MCP-Protocol-Version': 'unsupported' })).status, 400);
  assert.equal((await post(rpc(1, 'ping'), { Accept: 'text/event-stream' })).status, 406);
  assert.equal((await post('x'.repeat(MAX_REQUEST_BYTES + 1))).status, 413);
  const streamed = await post('x'.repeat(MAX_REQUEST_BYTES + 1), {}, url, true);
  assert.equal(streamed.status, 413);
  const notification = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(notification.status, 202); assert.equal(await notification.text(), '');
  assert.deepEqual((await (await post(rpc(9, 'ping'))).json()).result, {});
});

test('HTTP mode refuses to start with missing credentials for transport authentication', () => {
  assert.throws(() => createHttpServer({}, { token: '', allowedHosts: ['localhost'] }), /MCP_BEARER_TOKEN/);
  const result = spawnSync(process.execPath, ['src/server.mjs', '--http'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 10000 });
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /Startup failed/);
});
