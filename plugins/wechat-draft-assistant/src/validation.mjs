import { createHash } from 'node:crypto';

export class UserFacingError extends Error {}
export class WeChatError extends UserFacingError {
  constructor(code, message) { super(message); this.code = code; }
}
export const safeError = error => error instanceof UserFacingError
  ? error.message : '服务未能完成请求。如果写入结果未知，请先查询草稿箱，勿换编号重复创建。';
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UserFacingError('参数必须是对象。');
  return value;
}
export function str(value, name, max, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim())) throw new UserFacingError(`${name}应为文本，最多 ${max} 个字符。`);
  let length = 0;
  for (const _ of value) if (++length > max) throw new UserFacingError(`${name}最多 ${max} 个字符。`);
  return value;
}
export function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new UserFacingError(`${name}应在 ${min}–${max} 之间。`);
  return value;
}
export function articleFields(a) {
  return {
    title: String(a.title ?? ''), author: String(a.author ?? ''), digest: String(a.digest ?? ''),
    content: String(a.content ?? ''), thumb_media_id: String(a.thumb_media_id ?? ''),
    content_source_url: String(a.content_source_url ?? ''), need_open_comment: Number(a.need_open_comment ?? 0),
    only_fans_can_comment: Number(a.only_fans_can_comment ?? 0),
  };
}
export function validateArticle(value) {
  const a = object(value), content = str(a.content, '正文 HTML', 20000);
  const keys = Object.keys(articleFields({}));
  if (Object.keys(a).some(k => !keys.includes(k))) throw new UserFacingError('文章含有不支持的字段。');
  if (Buffer.byteLength(content) > 1024 * 1024) throw new UserFacingError('正文不能超过 1 MiB。');
  if (/<\s*(?:script|iframe|object|embed|form|input|button|link|style|base)\b/i.test(content) || /\bon\w+\s*=/i.test(content) || /(?:javascript|vbscript)\s*:/i.test(content)) {
    throw new UserFacingError('正文请使用静态 HTML 和内联样式，移除脚本和表单。');
  }
  for (const match of content.matchAll(/<img\b[^>]*>/gi)) {
    const src = match[0].match(/\s+src\s*=\s*(["'])(.*?)\1/i);
    if (!src || /\s+srcset\s*=/i.test(match[0])) throw new UserFacingError('正文图片请使用带引号的微信 src 地址，不使用 srcset。');
    let url;
    try { url = new URL(src[2]); } catch { throw new UserFacingError('正文图片请先上传到微信。'); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !/(?:^|\.)(?:qpic\.cn|qlogo\.cn|weixin\.qq\.com)$/.test(url.hostname)) {
      throw new UserFacingError('正文图片请先上传到微信，再使用返回的微信图片 URL。');
    }
  }
  const source = str(a.content_source_url, '原文地址', 2000, false);
  if (source) {
    let url;
    try { url = new URL(source); } catch { throw new UserFacingError('原文地址应为完整的 HTTP/HTTPS URL。'); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new UserFacingError('原文地址应为 HTTP/HTTPS URL。');
  }
  return {
    title: str(a.title, '标题', 64), author: str(a.author, '作者', 16, false), digest: str(a.digest, '摘要', 120, false),
    content, thumb_media_id: str(a.thumb_media_id, '封面素材 ID', 1024), content_source_url: source,
    need_open_comment: integer(a.need_open_comment ?? 0, '评论开关', 0, 1),
    only_fans_can_comment: integer(a.only_fans_can_comment ?? 0, '粉丝评论开关', 0, 1),
  };
}
export function imageType(bytes) {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  throw new UserFacingError('请选择真实的 JPEG 或 PNG 图片。');
}
export async function readLimited(body, max) {
  if (!body) throw new UserFacingError('响应内容为空。');
  const reader = body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new UserFacingError('响应内容超过大小限制。');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks, size);
}
