import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { MAX_REQUEST_BYTES, parseMessage, rpcError, versions } from './protocol.mjs';

const digest = value => createHash('sha256').update(value).digest();
const json = (res, status, data, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(data === null ? undefined : JSON.stringify(data));
};
function readRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let length = 0;
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted); };
    const data = chunk => {
      length += chunk.length;
      if (length > MAX_REQUEST_BYTES) { cleanup(); req.resume(); reject(new RangeError('oversize')); }
      else chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks, length)); };
    const error = () => { cleanup(); reject(new Error('request interrupted')); };
    const aborted = () => error();
    req.on('data', data); req.once('end', end); req.once('error', error); req.once('aborted', aborted);
  });
}
export function createHttpServer(service, { token, allowedHosts, allowedOrigins = [] }) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 512) throw new Error('HTTP mode requires a random MCP_BEARER_TOKEN of 32–512 characters.');
  if (!Array.isArray(allowedHosts) || !allowedHosts.length) throw new Error('HTTP mode requires an explicit allowed Host list.');
  const expected = digest(`Bearer ${token}`), hosts = new Set(allowedHosts.map(h => h.toLowerCase())), origins = new Set(allowedOrigins);
  let running = 0;
  const server = http.createServer({ maxHeaderSize: 16384 }, async (req, res) => {
    try {
      if (!hosts.has(String(req.headers.host ?? '').toLowerCase())) return json(res, 403, { error: 'Host not allowed' });
      if (req.headers.origin && !origins.has(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed' });
      if (req.url === '/health' && req.method === 'GET') return json(res, 200, { ok: true });
      if (req.url !== '/mcp') return json(res, 404, { error: 'Not found' });
      if (!timingSafeEqual(digest(String(req.headers.authorization ?? '')), expected)) return json(res, 401, { error: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer realm="wechat-draft-assistant"' });
      if (req.method !== 'POST') return json(res, 405, { error: 'Use POST /mcp; standalone SSE and HTTP sessions are not used' }, { Allow: 'POST' });
      if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) return json(res, 415, { error: 'Use application/json' });
      const accept = String(req.headers.accept ?? '*/*');
      if (!accept.includes('application/json') && !accept.includes('*/*')) return json(res, 406, { error: 'Accept application/json' });
      if (req.headers['mcp-protocol-version'] && !versions.includes(req.headers['mcp-protocol-version'])) return json(res, 400, { error: 'Unsupported MCP protocol version' });
      if (Number(req.headers['content-length'] ?? 0) > MAX_REQUEST_BYTES) { req.resume(); return json(res, 413, rpcError(null, -32600, 'Request exceeds 512 KiB')); }
      if (running >= 16) return json(res, 503, { error: 'Busy; no tool was executed' });
      running++;
      try {
        let bytes;
        try { bytes = await readRequest(req); }
        catch (error) {
          if (error instanceof RangeError) return json(res, 413, rpcError(null, -32600, 'Request exceeds 512 KiB'));
          throw error;
        }
        const message = await parseMessage(bytes, service);
        return json(res, message === null ? 202 : 200, message);
      } finally { running--; }
    } catch {
      // Never log request bodies, headers, URLs, access tokens or article text.
      if (!res.headersSent) json(res, 500, rpcError(null, -32603, 'Internal error; check draft state before retrying writes'));
      else res.end();
    }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  return server;
}
