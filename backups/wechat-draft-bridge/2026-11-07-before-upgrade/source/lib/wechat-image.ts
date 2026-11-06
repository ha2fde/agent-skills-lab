import { UserFacingError } from "./errors";
import { imageType, str } from "./wechat-validation";

// Keep binary data out of large chat tool arguments. Use a short signed URL for
// larger images; the private settings form still accepts a binary file upload.
export const MAX_INLINE_IMAGE_BYTES = 128 * 1024;
export const MAX_INLINE_BASE64_LENGTH = 4 * Math.ceil(MAX_INLINE_IMAGE_BYTES / 3);

export function decodeInlineImage(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value.length) throw new UserFacingError("请提供图片链接，或小图片的 Base64。");
  if (value.length > MAX_INLINE_BASE64_LENGTH) throw new UserFacingError("对话内 Base64 图片限 128 KiB。请压缩图片，或改用 image_url / 私有设置页的文件上传，避免过大的工具请求。");
  let binary: string;
  try {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error();
    binary = atob(value);
  } catch { throw new UserFacingError("图片 Base64 无效，请使用不带 data: 前缀的内容。"); }
  if (binary.length > MAX_INLINE_IMAGE_BYTES) throw new UserFacingError("对话内 Base64 图片限 128 KiB，请压缩或使用图片链接。");
  // Uint8Array.from(string, mapper) creates a very large intermediate array.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  imageType(bytes);
  return bytes;
}

export function imageSourceUrl(value: unknown): URL {
  const source = str(value, "图片链接", 8192);
  let url: URL;
  try { url = new URL(source); } catch { throw new UserFacingError("图片链接必须是完整的 HTTPS 地址。"); }
  const hostname = url.hostname.toLowerCase();
  const permitted = hostname.endsWith(".oaiusercontent.com") ||
    /^oaisd[a-z0-9-]+\.blob\.core\.windows\.net$/.test(hostname) ||
    /^oaisdmntpr[a-z0-9-]*aws\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(hostname);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !permitted) {
    throw new UserFacingError("image_url 仅支持 ChatGPT 图片文件的 HTTPS 下载链接；其他来源请压缩后用 Base64，或在私有设置页上传文件。");
  }
  return url;
}

export async function imageFromArgs(args: Record<string, unknown>): Promise<Uint8Array> {
  const inline = args.image_base64 !== undefined, remote = args.image_url !== undefined;
  if (inline === remote) throw new UserFacingError("image_url 和 image_base64 请选择一个提供。");
  if (inline) return decodeInlineImage(args.image_base64);
  const url = imageSourceUrl(args.image_url);
  const max = args.purpose === "body" ? 1024 * 1024 : 10 * 1024 * 1024;
  let response: Response;
  try { response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) }); }
  catch { throw new UserFacingError("图片下载失败，请使用仍然有效的下载链接。"); }
  if (!response.ok || !response.body) throw new UserFacingError(`图片下载返回 HTTP ${response.status}，请更新链接；不跟随重定向。`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (Number(response.headers.get("content-length") ?? 0) > max) throw new UserFacingError("图片超过微信用途对应的大小限制。");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) throw new UserFacingError("图片超过微信用途对应的大小限制。");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  imageType(bytes);
  return bytes;
}
