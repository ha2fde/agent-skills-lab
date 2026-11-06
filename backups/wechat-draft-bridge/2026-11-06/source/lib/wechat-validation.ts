import { UserFacingError as Error } from "./errors";
export type Article = {
  title: string; author: string; digest: string; content: string; thumb_media_id: string;
  content_source_url: string; need_open_comment: number; only_fans_can_comment: number;
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("参数必须是对象。");
  return value as Record<string, unknown>;
}
export function str(value: unknown, name: string, max: number, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${name}应为${required ? "非空" : ""}文本，最多 ${max} 个字符。`);
  // Count code points without allocating an array of every character.
  let length = 0;
  for (const _character of value) if (++length > max) throw new Error(`${name}应为${required ? "非空" : ""}文本，最多 ${max} 个字符。`);
  return value;
}
export function integer(value: unknown, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`${name}应在 ${min}–${max} 之间。`);
  return Number(value);
}
export function validateRelayUrl(value: string): string {
  if (!value) return "";
  let u: URL;
  try { u = new URL(value); } catch { throw new Error("转发服务需要完整的 HTTPS 地址。"); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.port || !host.includes(".") ||
      /^(?:\d+\.){3}\d+$/.test(host) || host.includes(":") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)) throw new Error("转发服务请使用无端口、无查询参数的公网 HTTPS 域名地址。");
  return u.toString();
}
export function validateArticle(value: unknown): Article {
  const a = object(value), content = str(a.content, "正文 HTML", 20000);
  if (new TextEncoder().encode(content).byteLength > 1024 * 1024) throw new Error("正文不能超过 1 MiB。");
  if (/<\s*(?:script|iframe|object|embed|form|input|button|link|style|base)\b/i.test(content) || /\bon\w+\s*=/i.test(content) || /(?:javascript|vbscript)\s*:/i.test(content)) throw new Error("正文请使用静态 HTML 和内联样式，移除脚本、表单及外部样式。");
  for (const match of content.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    let src: URL;
    try { src = new URL(match[1]); } catch { throw new Error("正文图片请先上传到微信，再使用返回的图片 URL。"); }
    if (!/^https?:$/.test(src.protocol) || !/(?:^|\.)(?:qpic\.cn|qlogo\.cn|weixin\.qq\.com)$/.test(src.hostname)) throw new Error("正文图片需要先上传到微信，再使用返回的微信图片 URL。");
  }
  const source = str(a.content_source_url, "原文地址", 2000, false);
  if (source) {
    let u: URL;
    try { u = new URL(source); } catch { throw new Error("原文地址应为完整的 HTTP 或 HTTPS URL。"); }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error("原文地址应使用 HTTP 或 HTTPS。");
  }
  return {
    title: str(a.title, "标题", 64), author: str(a.author, "作者", 16, false), digest: str(a.digest, "摘要", 120, false),
    content, thumb_media_id: str(a.thumb_media_id, "封面素材 ID", 1024), content_source_url: source,
    need_open_comment: integer(a.need_open_comment ?? 0, "评论开关", 0, 1), only_fans_can_comment: integer(a.only_fans_can_comment ?? 0, "粉丝评论开关", 0, 1),
  };
}
export function articleFields(value: Record<string, unknown>): Article {
  return {
    title: String(value.title ?? ""), author: String(value.author ?? ""), digest: String(value.digest ?? ""), content: String(value.content ?? ""),
    thumb_media_id: String(value.thumb_media_id ?? ""), content_source_url: String(value.content_source_url ?? ""),
    need_open_comment: Number(value.need_open_comment ?? 0), only_fans_can_comment: Number(value.only_fans_can_comment ?? 0),
  };
}
export async function hash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function imageType(bytes: Uint8Array): "image/jpeg" | "image/png" {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  throw new Error("请选择真实的 JPEG 或 PNG 图片。");
}
