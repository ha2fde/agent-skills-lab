import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// In-memory records plus a mocked WeChat transport; no live credentials or network.
const records = new Map();
function table(name, columns) {
  const t = { tableName: name };
  for (const name of columns) t[name] = { table: t, name };
  records.set(t, []); return t;
}
const connections = table("connections", ["userId", "appId", "label", "secretCipher", "relayUrl", "relayKeyCipher", "tokenCipher", "tokenExpires", "verifiedAt", "lastError", "updatedAt"]);
const receipts = table("receipts", ["id", "userId", "appId", "kind", "payloadHash", "state", "result", "createdAt"]);
const images = table("images", ["id", "userId", "appId", "name", "purpose", "mediaId", "url", "createdAt"]);
const eq = (column, value) => row => row[column.name] === value;
const and = (...fns) => row => fns.every(fn => fn(row));
const db = {
  select() { return { from(t) { const b = { filter: () => true, where(fn) { b.filter = fn; return b; }, async get() { return records.get(t).find(b.filter); }, orderBy() { return b; }, async limit(n) { return records.get(t).filter(b.filter).slice(0, n); } }; return b; } }; },
  insert(t) { return { values(value) {
    const pk = t === connections ? "userId" : "id";
    const insert = () => { if (records.get(t).some(r => r[pk] === value[pk])) return []; records.get(t).push({ ...value }); return [{ id: value.id }]; };
    return {
      async onConflictDoUpdate({ set }) { const old = records.get(t).find(r => r[pk] === value[pk]); if (old) Object.assign(old, set); else insert(); },
      onConflictDoNothing() { return { async returning() { return insert(); } }; },
      then(fulfilled, rejected) { try { return Promise.resolve(insert()).then(fulfilled, rejected); } catch(e) { return Promise.reject(e).then(fulfilled, rejected); } },
    };
  } }; },
  update(t) { return { set(values) { return { async where(fn) { for (const row of records.get(t)) if (fn(row)) Object.assign(row, values); } }; } }; },
};
const originalFetch = globalThis.fetch;
const upstream = new Map();
const calls = [];
let failure = "";
globalThis.fetch = async (url, options) => {
  assert.equal(options.redirect, "manual", "Worker requests must use a supported mode and never forward credentials across redirects");
  const path = new URL(url).pathname;
  calls.push(path);
  if (failure === "redirect") return new Response(null, { status: 302, headers: { Location: "https://untrusted.example/" } });
  if (new URL(url).hostname === "sdmntprtest.oaiusercontent.com") {
    assert.equal(options.headers, undefined, "image downloads must not carry account credentials");
    const bytes = new Uint8Array(failure === "image-overflow" ? 1024 * 1024 + 1 : 200 * 1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    return new Response(bytes);
  }
  const body = options.body && !(options.body instanceof FormData) ? JSON.parse(options.body) : {};
  if (path === "/cgi-bin/stable_token") return Response.json({ access_token: "mock-access-token-not-real", expires_in: 7200 });
  if (path === "/cgi-bin/draft/count") return Response.json({ total_count: upstream.size });
  if (path === "/cgi-bin/draft/add") {
    if (failure === "wechat-reject") return Response.json({ errcode: 48001, errmsg: "api unauthorized" });
    const mediaId = "draft-" + upstream.size;
    upstream.set(mediaId, body.articles);
    if (failure === "lost-create-response") throw new Error("simulated network loss");
    return Response.json({ media_id: mediaId });
  }
  if (path === "/cgi-bin/draft/get") {
    if (failure === "readback") throw new Error("simulated failed read");
    return Response.json({ news_item: upstream.get(body.media_id) || [] });
  }
  if (path === "/cgi-bin/draft/update") { upstream.get(body.media_id)[body.index] = body.articles; return Response.json({ errcode: 0 }); }
  if (path === "/cgi-bin/media/uploadimg") return Response.json({ url: "https://mmbiz.qpic.cn/mock/body.png" });
  if (path === "/cgi-bin/material/add_material") return Response.json({ media_id: "mock-cover-upload", url: "https://mmbiz.qpic.cn/mock/cover.png" });
  throw new Error("Unexpected transport path: " + path);
};

const cached = new Map();
const loading = new Map();
function synthetic(id, values) { const m = new SyntheticModule(Object.keys(values), function() { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { identifier: id }); cached.set(id, m); return m; }
synthetic("cloudflare:workers", { env: { WECHAT_CONFIG_ENCRYPTION_KEY: btoa("0".repeat(32)) } });
synthetic("drizzle-orm", { eq, and, desc: v => v });
synthetic("@/db", { getDb: () => db });
synthetic("@/db/schema", { connections, receipts, images });
async function moduleFor(specifier, parent = resolve("scripts/test-wechat.mjs")) {
  if (cached.has(specifier)) return cached.get(specifier);
  let file = specifier.startsWith("@/") ? resolve(specifier.slice(2)) : resolve(dirname(parent), specifier);
  if (!file.endsWith(".ts")) file += ".ts";
  if (cached.has(file)) return cached.get(file);
  if (!loading.has(file)) loading.set(file, (async () => {
    const source = ts.transpileModule(await readFile(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const m = new SourceTextModule(source, { identifier: file }); cached.set(file, m); return m;
  })());
  return loading.get(file);
}
const root = await moduleFor("@/lib/mcp-tools");
await root.link((specifier, parent) => moduleFor(specifier, parent.identifier));
await root.evaluate();
const core = cached.get(resolve("lib/wechat.ts")).namespace;
const validation = cached.get(resolve("lib/wechat-validation.ts")).namespace;
const errors = cached.get(resolve("lib/errors.ts")).namespace;
const imageCore = cached.get(resolve("lib/wechat-image.ts")).namespace;
const route = await moduleFor("@/app/mcp/route");
await route.link((specifier, parent) => moduleFor(specifier, parent.identifier));
await route.evaluate();
const article = { title: "测试标题", content: '<p style="font-size:16px;line-height:1.8">测试正文</p>', thumb_media_id: "mock-cover" };
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log("PASS", name); }
try {
  await test("unconfigured status is truthful and makes no WeChat request", async () => {
    assert.equal((await core.connectionStatus("alice")).configured, false);
    await assert.rejects(() => core.createDraft("alice", { request_id: "before-config", articles: [article] }), /配置/);
    assert.equal(calls.length, 0);
  });
  await test("credentials are encrypted and separated by user", async () => {
    await core.saveConnection("alice", { app_id: "wx1234567890abcdef", app_secret: "mock-app-secret-not-real", label: "测试号" });
    const row = records.get(connections)[0];
    assert.ok(!row.secretCipher.includes("mock-app-secret"));
    assert.equal((await core.connectionStatus("bob")).configured, false);
    const status = JSON.stringify(await core.connectionStatus("alice"));
    assert.ok(!status.includes("mock-app-secret")); assert.ok(!status.includes(row.secretCipher));
  });
  await test("live check validates reading and keeps token private", async () => {
    const result = await core.checkConnection("alice"); assert.equal(result.verified, true); assert.equal(result.draft_count, 0);
    assert.ok(!JSON.stringify(result).includes("mock-access-token"));
  });
  await test("draft creation is read back and retry does not create a duplicate", async () => {
    const args = { request_id: "create-success-001", articles: [article] };
    const result = await core.createDraft("alice", args); assert.equal(result.created, true); assert.equal(result.readback_verified, true);
    const replay = await core.createDraft("alice", args); assert.deepEqual(replay, result);
    assert.equal(calls.filter(p => p === "/cgi-bin/draft/add").length, 1);
    await assert.rejects(() => core.createDraft("alice", { ...args, articles: [{ ...article, title: "不同内容" }] }), /不同内容/);
  });
  await test("updates require the previously read fingerprint and are retryable", async () => {
    const draft = await core.getDraft("alice", { media_id: "draft-0" });
    const args = { request_id: "update-success-001", media_id: "draft-0", index: 0, expected_content_hash: draft.articles[0].content_hash, article: { ...article, title: "修改后的标题" } };
    assert.equal((await core.updateDraft("alice", args)).updated, true);
    assert.equal((await core.updateDraft("alice", args)).updated, true);
    assert.equal(calls.filter(p => p === "/cgi-bin/draft/update").length, 1);
    await assert.rejects(() => core.updateDraft("alice", { ...args, request_id: "update-stale-001" }), /已变化/);
  });
  await test("success is preserved when readback fails", async () => {
    failure = "readback";
    const result = await core.createDraft("alice", { request_id: "readback-failed-001", articles: [article] });
    assert.equal(result.created, true); assert.equal(result.readback_verified, false); assert.ok(result.media_id);
    failure = "";
  });
  await test("lost upstream response cannot trigger a duplicate write", async () => {
    failure = "lost-create-response";
    const args = { request_id: "network-lost-001", articles: [article] };
    await assert.rejects(() => core.createDraft("alice", args), /结果可能未知/);
    const count = calls.filter(p => p === "/cgi-bin/draft/add").length;
    failure = "";
    await assert.rejects(() => core.createDraft("alice", args), /结果未知/);
    assert.equal(calls.filter(p => p === "/cgi-bin/draft/add").length, count);
  });
  await test("WeChat permission failure is explicit", async () => {
    failure = "wechat-reject";
    await assert.rejects(() => core.createDraft("alice", { request_id: "permission-failed-001", articles: [article] }), /48001/);
    failure = "";
  });
  await test("read-only failures do not claim an ambiguous draft write", async () => {
    failure = "redirect";
    await assert.rejects(() => core.checkConnection("alice"), error => error.message.includes("HTTP 302") && !error.message.includes("结果可能未知"));
    failure = "";
  });
  await test("unsafe HTML, unuploaded images and private relay addresses are rejected", async () => {
    assert.throws(() => validation.validateArticle({ ...article, content: "<script>alert(1)</script>" }), /静态 HTML/);
    assert.throws(() => validation.validateArticle({ ...article, content: '<img src="https://external.example/pic.png">' }), /微信/);
    for (const url of ["http://relay.example.com/wechat", "https://127.0.0.1/wechat", "https://localhost/wechat", "https://user:pass@relay.example.com/wechat"]) assert.throws(() => validation.validateRelayUrl(url));
    assert.throws(() => validation.imageType(new TextEncoder().encode("not an image")), /JPEG/);
  });
  await test("internal database failures never disclose SQL or credentials", async () => {
    assert.ok(!errors.safeError(new Error("Failed query: secret_cipher=abc")).includes("secret_cipher"));
  });
  await test("large Base64 arguments are rejected before decoding and without WeChat side effects", async () => {
    const before = calls.length;
    await assert.rejects(() => core.uploadImageTool("alice", { filename: "large.png", purpose: "cover", image_base64: "A".repeat(3496032) }), /128 KiB/);
    assert.equal(calls.length, before);
    const bytes = new Uint8Array(128 * 1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    assert.deepEqual(imageCore.decodeInlineImage(Buffer.from(bytes).toString("base64")), bytes);
  });
  await test("short signed image URLs upload images without binary tool arguments or credential forwarding", async () => {
    const result = await core.uploadImageTool("alice", { filename: "body.png", purpose: "body", image_url: "https://sdmntprtest.oaiusercontent.com/body.png?sig=mock" });
    assert.equal(result.purpose, "body");
    assert.equal(result.url, "https://mmbiz.qpic.cn/mock/body.png");
    for (const url of ["http://sdmntprtest.oaiusercontent.com/x", "https://127.0.0.1/x", "https://sdmntprtest.oaiusercontent.com.evil.example/x", "https://user:pass@sdmntprtest.oaiusercontent.com/x"]) assert.throws(() => imageCore.imageSourceUrl(url));
    await assert.rejects(() => imageCore.imageFromArgs({ purpose: "body", image_base64: "abc", image_url: "https://sdmntprtest.oaiusercontent.com/x" }), /请选择一个/);
  });
  await test("remote images enforce streaming size limits and refuse redirects", async () => {
    const args = { purpose: "body", image_url: "https://sdmntprtest.oaiusercontent.com/large.png" };
    failure = "image-overflow";
    await assert.rejects(() => imageCore.imageFromArgs(args), /大小限制/);
    failure = "redirect";
    await assert.rejects(() => imageCore.imageFromArgs(args), /HTTP 302/);
    failure = "";
  });
  await test("MCP tool failures preserve JSON-RPC framing and allow subsequent calls", async () => {
    const rpc = async (id, method, params) => route.namespace.POST(new Request("https://mock.test/mcp", { method: "POST", headers: { "oai-authenticated-user-id": "alice" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }));
    const reply = await (await rpc("bad-image", "tools/call", { name: "wechat_upload_image", arguments: { filename: "bad.png", purpose: "body", image_base64: "not base64" } })).json();
    assert.equal(reply.id, "bad-image"); assert.equal(reply.result.isError, true); assert.equal(reply.error, undefined);
    assert.match(reply.result.content[0].text, /Base64 无效/);
    const next = await (await rpc("after-error", "tools/call", { name: "wechat_list_images", arguments: {} })).json();
    assert.equal(next.id, "after-error"); assert.equal(next.result.isError, false);
    const status = await (await rpc(1, "initialize", { protocolVersion: "2026-07-28" })).json();
    assert.equal(status.result.serverInfo.version, "1.0.1");
  });
  await test("oversized streamed MCP requests return a bounded JSON-RPC error", async () => {
    const response = await route.namespace.POST(new Request("https://mock.test/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { data: "A".repeat(512 * 1024) } }) }));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, -32600);
    const invalid = await route.namespace.POST(new Request("https://mock.test/mcp", { method: "POST", body: '{"id":{},"jsonrpc":"2.0","method":"ping"}' }));
    assert.equal((await invalid.json()).error.code, -32600);
  });
  await test("MCP exposes eight focused tools with no public publish/delete endpoint", async () => {
    const tools = root.namespace.tools;
    assert.equal(tools.length, 8); assert.equal(new Set(tools.map(t => t.name)).size, 8);
    assert.ok(!tools.some(t => /publish|delete|send/.test(t.name)));
    for (const t of tools) assert.equal(t.inputSchema.type, "object");
  });
  console.log(passed + " behavior checks passed; live account integration remains a separate check.");
} finally { globalThis.fetch = originalFetch; }
