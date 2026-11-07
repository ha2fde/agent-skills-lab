import { env } from "cloudflare:workers";
import { UserFacingError as Error } from "./errors";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections, images, receipts } from "@/db/schema";
import { articleFields, hash, integer, object, str, validateArticle, validateRelayUrl } from "./wechat-validation";
import { imageFromArgs, prepareImage } from "./wechat-image";

import { normalizeHtml, prepareHtml, verifyArticle, FORMAT_VERSION } from "./wechat-format";

type Connection = typeof connections.$inferSelect;
const now = () => new Date().toISOString();
const SETTINGS_URL = "https://wechat-draft-bridge.hac2fde.chatgpt.site";
async function key() {
  const value = (env as unknown as Record<string, string>).WECHAT_CONFIG_ENCRYPTION_KEY;
  if (!value) throw new Error("服务端凭据加密尚未就绪，请联系创建者。");
  return crypto.subtle.importKey("raw", Uint8Array.from(atob(value), c => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(value: string, userId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) }, await key(), new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv)) + "." + btoa(String.fromCharCode(...out));
}
async function unseal(value: string, userId: string) {
  const [ivText, bodyText] = value.split(".");
  const iv = Uint8Array.from(atob(ivText), c => c.charCodeAt(0)), body = Uint8Array.from(atob(bodyText), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) }, await key(), body));
}
async function config(userId: string): Promise<Connection> {
  const c = await getDb().select().from(connections).where(eq(connections.userId, userId)).get();
  if (!c) throw new Error(`请先打开私有设置页配置公众号 AppID 和 AppSecret：${SETTINGS_URL}。当前还不能操作真实草稿。`);
  return c;
}
export async function connectionStatus(userId: string) {
  const c = await getDb().select().from(connections).where(eq(connections.userId, userId)).get();
  return {
    configured: !!c, verified: !!c?.verifiedAt, account: c?.label ?? null, app_id: c?.appId ?? null,
    route: c?.relayUrl ? "fixed_ip_relay" : "direct", relay_url: c?.relayUrl ?? "", has_app_secret: !!c?.secretCipher, has_relay_key: !!c?.relayKeyCipher,
    verified_at: c?.verifiedAt ?? null, last_error: c?.lastError ?? null, settings_url: SETTINGS_URL,
    capabilities: ["create_draft", "update_draft", "list_drafts", "get_draft", "upload_images", "prepare_and_save_draft"],
    service_version: "1.1.0", format_version: FORMAT_VERSION,
    network_note: "直连托管服务不承诺固定出口 IP。若微信返回 40164，请配置固定公网 IP 的转发服务。",
  };
}
export async function saveConnection(userId: string, input: unknown) {
  const data = object(input), appId = str(data.app_id, "AppID", 64).trim();
  if (!/^wx[a-zA-Z0-9]{8,62}$/.test(appId)) throw new Error("请填写公众号的 AppID，通常以 wx 开头。");
  const current = await getDb().select().from(connections).where(eq(connections.userId, userId)).get();
  const secret = str(data.app_secret ?? "", "AppSecret", 256, false).trim();
  if (!secret && (!current || current.appId !== appId)) throw new Error("首次配置或切换公众号时需要填写 AppSecret。");
  const relayUrl = validateRelayUrl(str(data.relay_url ?? "", "转发地址", 2000, false).trim());
  const relayKey = str(data.relay_key ?? "", "转发密钥", 512, false).trim();
  if (relayUrl && !relayKey && (!current?.relayKeyCipher || current.relayUrl !== relayUrl)) throw new Error("首次配置或更改转发地址时，请同时填写转发密钥。");
  if (relayKey && relayKey.length < 32) throw new Error("转发密钥至少需要 32 个字符。");
  const values = {
    userId, appId, label: str(data.label || "我的公众号", "公众号名称", 80).trim(),
    secretCipher: secret ? await seal(secret, userId) : current!.secretCipher,
    relayUrl, relayKeyCipher: relayUrl ? (relayKey ? await seal(relayKey, userId) : current!.relayKeyCipher) : "",
    tokenCipher: null, tokenExpires: 0, verifiedAt: null, lastError: null, updatedAt: now(),
  };
  await getDb().insert(connections).values(values).onConflictDoUpdate({ target: connections.userId, set: values });
  return connectionStatus(userId);
}
export class WeChatError extends Error {
  constructor(public code: number, message: string) { super(message); }
}
function wechatError(data: Record<string, unknown>) {
  const code = Number(data.errcode);
  const known: Record<number, string> = {
    40001: "调用凭据失效，请重新检测连接。", 40007: "素材 ID 无效或不属于当前公众号。", 40014: "调用凭据无效，请重新检测连接。",
    40125: "AppSecret 不正确，请在设置页更新。", 42001: "调用凭据已过期，请重新检测连接。",
    48001: "当前公众号未获得这个接口的权限，请检查公众号后台的接口权限。", 45009: "微信接口调用达到额度，请稍后再试。",
    40164: "调用服务器的公网 IP 不在微信白名单中。请使用固定 IP 转发服务，并在公众号后台添加它的出口 IP。",
  };
  let message = known[code] ?? "微信接口拒绝了请求，请核对参数和公众号权限。";
  if (code === 40164) { const match = String(data.errmsg ?? "").match(/invalid ip\s+([0-9a-f.:]+)/i); if (match) message += ` 本次出口 IP：${match[1]}。`; }
  return new WeChatError(code, `${message}（微信错误码 ${code}）`);
}
async function wire(c: Connection, path: string, body?: unknown, token?: string, method = "POST") {
  const headers = new Headers();
  const writesDraft = path === "/cgi-bin/draft/add" || path === "/cgi-bin/draft/update";
  let destination: string;
  if (c.relayUrl) {
    destination = c.relayUrl;
    headers.set("Authorization", `Bearer ${await unseal(c.relayKeyCipher, c.userId)}`);
    headers.set("X-Wechat-Path", path);
    if (token) headers.set("X-Wechat-Token", token);
  } else {
    const url = new URL(path, "https://api.weixin.qq.com");
    if (token) url.searchParams.set("access_token", token);
    destination = url.toString();
  }
  let raw: BodyInit | undefined;
  if (body instanceof FormData) raw = body;
  else if (body !== undefined) { headers.set("Content-Type", "application/json; charset=utf-8"); raw = JSON.stringify(body); }
  let response: Response;
  // workerd supports follow/manual only. Reject redirects by inspecting the response;
  // never follow a redirect while carrying account or relay credentials.
  try { response = await fetch(destination, { method, headers, body: raw, redirect: "manual", signal: AbortSignal.timeout(25000) }); }
  catch { throw new Error(writesDraft ? "微信请求未收到完整响应。写入操作的结果可能未知，请先查询草稿箱，勿直接换一个请求编号重复创建。" : "未能连接微信接口，请稍后重试；如果持续失败，请检查转发服务或网络可达性。本次未执行草稿写入。"); }
  if (!response.ok) throw new Error(`调用通道返回 HTTP ${response.status}，请检查网络、转发地址和密钥。${writesDraft ? "写入请求请先查询结果再重试。" : "本次未执行草稿写入。"}`);
  const responseText = await response.text();
  if (responseText.length > 3 * 1024 * 1024) throw new Error("微信返回内容过大，请减小每页数量。");
  let data: Record<string, unknown>;
  try { data = object(JSON.parse(responseText)); } catch { throw new Error(`调用通道没有返回有效的微信 JSON 响应。${writesDraft ? "写入结果请先查询核实。" : "本次未执行草稿写入。"}`); }
  if (data.errcode && Number(data.errcode) !== 0) throw wechatError(data);
  return data;
}
async function accessToken(c: Connection) {
  if (c.tokenCipher && c.tokenExpires > Date.now() + 180000) return unseal(c.tokenCipher, c.userId);
  const data = await wire(c, "/cgi-bin/stable_token", { grant_type: "client_credential", appid: c.appId, secret: await unseal(c.secretCipher, c.userId), force_refresh: false });
  if (typeof data.access_token !== "string" || !data.access_token) throw new Error("微信未返回有效的接口调用凭据。");
  await getDb().update(connections).set({ tokenCipher: await seal(data.access_token, c.userId), tokenExpires: Date.now() + Math.max(0, Number(data.expires_in ?? 7200) - 120) * 1000 }).where(and(eq(connections.userId, c.userId), eq(connections.updatedAt, c.updatedAt)));
  return data.access_token;
}
async function api(c: Connection, path: string, body?: unknown, method = "POST") { return wire(c, path, body, await accessToken(c), method); }
export async function checkConnection(userId: string) {
  const c = await config(userId);
  try {
    const result = await api(c, "/cgi-bin/draft/count", undefined, "GET");
    await getDb().update(connections).set({ verifiedAt: now(), lastError: null }).where(and(eq(connections.userId, userId), eq(connections.updatedAt, c.updatedAt)));
    return { ...await connectionStatus(userId), draft_count: Number(result.total_count ?? 0), message: "已成功读取真实草稿数量。图片上传和写入权限将在对应操作时由微信校验。" };
  } catch (e) {
    await getDb().update(connections).set({ verifiedAt: null, lastError: e instanceof Error ? e.message : "连接检测失败。" }).where(and(eq(connections.userId, userId), eq(connections.updatedAt, c.updatedAt)));
    throw e;
  }
}
export async function listDrafts(userId: string, args: Record<string, unknown>) {
  const data = await api(await config(userId), "/cgi-bin/draft/batchget", { offset: integer(args.offset ?? 0, "起始位置", 0, 1000000), count: integer(args.count ?? 10, "数量", 1, 20), no_content: 1 });
  return { total_count: data.total_count, item_count: data.item_count, drafts: (Array.isArray(data.item) ? data.item : []).map(item => {
    const d = object(item), content = d.content ? object(d.content) : {};
    return { media_id: d.media_id, updated_at: d.update_time, articles: (Array.isArray(content.news_item) ? content.news_item : []).map(a => {
      const article = object(a); return { title: article.title, author: article.author, digest: article.digest, thumb_media_id: article.thumb_media_id };
    }) };
  }) };
}
async function getDraftFor(c: Connection, mediaId: string) {
  const data = await api(c, "/cgi-bin/draft/get", { media_id: mediaId });
  return { media_id: mediaId, articles: await Promise.all((Array.isArray(data.news_item) ? data.news_item : []).map(async (a, index) => {
    const fields = articleFields(object(a)); return { index, ...fields, content_hash: await hash(fields) };
  })) };
}
export async function getDraft(userId: string, args: Record<string, unknown>) { return getDraftFor(await config(userId), str(args.media_id, "草稿 ID", 1024)); }
async function once(c: Connection, kind: string, requestId: string, payload: unknown, work: () => Promise<unknown>) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error("请求编号应为 8–100 位字母、数字、下划线或连字符；同一次操作重试时保持不变。");
  const id = await hash([c.userId, c.appId, requestId]), payloadHash = await hash([kind, payload]);
  const existing = await getDb().select().from(receipts).where(eq(receipts.id, id)).get();
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("这个请求编号已用于不同内容，请为新操作使用新的请求编号。");
    if (existing.state === "complete" && existing.result) return JSON.parse(existing.result);
    throw new Error(existing.state === "failed" ? "上次请求被微信拒绝。请修正问题，再使用新的请求编号。" : "该请求仍在处理或结果未知。请先查询草稿箱核实；此编号不会再次触发写入。");
  }
  const inserted = await getDb().insert(receipts).values({ id, userId: c.userId, appId: c.appId, kind, payloadHash, state: "processing", createdAt: now() }).onConflictDoNothing().returning({ id: receipts.id });
  if (!inserted.length) throw new Error("该请求已经开始处理，请稍后查询结果。");
  try {
    const result = await work();
    await getDb().update(receipts).set({ state: "complete", result: JSON.stringify(result) }).where(eq(receipts.id, id));
    return result;
  } catch (e) { await getDb().update(receipts).set({ state: e instanceof WeChatError ? "failed" : "unknown", result: null }).where(eq(receipts.id, id)); throw e; }
}
async function readback(c: Connection, mediaId: string, expected: ReturnType<typeof validateArticle>[], indices?: number[]) {
  try {
    const draft = await getDraftFor(c, mediaId);
    const verification = expected.map((article, i) => {
      const actual = draft.articles[indices?.[i] ?? i];
      return actual ? verifyArticle(article, actual) : { verified: false, checks: { article_present: false } };
    });
    const verified = verification.every(v => v.verified) && (indices !== undefined || draft.articles.length === expected.length);
    return { readback_verified: verified, verification, draft, ...(verified ? {} : { warning: "草稿已保存，但读回内容或样式不一致；请检查验证明细，禁止重新创建。" }) };
  } catch { return { readback_verified: false, warning: "微信已返回写入成功及草稿 ID，但后续读回失败。请查询此 ID，勿再次创建。" }; }
}
function formattedArticle(value: unknown) {
  const a = validateArticle(value);
  return validateArticle({ ...a, content: normalizeHtml(a.content) });
}
export async function createDraft(userId: string, args: Record<string, unknown>) {
  const c = await config(userId);
  if (!Array.isArray(args.articles) || args.articles.length < 1 || args.articles.length > 8) throw new Error("一次草稿应包含 1–8 篇文章。");
  const articles = args.articles.map(formattedArticle), requestId = str(args.request_id, "请求编号", 100);
  return once(c, "create_draft", requestId, articles, async () => {
    const data = await api(c, "/cgi-bin/draft/add", { articles });
    if (typeof data.media_id !== "string" || !data.media_id) throw new Error("微信没有返回草稿 ID，结果未知，请先查询草稿箱。");
    return { created: true, request_id: requestId, media_id: data.media_id, ...await readback(c, data.media_id, articles) };
  });
}
export async function updateDraft(userId: string, args: Record<string, unknown>) {
  const c = await config(userId), mediaId = str(args.media_id, "草稿 ID", 1024), index = integer(args.index ?? 0, "文章索引", 0, 7);
  const expected = str(args.expected_content_hash, "当前内容指纹", 64), article = formattedArticle(args.article), requestId = str(args.request_id, "请求编号", 100);
  // The previous version is checked inside the deduplicated operation, so replaying a completed request remains safe.
  return once(c, "update_draft", requestId, { mediaId, index, expected, article }, async () => {
    const before = await getDraftFor(c, mediaId), current = before.articles[index];
    if (!current || current.content_hash !== expected) throw new WeChatError(-1, "草稿已变化或文章索引无效，请重新读取草稿，再提交修改。");
    await api(c, "/cgi-bin/draft/update", { media_id: mediaId, index, articles: article });
    return { updated: true, request_id: requestId, media_id: mediaId, ...await readback(c, mediaId, [article], [index]) };
  });
}
export async function uploadImage(userId: string, bytes: Uint8Array, name: string, purpose: string) {
  if (purpose !== "cover" && purpose !== "body") throw new Error("图片用途请选择封面或正文。");
  const processed = await prepareImage(bytes, purpose);
  bytes = processed.bytes;
  const mime = "image/jpeg", c = await config(userId), form = new FormData();
  form.set("media", new Blob([bytes as BlobPart], { type: mime }), "image.jpg");
  const data = await api(c, purpose === "cover" ? "/cgi-bin/material/add_material?type=image" : "/cgi-bin/media/uploadimg", form);
  if (purpose === "cover" && typeof data.media_id !== "string") throw new Error("微信未返回封面素材 ID。");
  if (purpose === "body" && typeof data.url !== "string") throw new Error("微信未返回正文图片 URL。");
  const image = { id: crypto.randomUUID(), userId, appId: c.appId, name: str(name, "文件名", 180), purpose, mediaId: typeof data.media_id === "string" ? data.media_id : null, url: typeof data.url === "string" ? data.url : null, createdAt: now() };
  await getDb().insert(images).values(image);
  return { name: image.name, purpose, media_id: image.mediaId, url: image.url, uploaded_at: image.createdAt, processing: processed.metadata };
}
export async function uploadImageTool(userId: string, args: Record<string, unknown>) {
  const filename = str(args.filename, "文件名", 180), purpose = str(args.purpose, "用途", 10);
  if (purpose !== "cover" && purpose !== "body") throw new Error("图片用途请选择封面或正文。");
  return uploadImage(userId, await imageFromArgs(args), filename, purpose);
}
export async function listImages(userId: string) {
  const c = await config(userId), items = await getDb().select().from(images).where(and(eq(images.userId, userId), eq(images.appId, c.appId))).orderBy(desc(images.createdAt)).limit(30);
  return { images: items.map(i => ({ name: i.name, purpose: i.purpose, media_id: i.mediaId, url: i.url, uploaded_at: i.createdAt })) };
}
export async function recentOperations(userId: string) {
  const c = await getDb().select().from(connections).where(eq(connections.userId, userId)).get();
  if (!c) return { operations: [] };
  const data = await getDb().select().from(receipts).where(and(eq(receipts.userId, userId), eq(receipts.appId, c.appId))).orderBy(desc(receipts.createdAt)).limit(10);
  return { operations: data.map(r => ({ action: r.kind, state: r.state, created_at: r.createdAt, media_id: r.result ? JSON.parse(r.result).media_id : null })) };
}

// Durable outer receipt covers image preparation and the one draft submission.
// No schema migration: old receipts remain readable; added states are text values.
export async function prepareAndSaveDraft(userId: string, args: Record<string, unknown>) {
  const c = await config(userId), requestId = str(args.request_id, "请求编号", 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error("请求编号应为 8–100 位字母、数字、下划线或连字符。");
  const title = str(args.title, "标题", 64), digest = str(args.digest ?? "", "摘要", 120, false);
  const content = str(args.content, "正文", 20000), author = str(args.author, "作者", 16, false);
  const format = args.content_format ?? "html";
  if (format !== "text" && format !== "html") throw new Error("正文格式应为 text 或 html。");
  const cover = object(args.cover), body = args.body_images ?? [];
  if (!Array.isArray(body) || body.length > 8) throw new Error("正文图片最多 8 张。");
  const refs = args.references ?? [];
  const bodyInputs: (Record<string, unknown> & { id:string })[] = body.map(item => { const v = object(item), id = str(v.id, "图片占位编号", 40); if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("图片编号只能使用字母、数字、下划线或连字符。"); return { ...v, id }; });
  if (new Set(bodyInputs.map(x=>x.id)).size !== bodyInputs.length) throw new Error("正文图片编号不得重复。");
  const validateSource = (input: Record<string, unknown>) => {
    if ((input.image_url !== undefined) === (input.image_base64 !== undefined)) throw new Error("图片获取：image_url 和 image_base64 请选择一个提供。");
  };
  validateSource(cover); bodyInputs.forEach(validateSource);
  // Validate all content before any upload. Placeholder URLs are validation-only.
  const preview = prepareHtml(content, format, refs, new Map(bodyInputs.map(x=>[x.id,"https://mmbiz.qpic.cn/validation-only"])));
  validateArticle({ title, digest, author, content: preview, thumb_media_id: "validation-only", content_source_url: args.content_source_url });
  const id = await hash([c.userId, c.appId, requestId]), payloadHash = await hash(["prepare_and_save_draft", args]);
  const existing = await getDb().select().from(receipts).where(eq(receipts.id, id)).get();
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("这个请求编号已用于不同内容，请勿更换内容重试。");
    if (existing.state === "complete" && existing.result) return JSON.parse(existing.result);
    if (existing.result) {
      const saved = JSON.parse(existing.result);
      if (saved.expected) return reconcilePrepared(c, id, requestId, saved);
      if (existing.state === "failed") return saved;
    }
    return { request_id: requestId, created: false, readback_verified: false, outcome: "in_progress_or_unknown", stage: existing.state, retry_safe: false, message: "此请求已开始，禁止再次提交或更换编号盲目创建。" };
  }
  const inserted = await getDb().insert(receipts).values({ id, userId, appId: c.appId, kind: "prepare_and_save_draft", payloadHash, state: "preparing", createdAt: now() }).onConflictDoNothing().returning({id:receipts.id});
  if (!inserted.length) return { request_id:requestId, outcome:"in_progress_or_unknown", retry_safe:false, created:false, readback_verified:false };
  let stage = "cover", submitted = false;
  let saved: Record<string, unknown> = {};
  try {
    const uploadedCover = await uploadImageTool(userId, { ...cover, filename: cover.filename ?? "cover.jpg", purpose: "cover" });
    stage = "body_images";
    const uploadedBody = [];
    for (const item of bodyInputs) uploadedBody.push({ id:item.id, ...await uploadImageTool(userId, { ...item, filename: item.filename ?? item.id+".jpg", purpose:"body" }) });
    stage = "format";
    const html = prepareHtml(content, format, refs, new Map(uploadedBody.map(x=>[x.id, String(x.url)])));
    const article = validateArticle({ title, digest, author, content:html, thumb_media_id:uploadedCover.media_id, content_source_url:args.content_source_url });
    saved = { expected: article, assets: { cover:uploadedCover, body_images:uploadedBody }, format_version:FORMAT_VERSION };
    stage = "create";
    await getDb().update(receipts).set({state:"submitting",result:JSON.stringify(saved)}).where(eq(receipts.id,id));
    submitted = true;
    const response = await api(c,"/cgi-bin/draft/add",{articles:[article]});
    if (typeof response.media_id !== "string" || !response.media_id) throw new Error("微信接口：未返回草稿 ID，结果未知。");
    saved.media_id=response.media_id;
    // Persist the real ID before readback, even when subsequent verification fails.
    await getDb().update(receipts).set({state:"verifying",result:JSON.stringify(saved)}).where(eq(receipts.id,id));
    stage = "readback";
    const result = { created:true, outcome:"saved", request_id:requestId, media_id:response.media_id, assets:saved.assets, format_version:FORMAT_VERSION, ...await readback(c,response.media_id,[article]), published:false };
    await getDb().update(receipts).set({state:result.readback_verified?"complete":"verifying",result:JSON.stringify(result.readback_verified?result:{...saved,last_result:result})}).where(eq(receipts.id,id));
    return result;
  } catch(e) {
    if (submitted && !(e instanceof WeChatError)) {
      await getDb().update(receipts).set({state:"unknown",result:JSON.stringify(saved)}).where(eq(receipts.id,id));
      return reconcilePrepared(c,id,requestId,saved);
    }
    const result = { request_id:requestId, created:false, readback_verified:false, outcome:"failed", stage, retry_safe:!submitted, error: e instanceof Error ? e.message : "服务暂时未能完成请求。", published:false };
    await getDb().update(receipts).set({state:"failed",result:JSON.stringify(result)}).where(eq(receipts.id,id));
    return result;
  }
}
async function reconcilePrepared(c: Connection, id: string, requestId: string, saved: Record<string, unknown>) {
  const expected = validateArticle(saved.expected);
  if (typeof saved.media_id === "string") {
    const result={created:true,outcome:"saved",request_id:requestId,media_id:saved.media_id,assets:saved.assets,format_version:FORMAT_VERSION,...await readback(c,saved.media_id,[expected]),published:false};
    if(result.readback_verified) await getDb().update(receipts).set({state:"complete",result:JSON.stringify(result)}).where(eq(receipts.id,id));
    return result;
  }
  // A timeout never authorizes a second add. Scan a bounded recent draft window.
  try {
    const candidates: string[] = []; let total=0;
    for(let offset=0;offset<200;offset+=20) {
      const page=await api(c,"/cgi-bin/draft/batchget",{offset,count:20,no_content:0});
      total=Number(page.total_count??0);
      const items=Array.isArray(page.item)?page.item:[];
      for(const item of items) {
        const d=object(item), a=object(d.content??{}), list=Array.isArray(a.news_item)?a.news_item:[];
        if(list.length===1 && verifyArticle(expected,articleFields(object(list[0]))).verified && typeof d.media_id==="string") candidates.push(d.media_id);
      }
      if(offset+items.length>=total||!items.length) break;
    }
    if(candidates.length===1) {
      saved.media_id=candidates[0];
      await getDb().update(receipts).set({state:"verifying",result:JSON.stringify(saved)}).where(eq(receipts.id,id));
      return reconcilePrepared(c,id,requestId,saved);
    }
    return {request_id:requestId,created:false,readback_verified:false,outcome:"unknown",stage:"reconcile",candidate_media_ids:candidates,scan_limit:200,total_drafts:total,retry_safe:false,published:false,message:"已检查草稿但尚无法唯一确认。禁止再次提交；稍后使用相同请求编号和参数重查。"};
  } catch { return {request_id:requestId,created:false,readback_verified:false,outcome:"unknown",stage:"reconcile",retry_safe:false,published:false,message:"结果未知且草稿查询未完成。禁止重复创建；稍后用相同参数重查。"}; }
}
