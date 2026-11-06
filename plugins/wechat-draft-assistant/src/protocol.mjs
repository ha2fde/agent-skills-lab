import { tools, callTool, instructions } from './tools.mjs';
import { object, safeError } from './validation.mjs';

export const MAX_REQUEST_BYTES = 512 * 1024;
export const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const serverInfo = { name: 'wechat-draft-assistant', title: '公众号草稿助手', version: '1.0.0' };
export const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
export async function handleMessage(message, service) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
    ('id' in message && (message.id === null || !['string', 'number'].includes(typeof message.id) || (typeof message.id === 'number' && !Number.isFinite(message.id))))) {
    return rpcError(null, -32600, 'Invalid JSON-RPC request');
  }
  if (!('id' in message)) return null; // Notifications never execute tools.
  const { id, method } = message, result = value => ({ jsonrpc: '2.0', id, result: value });
  if (message.params !== undefined && (!message.params || typeof message.params !== 'object' || Array.isArray(message.params))) return rpcError(id, -32602, 'Invalid params');
  if (method === 'initialize') {
    const requested = message.params?.protocolVersion;
    return result({ protocolVersion: versions.includes(requested) ? requested : versions[0], capabilities: { tools: {} }, serverInfo, instructions });
  }
  if (method === 'ping') return result({});
  if (method === 'tools/list') return result({ tools });
  if (method !== 'tools/call') return rpcError(id, -32601, 'Method not found');
  try {
    const params = object(message.params);
    const data = await callTool(service, params.name, params.arguments);
    return result({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: false });
  } catch (error) {
    return result({ content: [{ type: 'text', text: safeError(error) }], isError: true });
  }
}
export async function parseMessage(bytes, service) {
  let message;
  try { message = JSON.parse(bytes.toString('utf8')); }
  catch { return rpcError(null, -32700, 'Invalid JSON'); }
  return handleMessage(message, service);
}
export async function serveStdio(input, output, service) {
  let pending = Buffer.alloc(0), oversized = false;
  const send = message => { if (message) output.write(JSON.stringify(message) + '\n'); };
  for await (const inputChunk of input) {
    const chunk = Buffer.isBuffer(inputChunk) ? inputChunk : Buffer.from(inputChunk);
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset), end = newline < 0 ? chunk.length : newline;
      if (!oversized && pending.length + end - offset > MAX_REQUEST_BYTES) { pending = Buffer.alloc(0); oversized = true; }
      if (!oversized) pending = Buffer.concat([pending, chunk.subarray(offset, end)]);
      if (newline < 0) break;
      if (oversized) send(rpcError(null, -32600, 'Request exceeds 512 KiB'));
      else if (pending.length && pending.toString('utf8').trim()) send(await parseMessage(pending, service));
      pending = Buffer.alloc(0); oversized = false; offset = end + 1;
    }
  }
  if (pending.length || oversized) send(rpcError(null, -32700, 'Incomplete JSON-RPC line'));
}
