import test from 'node:test';
import assert from 'node:assert/strict';
import { State } from '../src/state.mjs';
import { WeChat } from '../src/wechat.mjs';
import { callTool, tools } from '../src/tools.mjs';
import { safeError, validateArticle } from '../src/validation.mjs';
import { article, fixture, png } from './helpers.mjs';

test('eight tools: status, live count, list/get, upload cover/body, image index, create/update', async t => {
  const { service, calls } = fixture(t);
  assert.equal(tools.length, 8);
  assert.equal(tools.some(t => /publish|delete|freepublish|mass/.test(t.name)), false);
  assert.equal((await callTool(service, 'wechat_connection_status', {})).verified, false);
  assert.equal(calls.length, 0);
  assert.equal((await callTool(service, 'wechat_check_connection', {})).draft_count, 0);
  const input = { filename: 'tiny.png', image_base64: png.toString('base64') };
  const cover = await callTool(service, 'wechat_upload_image', { ...input, purpose: 'cover' });
  const body = await callTool(service, 'wechat_upload_image', { ...input, purpose: 'body' });
  assert.equal(cover.media_id, 'mock-uploaded-cover');
  assert.match(body.url, /^https:\/\/mmbiz\.qpic\.cn/);
  assert.equal((await callTool(service, 'wechat_list_images', {})).images.length, 2);
  const created = await callTool(service, 'wechat_create_draft', { request_id: 'create-test-0001', articles: [article] });
  assert.equal(created.created, true); assert.equal(created.readback_verified, true);
  assert.equal((await callTool(service, 'wechat_list_drafts', {})).total_count, 1);
  const read = await callTool(service, 'wechat_get_draft', { media_id: created.media_id });
  const updated = await callTool(service, 'wechat_update_draft', { request_id: 'update-test-0001', media_id: created.media_id, index: 0,
    expected_content_hash: read.articles[0].content_hash, article: { ...article, title: '更新标题' } });
  assert.equal(updated.updated, true); assert.equal(updated.draft.articles[0].title, '更新标题');
  assert.equal(calls.filter(c => c.path === '/cgi-bin/stable_token').length, 1);
  for (const call of calls) { assert.equal(call.url.origin, 'https://api.weixin.qq.com'); assert.equal(call.options.redirect, 'manual'); }
});

test('completed create is replayed after restart; a changed payload is rejected', async t => {
  const f = fixture(t), args = { request_id: 'durable-create-0001', articles: [article] };
  const result = await f.service.createDraft(args);
  f.close();
  const state = new State(f.directory, 'wx0000000000000000');
  const service = new WeChat({ appId: 'wx0000000000000000', appSecret: 'mock-app-secret-not-real', state, fetcher() { throw new Error('must not call upstream'); } });
  try {
    assert.deepEqual(await service.createDraft(args), result);
    await assert.rejects(service.createDraft({ ...args, articles: [{ ...article, title: 'changed' }] }), /不同内容/);
  } finally { state.close(); }
});

test('concurrent duplicate requests perform only one write', async t => {
  const { service, calls } = fixture(t), args = { request_id: 'concurrent-0001', articles: [article] };
  const results = await Promise.allSettled([service.createDraft(args), service.createDraft(args)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(calls.filter(c => c.path === '/cgi-bin/draft/add').length, 1);
});

test('lost write response remains unknown across restarts and is never resent', async t => {
  const f = fixture(t), args = { request_id: 'unknown-write-0001', articles: [article] };
  f.controls.failWrite = true;
  await assert.rejects(f.service.createDraft(args), /结果可能未知/);
  assert.equal(f.drafts.size, 1);
  await assert.rejects(f.service.createDraft(args), /不会再次写入/);
  f.close();
  const state = new State(f.directory, 'wx0000000000000000');
  try { await assert.rejects(state.once('create_draft', args.request_id, args.articles.map(validateArticle), async () => assert.fail('must not run')), /不会再次写入/); }
  finally { state.close(); }
  assert.equal(f.calls.filter(c => c.path === '/cgi-bin/draft/add').length, 1);
});

test('readback failure preserves confirmed success and media ID', async t => {
  const { service, controls, calls } = fixture(t);
  controls.failRead = true;
  const args = { request_id: 'readback-fail-0001', articles: [article] };
  const result = await service.createDraft(args);
  assert.equal(result.created, true); assert.equal(result.readback_verified, false); assert.ok(result.media_id);
  assert.deepEqual(await service.createDraft(args), result);
  assert.equal(calls.filter(c => c.path === '/cgi-bin/draft/add').length, 1);
});

test('stale update is blocked; completed updates can be replayed safely', async t => {
  const { service, calls } = fixture(t);
  const args = { request_id: 'stale-update-0001', media_id: 'mock-existing', index: 0, expected_content_hash: '0'.repeat(64), article };
  await assert.rejects(service.updateDraft(args), /草稿已变化/);
  assert.equal(calls.some(c => c.path === '/cgi-bin/draft/update'), false);
  const read = await service.getDraft({ media_id: args.media_id });
  const valid = { ...args, request_id: 'valid-update-0001', expected_content_hash: read.articles[0].content_hash, article: { ...article, title: 'changed' } };
  const result = await service.updateDraft(valid);
  assert.deepEqual(await service.updateDraft(valid), result);
  assert.equal(calls.filter(c => c.path === '/cgi-bin/draft/update').length, 1);
});

test('explicit WeChat rejection is safe, not a fabricated success or secret leak', async t => {
  const { service, controls } = fixture(t);
  controls.rejectWrite = true;
  const args = { request_id: 'reject-write-0001', articles: [article] };
  await assert.rejects(service.createDraft(args), error => {
    assert.match(safeError(error), /48001/); assert.doesNotMatch(safeError(error), /mock-app-secret/); return true;
  });
  await assert.rejects(service.createDraft(args), /上次请求被拒绝/);
});

test('redirect is refused before credentials can reach another host', async t => {
  const { service, controls, calls } = fixture(t);
  controls.redirect = true;
  await assert.rejects(service.checkConnection(), /未返回有效响应/);
  assert.equal(calls.length, 1); assert.equal(calls[0].options.redirect, 'manual');
});

test('accounts have independent receipt namespaces and image indexes', async t => {
  const f = fixture(t);
  await f.service.createDraft({ request_id: 'account-scope-0001', articles: [article] });
  const other = new State(f.directory, 'wx1111111111111111');
  try { assert.deepEqual(other.listImages(), []); assert.deepEqual(await other.once('test', 'account-scope-0001', {}, async () => ({ ok: true })), { ok: true }); }
  finally { other.close(); }
});

test('invalid arguments and active HTML never reach WeChat', async t => {
  const { service, calls } = fixture(t);
  await assert.rejects(callTool(service, 'wechat_list_drafts', { count: 99 }), /数量/);
  await assert.rejects(callTool(service, 'wechat_connection_status', { secret: 'x' }), /不支持/);
  await assert.rejects(callTool(service, 'wechat_connection_status', null), /参数必须/);
  for (const content of ['<script>alert(1)</script>', '<p onclick="x()">bad</p>', '<img src="https://example.org/x.png">', '<img src=https://mmbiz.qpic.cn/x>']) {
    await assert.rejects(service.createDraft({ request_id: 'unsafe-html-0001', articles: [{ ...article, content }] }));
  }
  assert.equal(calls.length, 0);
});
