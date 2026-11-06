import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { imageType, readLimited, str, UserFacingError } from './validation.mjs';

export const MAX_INLINE_IMAGE_BYTES = 128 * 1024;
export const MAX_INLINE_BASE64_LENGTH = 4 * Math.ceil(MAX_INLINE_IMAGE_BYTES / 3);

export function imageSourceUrl(value) {
  let url;
  try { url = new URL(str(value, '图片链接', 8192)); } catch { throw new UserFacingError('图片链接必须是完整的 HTTPS 地址。'); }
  const host = url.hostname.toLowerCase();
  const allowed = host.endsWith('.oaiusercontent.com') || /^oaisd[a-z0-9-]+\.blob\.core\.windows\.net$/.test(host) ||
    /^oaisdmntpr[a-z0-9-]*aws\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !allowed) {
    throw new UserFacingError('image_url 仅接受 ChatGPT 图片文件下载域名；其他图片请放入 WECHAT_IMAGE_ROOT 并使用 image_path。');
  }
  return url;
}
export async function imageFromArgs(args, imageRoot, fetcher = fetch) {
  if (['image_url', 'image_base64', 'image_path'].filter(k => args[k] !== undefined).length !== 1) throw new UserFacingError('image_url、image_base64 和 image_path 必须且只能提供一种。');
  const max = args.purpose === 'body' ? 1024 * 1024 : 10 * 1024 * 1024;
  let bytes;
  if (args.image_base64 !== undefined) {
    const value = args.image_base64;
    if (typeof value !== 'string' || !value.length || value.length > MAX_INLINE_BASE64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
      throw new UserFacingError('Base64 无效或过大；对话内原图上限为 128 KiB，不带 data: 前缀。');
    }
    bytes = Buffer.from(value, 'base64');
    if (bytes.length > MAX_INLINE_IMAGE_BYTES) throw new UserFacingError('对话内原图限 128 KiB，请改用图片文件或下载链接。');
  } else if (args.image_path !== undefined) {
    if (!imageRoot) throw new UserFacingError('本地图片读取未启用，请由部署者设置 WECHAT_IMAGE_ROOT。');
    const name = str(args.image_path, '图片相对路径', 1024);
    if (isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new UserFacingError('image_path 必须是图片目录内的相对路径。');
    const root = await realpath(imageRoot), path = await realpath(resolve(root, name));
    const inside = relative(root, path);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new UserFacingError('图片路径超出授权目录。');
    const file = await open(path, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > max) throw new UserFacingError('图片不是普通文件或超过大小限制。');
      // Bounded read even if another local process grows the file after stat().
      bytes = Buffer.alloc(max + 1);
      let total = 0;
      while (total < bytes.length) {
        const { bytesRead } = await file.read(bytes, total, bytes.length - total, null);
        if (!bytesRead) break;
        total += bytesRead;
      }
      bytes = bytes.subarray(0, total);
    } finally { await file.close(); }
  } else {
    const url = imageSourceUrl(args.image_url);
    let response;
    try { response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) }); }
    catch { throw new UserFacingError('图片下载失败，请更新有效的下载链接。'); }
    if (!response.ok || !response.body) throw new UserFacingError('图片下载失败；不跟随重定向。');
    if (Number(response.headers.get('content-length') ?? 0) > max) { await response.body.cancel(); throw new UserFacingError('图片超过大小限制。'); }
    bytes = await readLimited(response.body, max);
  }
  if (!bytes.length || bytes.length > max) throw new UserFacingError('图片超过用途对应的大小限制：封面 10 MiB，正文 1 MiB。');
  imageType(bytes);
  return bytes;
}
