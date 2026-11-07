import { tools, callTool, instructions } from "@/lib/mcp-tools";
import { safeError } from "@/lib/errors";
import { object } from "@/lib/wechat-validation";
export const dynamic = "force-dynamic";
const versions = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];
const MAX_REQUEST_BYTES = 512 * 1024;
const serverInfo = { name: "wechat-draft-assistant", title: "公众号草稿助手", version: "1.2.0" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function readMessage(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) throw new RangeError("oversize");
  if (!request.body) throw new SyntaxError("empty");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) throw new RangeError("oversize");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return object(JSON.parse(new TextDecoder().decode(bytes)));
}
export async function POST(request: Request) {
  let message: Record<string, unknown>;
  try {
    message = await readMessage(request);
  } catch (error) {
    const oversized = error instanceof RangeError;
    return json({ jsonrpc: "2.0", id: null, error: { code: oversized ? -32600 : -32700, message: oversized ? "请求超过 512 KiB；图片请使用 image_url 或压缩到 128 KiB 内。" : "Invalid JSON-RPC request" } }, oversized ? 413 : 400);
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string" ||
      (message.id !== undefined && message.id !== null && typeof message.id !== "string" && typeof message.id !== "number")) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request" } }, 400);
  }
  const id = message.id ?? null, method = String(message.method ?? "");
  if (!("id" in message)) return new Response(null, { status: 202 });
  const result = (value: unknown) => json({ jsonrpc: "2.0", id, result: value });
  if (method === "server/discover") return result({ supportedVersions: versions, capabilities: { tools: {} }, serverInfo, instructions });
  if (method === "initialize") {
    const params = message.params && typeof message.params === "object" ? message.params as Record<string, unknown> : {};
    const v = String(params.protocolVersion ?? versions[0]);
    return result({ protocolVersion: versions.includes(v) ? v : versions[0], capabilities: { tools: {} }, serverInfo, instructions });
  }
  if (method === "ping") return result({});
  if (method === "tools/list") return result({ tools });
  if (method !== "tools/call") return json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return result({ content: [{ type: "text", text: "请使用拥有访问权限的 ChatGPT 账号连接此私有插件。" }], isError: true });
  const started = Date.now();
  let toolName = "invalid";
  try {
    const params = object(message.params), args = params.arguments === undefined ? {} : object(params.arguments);
    const requestedName = String(params.name);
    toolName = tools.some(tool => tool.name === requestedName) ? requestedName : "unknown";
    const data = await callTool(requestedName, userId, args);
    console.info("wechat_mcp", JSON.stringify({ tool: toolName, outcome: "ok", duration_ms: Date.now() - started }));
    return result({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false });
  } catch (error) {
    const message = safeError(error);
    // No credentials, signed image URLs, article bodies or binary arguments.
    console.warn("wechat_mcp", JSON.stringify({ tool: toolName, outcome: "tool_error", duration_ms: Date.now() - started }));
    return result({ content: [{ type: "text", text: message }], isError: true });
  }
}
export async function GET() { return new Response("Use POST /mcp", { status: 405, headers: { Allow: "POST" } }); }
