import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
const fixture = PNG.sync.write({width:32,height:24,data:Buffer.alloc(32*24*4,255)});

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
  update(t) { return { set(values) { const u={filter:()=>true,where(fn) {u.filter=fn;return u;},async returning() {const rows=records.get(t).filter(u.filter);for(const row of rows) Object.assign(row,values);return rows.map(r=>({id:r.id}));},then(fulfilled,rejected) {try {for(const row of records.get(t).filter(u.filter)) Object.assign(row,values);return Promise.resolve().then(fulfilled,rejected);}catch(e){return Promise.reject(e).then(fulfilled,rejected);}}};return u; } }; },
};
const originalFetch = globalThis.fetch;
const upstream = new Map();
let draftSequence = 0;
const calls = [];
let failure = "";
globalThis.fetch = async (url, options) => {
  assert.equal(options.redirect, "manual", "Worker requests must use a supported mode and never forward credentials across redirects");
  if(new URL(url).hostname === "cloudflare-dns.com") return Response.json({Status:0,Answer:[{type:1,data:failure==="private-dns"?"127.0.0.1":"104.18.1.2"}]});
  const path = new URL(url).pathname;
  calls.push(path);
  if (failure === "redirect") return new Response(null, { status: 302, headers: { Location: "https://untrusted.example/" } });
  if (["sdmntprtest.oaiusercontent.com","images.public-site.com"].includes(new URL(url).hostname)) {
    assert.equal(options.headers, undefined, "image downloads must not carry account credentials");
    const bytes = failure === "image-overflow" ? new Uint8Array(10*1024*1024+1) : fixture;
    return new Response(bytes);
  }
  const body = options.body && !(options.body instanceof FormData) ? JSON.parse(options.body) : {};
  if (path === "/cgi-bin/stable_token") return Response.json({ access_token: "mock-access-token-not-real", expires_in: 7200 });
  if (path === "/cgi-bin/draft/batchget" && failure === "lost-create-no-lookup") throw new Error("mock lookup failed");
  if (path === "/cgi-bin/draft/batchget") return Response.json({total_count:upstream.size,item:[...upstream].slice(body.offset,body.offset+body.count).map(([media_id,news_item])=>({media_id,content:{news_item}}))});
  if (path === "/cgi-bin/draft/count") return Response.json({ total_count: upstream.size });
  if (path === "/cgi-bin/draft/add") {
    if (failure === "wechat-reject") return Response.json({ errcode: 48001, errmsg: "api unauthorized" });
    const mediaId = "draft-" + draftSequence++;
    upstream.set(mediaId, body.articles);
    if (["lost-create-response","lost-create-no-lookup"].includes(failure)) throw new Error("simulated network loss");
    return Response.json({ media_id: mediaId });
  }
  if (path === "/cgi-bin/draft/get") {
    if (failure === "readback") throw new Error("simulated failed read");
    if (!upstream.has(body.media_id)) return Response.json({errcode:40007,errmsg:"invalid media id"});
    return Response.json({ news_item: failure === "mismatch" ? [{...upstream.get(body.media_id)[0],title:"wrong"}] : upstream.get(body.media_id) || [] });
  }
  if (path === "/cgi-bin/draft/delete") {
    if(failure === "delete-reject") return Response.json({errcode:48001,errmsg:"api unauthorized"});
    if(failure !== "delete-timeout-present" && failure !== "delete-no-op") upstream.delete(body.media_id);
    if(failure === "delete-timeout" || failure === "delete-timeout-present") throw new Error("simulated delete timeout");
    return Response.json({errcode:0,errmsg:"ok"});
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
  if(specifier.endsWith(".wasm?module")) return synthetic(specifier,{default:await WebAssembly.compile(readFileSync(new URL("../node_modules/"+specifier.replace("?module",""),import.meta.url)))});
  if(!specifier.startsWith("@/") && !specifier.startsWith(".")) return synthetic(specifier,await import(specifier));
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
    assert.equal(status.result.serverInfo.version, "1.2.0");
  });
  await test("oversized streamed MCP requests return a bounded JSON-RPC error", async () => {
    const response = await route.namespace.POST(new Request("https://mock.test/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { data: "A".repeat(512 * 1024) } }) }));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, -32600);
    const invalid = await route.namespace.POST(new Request("https://mock.test/mcp", { method: "POST", body: '{"id":{},"jsonrpc":"2.0","method":"ping"}' }));
    assert.equal((await invalid.json()).error.code, -32600);
  });
  await test("MCP retains nine tools and exposes exactly one guarded destructive tool", async () => {
    const tools = root.namespace.tools;
    assert.equal(tools.length, 10); assert.equal(new Set(tools.map(t => t.name)).size, 10);
    assert.deepEqual(tools.filter(t=>/delete/.test(t.name)).map(t=>t.name),["wechat_delete_test_draft"]);
    assert.ok(!tools.some(t => /publish|send/.test(t.name)));
    assert.deepEqual(tools.at(-1).inputSchema.required,["media_id","request_id"]);
    for (const t of tools) assert.equal(t.inputSchema.type, "object");
  });

  await test("general public HTTPS URLs work and private DNS fails closed",async()=>{
    const result=await core.uploadImageTool("alice",{filename:"public.png",purpose:"cover",image_url:"https://images.public-site.com/pic.png"});
    assert.equal(result.media_id,"mock-cover-upload"); assert.equal(result.processing.format,"jpeg");
    failure="private-dns";
    await assert.rejects(()=>core.uploadImageTool("alice",{filename:"x.png",purpose:"cover",image_url:"https://images.public-site.com/pic.png"}),/公网/);failure="";
  });
  await test("real decoder rejects corrupt input and converts PNG transparency",async()=>{
    const good=await imageCore.prepareImage(fixture,"cover"); assert.equal(good.bytes[0],255); assert.equal(good.metadata.width,32);
    await assert.rejects(()=>imageCore.prepareImage(fixture.slice(0,40),"cover"),/解码失败/);
    const transparent=PNG.sync.write({width:16,height:16,data:Buffer.alloc(16*16*4)});
    assert.equal((await imageCore.prepareImage(transparent,"body")).metadata.format,"jpeg");
    const gif=Buffer.from(await readFile("scripts/fixtures/gif.base64","utf8"),"base64");
    assert.equal((await imageCore.prepareImage(gif,"body")).metadata.source_format,"gif");
  });
  await test("WebP and EXIF-oriented JPEG are decoded without losing orientation",async()=>{
    const webp=Buffer.from(await readFile("scripts/fixtures/webp.base64","utf8"),"base64");
    assert.equal((await imageCore.prepareImage(webp,"body")).metadata.source_format,"webp");
    const exif=Buffer.from(await readFile("scripts/fixtures/exif.base64","utf8"),"base64");
    const converted=await imageCore.prepareImage(exif,"cover");assert.equal(converted.metadata.width,24);assert.equal(converted.metadata.height,32);assert.equal(converted.metadata.orientation_applied,6);
  });
  const fmt=cached.get(resolve("lib/wechat-format.ts")).namespace;
  await test("server formatting strips arbitrary CSS and preserves wrapped code and numbering",async()=>{
    const html=fmt.prepareHtml('<h2>标题</h2><p style="font-size:8px;position:fixed">正文<strong>重点</strong>[1]</p><pre><code>{"url":"https://long.example.com/'+"a".repeat(150)+'"}</code></pre>',"html",[{title:"来源",url:"https://example.com/"}]);
    assert.match(html,/font-size:18px/);assert.match(html,/font-size:23px/);assert.match(html,/white-space:pre-wrap/);assert.match(html,/overflow-wrap:anywhere/);assert.ok(!html.includes("position:fixed"));assert.match(html,/\[1\]/);
    assert.throws(()=>fmt.prepareHtml("<p>[3]</p>","html",[{title:"来源",url:"https://example.com"}]),/编号/);
    assert.throws(()=>fmt.normalizeHtml('<img src="javascript:alert(1)">'),/链接协议/);
  });
  const prepareArgs={request_id:"prepared-success-001",title:"一键保存测试",digest:"测试摘要",content:'<h2>标题</h2><p>正文<strong>重点</strong>[1]</p>{{image:body1}}',cover:{image_base64:fixture.toString("base64")},body_images:[{id:"body1",image_base64:fixture.toString("base64")}],references:[{title:"参考",url:"https://example.com/"}]};
  await test("one-click uploads images, formats, saves, verifies and replays without side effects",async()=>{
    const result=await core.prepareAndSaveDraft("alice",prepareArgs); assert.equal(result.created,true);assert.equal(result.readback_verified,true);assert.equal(result.published,false);
    const before=calls.length; assert.deepEqual(await core.prepareAndSaveDraft("alice",prepareArgs),result);assert.equal(calls.length,before);
    await assert.rejects(()=>core.prepareAndSaveDraft("alice",{...prepareArgs,title:"different"}),/不同内容/);
  });
  await test("lost one-click response is reconciled before any repeat add",async()=>{
    failure="lost-create-response";
    const args={...prepareArgs,request_id:"prepared-lost-001",title:"unique lost response"};
    const result=await core.prepareAndSaveDraft("alice",args);assert.equal(result.created,true);assert.equal(result.readback_verified,true);
    const before=calls.filter(p=>p==="/cgi-bin/draft/add").length;failure="";
    assert.equal((await core.prepareAndSaveDraft("alice",args)).media_id,result.media_id);
    assert.equal(calls.filter(p=>p==="/cgi-bin/draft/add").length,before);
  });
  await test("readback mismatch never counts as verification and never duplicates",async()=>{
    failure="mismatch";const args={...prepareArgs,request_id:"prepared-mismatch-001"};
    const result=await core.prepareAndSaveDraft("alice",args); assert.equal(result.created,true);assert.equal(result.readback_verified,false);
    const before=calls.filter(p=>p==="/cgi-bin/draft/add").length;failure="";
    assert.equal((await core.prepareAndSaveDraft("alice",args)).readback_verified,true);assert.equal(calls.filter(p=>p==="/cgi-bin/draft/add").length,before);
  });
  await test("concurrent high-level retries submit only once",async()=>{
    const before=calls.filter(p=>p==="/cgi-bin/draft/add").length;
    const args={...prepareArgs,request_id:"prepared-concurrent-001",title:"concurrent"};
    await Promise.all([core.prepareAndSaveDraft("alice",args),core.prepareAndSaveDraft("alice",args)]);
    assert.equal(calls.filter(p=>p==="/cgi-bin/draft/add").length,before+1);
  });
  await test("unknown reconciliation never retries the write when reads fail",async()=>{
    failure="lost-create-no-lookup";
    const args={...prepareArgs,request_id:"prepared-unknown-001",title:"unknown"};
    const result=await core.prepareAndSaveDraft("alice",args);assert.equal(result.outcome,"unknown");assert.equal(result.retry_safe,false);
    const before=calls.filter(p=>p==="/cgi-bin/draft/add").length;
    assert.equal((await core.prepareAndSaveDraft("alice",args)).outcome,"unknown");assert.equal(calls.filter(p=>p==="/cgi-bin/draft/add").length,before);
    failure="";assert.equal((await core.prepareAndSaveDraft("alice",args)).readback_verified,true);
  });
  await test("WeChat CDN size/data-src rewrites preserve image identity but stripped links fail",async()=>{
    const content=fmt.normalizeHtml('<p>参考[1]</p><img src="http://mmbiz.qpic.cn/mmbiz_jpg/mock-image-id/0?from=appmsg"><p><a href="https://example.com">来源</a></p>');
    const expected=validation.validateArticle({...article,content});
    const rewritten=content.replace('src="http://mmbiz.qpic.cn/mmbiz_jpg/mock-image-id/0?from=appmsg"','data-src="https://mmbiz.qpic.cn/mmbiz_jpg/mock-image-id/640?from=appmsg"');
    assert.equal(fmt.verifyArticle(expected,{...expected,content:rewritten}).verified,true);
    const stripped=rewritten.replace(/<a[^>]*>(.*?)<\/a>/g,'$1');
    const check=fmt.verifyArticle(expected,{...expected,content:stripped});assert.equal(check.verified,false);assert.equal(check.checks.links,false);assert.equal(check.checks.images,true);
    assert.match(fmt.normalizeHtml(rewritten),/src="https:\/\/mmbiz/);
  });
  const newTest=async(label)=>core.prepareAndSaveDraft("alice",{...prepareArgs,request_id:"test-create-"+label,title:"【测试草稿·勿发布】"+label,digest:"隔离回归测试",test_draft:true});
  const deleteCount=()=>calls.filter(p=>p==="/cgi-bin/draft/delete").length;
  await test("only explicitly registered test creation can be deleted with readback",async()=>{
    const created=await newTest("legal-001");assert.equal(created.readback_verified,true);
    const result=await core.deleteTestDraft("alice",{media_id:created.media_id,request_id:"delete-legal-001"});
    assert.equal(result.outcome,"confirmed_deleted");assert.equal(result.readback_verified,true);assert.equal(upstream.has(created.media_id),false);
    const provenance=records.get(receipts).find(r=>r.kind==="test_draft_provenance"&&JSON.parse(r.result).media_id===created.media_id);
    assert.equal(provenance.state,"deleted");assert.equal(JSON.parse(provenance.result).title,"【测试草稿·勿发布】legal-001");
    const before=deleteCount();assert.equal((await core.deleteTestDraft("alice",{media_id:created.media_id,request_id:"delete-legal-001"})).idempotent_replay,true);assert.equal(deleteCount(),before);
    assert.equal((await core.deleteTestDraft("alice",{media_id:created.media_id,request_id:"delete-legal-002"})).outcome,"already_deleted");assert.equal(deleteCount(),before);
  });
  await test("formal article and test-word title without provenance cannot be deleted",async()=>{
    const formal=await core.createDraft("alice",{request_id:"ordinary-draft-001",articles:[{...article,title:"正式文章"}]});
    const titled=await core.createDraft("alice",{request_id:"test-word-draft-001",articles:[{...article,title:"测试文章"}]});
    const before=deleteCount();for(const media_id of [formal.media_id,titled.media_id]) await assert.rejects(()=>core.deleteTestDraft("alice",{media_id,request_id:"delete-no-source-"+media_id}),/可信测试草稿创建记录/);
    assert.equal(deleteCount(),before);
  });
  await test("mismatched target and reused request ID cannot delete another draft",async()=>{
    const a=await newTest("target-a-001"),b=await newTest("target-b-001"),before=deleteCount();
    const args={media_id:a.media_id,request_id:"delete-target-a-001"};
    const result=await core.deleteTestDraft("alice",args);assert.equal(result.deleted,true);
    await assert.rejects(()=>core.deleteTestDraft("alice",{...args,media_id:b.media_id}),/跨目标/);
    assert.equal(upstream.has(b.media_id),true);assert.equal(deleteCount(),before+1);
  });
  await test("human edits to title, digest or body prevent automatic delete",async()=>{
    const a=await newTest("changed-001");upstream.get(a.media_id)[0].content+="<p>human edited</p>";
    const before=deleteCount();await assert.rejects(()=>core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-changed-001"}),/已变化/);assert.equal(deleteCount(),before);
  });
  await test("explicit WeChat permission error cannot be reported as deletion",async()=>{
    const a=await newTest("reject-001");failure="delete-reject";
    await assert.rejects(()=>core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-reject-001"}),/48001/);
    failure="";assert.equal(upstream.has(a.media_id),true);
    const before=deleteCount();assert.equal((await core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-reject-001"})).outcome,"previous_failure");assert.equal(deleteCount(),before);
  });
  await test("delete timeout reconciles target absence without duplicate request",async()=>{
    const a=await newTest("timeout-001");failure="delete-timeout";
    const result=await core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-timeout-001"});failure="";
    assert.equal(result.outcome,"confirmed_absent_after_unknown");assert.equal(result.deleted,true);
    const before=deleteCount();assert.equal((await core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-timeout-001"})).idempotent_replay,true);assert.equal(deleteCount(),before);
  });
  await test("still-present target after timeout is fail-closed, including on retry",async()=>{
    const a=await newTest("still-present-001");failure="delete-timeout-present";
    const args={media_id:a.media_id,request_id:"delete-still-present-001"};const result=await core.deleteTestDraft("alice",args);failure="";
    assert.equal(result.deleted,false);assert.equal(result.retry_safe,false);
    const before=deleteCount();assert.equal((await core.deleteTestDraft("alice",args)).deleted,false);assert.equal(deleteCount(),before);
  });
  await test("WeChat success without target disappearance remains unverified",async()=>{
    const a=await newTest("noop-001");failure="delete-no-op";
    const result=await core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-noop-001"});failure="";
    assert.equal(result.deleted,false);assert.equal(upstream.has(a.media_id),true);
  });
  await test("other user and other account cannot use another user's provenance",async()=>{
    const a=await newTest("owner-001");await core.saveConnection("bob",{app_id:"wxabcdefgh12345678",app_secret:"mock-bob-secret-not-real"});
    const before=deleteCount();await assert.rejects(()=>core.deleteTestDraft("bob",{media_id:a.media_id,request_id:"delete-other-user-001"}),/可信测试草稿创建记录/);
    const row=records.get(connections).find(r=>r.userId==="alice");const oldApp=row.appId;row.appId="wxotheraccount123456";
    await assert.rejects(()=>core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-other-app-001"}),/可信测试草稿创建记录/);
    row.appId=oldApp;assert.equal(deleteCount(),before);
  });
  await test("parallel deletions of one target permit only one upstream call",async()=>{
    const a=await newTest("parallel-001"),before=deleteCount();
    const results=await Promise.allSettled([core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-parallel-001"}),core.deleteTestDraft("alice",{media_id:a.media_id,request_id:"delete-parallel-002"})]);
    assert.equal(deleteCount(),before+1);assert.equal(results.filter(x=>x.status==="fulfilled"&&x.value.deleted===true).length>=1,true);
  });
  if(process.argv.includes("--layout")) {
    const html=fmt.prepareHtml('<h2>手机排版回归</h2><p>正文<strong>重点句</strong>与参考资料[1]。</p><pre><code>{"request_id":"example-001","url":"https://example.com/'+"long-identifier-".repeat(12)+'"}</code></pre><p><a href="https://example.com/">https://example.com/'+"long-link/".repeat(18)+'</a></p>',"html",[{title:"资料链接",url:"https://example.com/"}]);
    const escaped=html.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
    await mkdir("outputs",{recursive:true});
    await writeFile("outputs/mobile-qa.html",'<!doctype html><meta charset="utf-8"><title>Mobile layout QA</title><style>body{font:16px system-ui;background:#ddd} main{display:flex;gap:20px}iframe{height:1100px;border:0;background:white}</style><h1>手机排版：360 / 390 / 430 px</h1><main>'+[360,390,430].map(w=>'<section><h2>'+w+' px</h2><iframe width="'+w+'" srcdoc="'+escaped+'"></iframe></section>').join("")+'</main>');
  }
  console.log(passed + " behavior checks passed; live account integration remains a separate check.");
} finally { globalThis.fetch = originalFetch; }
