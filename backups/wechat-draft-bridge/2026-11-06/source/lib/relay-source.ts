// This source contains no credentials. The operator supplies RELAY_KEY at runtime.
export const relaySource = String.raw`import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";

const secret = process.env.RELAY_KEY;
if (!secret || secret.length < 32) throw new Error("RELAY_KEY must contain at least 32 characters");
const expected = createHash("sha256").update("Bearer " + secret).digest();
const routes = new Map([
  ["/cgi-bin/stable_token", "POST"],
  ["/cgi-bin/draft/count", "GET"],
  ["/cgi-bin/draft/batchget", "POST"],
  ["/cgi-bin/draft/get", "POST"],
  ["/cgi-bin/draft/add", "POST"],
  ["/cgi-bin/draft/update", "POST"],
  ["/cgi-bin/material/add_material?type=image", "POST"],
  ["/cgi-bin/media/uploadimg", "POST"],
]);
function reply(res, code, value) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}
const server = http.createServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") return reply(res, 200, { ok: true });
  if (req.url !== "/wechat") return reply(res, 404, { error: "Not found" });
  const actual = createHash("sha256").update(String(req.headers.authorization || "")).digest();
  if (!timingSafeEqual(actual, expected)) return reply(res, 401, { error: "Unauthorized" });
  const path = String(req.headers["x-wechat-path"] || "");
  if (!routes.has(path) || routes.get(path) !== req.method) return reply(res, 403, { error: "Endpoint not allowed" });
  const target = new URL(path, "https://api.weixin.qq.com");
  const token = String(req.headers["x-wechat-token"] || "");
  if (path !== "/cgi-bin/stable_token" && !token) return reply(res, 400, { error: "Missing access token" });
  if (token) target.searchParams.set("access_token", token);
  const headers = {};
  if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"];
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 11 * 1024 * 1024) return reply(res, 413, { error: "Payload too large" });
      chunks.push(chunk);
    }
    const upstream = await fetch(target, {
      method: req.method, headers,
      body: req.method === "GET" ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    const body = await upstream.text();
    if (body.length > 4 * 1024 * 1024) return reply(res, 502, { error: "Upstream response too large" });
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    // Do not log request bodies, credentials, access tokens, or query strings.
    reply(res, 502, { error: "WeChat upstream response unavailable; check draft state before retrying writes" });
  }
});
server.requestTimeout = 35000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8787), "0.0.0.0", () => console.log("WeChat draft relay ready"));
`;
export const dockerSource = `FROM node:22-alpine\nWORKDIR /app\nCOPY relay.mjs ./relay.mjs\nUSER node\nENV PORT=8787\nEXPOSE 8787\nCMD ["node", "relay.mjs"]\n`;
