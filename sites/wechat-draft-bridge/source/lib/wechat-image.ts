import { UserFacingError } from "./errors";
import { str } from "./wechat-validation";
import { imageSize } from "image-size";
import jpeg from "jpeg-js";
import decodePng, { init as initPng } from "@jsquash/png/decode.js";
import pngWasm from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm?module";
import { GifReader } from "omggif";
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import webpWasm from "@jsquash/webp/codec/dec/webp_dec.wasm?module";

export const MAX_INLINE_IMAGE_BYTES = 128 * 1024;
export const MAX_INLINE_BASE64_LENGTH = 4 * Math.ceil(MAX_INLINE_IMAGE_BYTES / 3);
const MAX_INPUT = 10 * 1024 * 1024;
const MAX_PIXELS = 4_000_000;
let webpReady: Promise<void> | undefined;
let pngReady: ReturnType<typeof initPng> | undefined;
export function decodeInlineImage(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value.length) throw new UserFacingError("图片获取：请提供 image_url 或 image_base64。");
  if (value.length > MAX_INLINE_BASE64_LENGTH) throw new UserFacingError("图片获取：对话内 Base64 图片限 128 KiB，请压缩或使用 HTTPS 图片链接。");
  let binary: string;
  try {
    if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error();
    binary = atob(value);
    if (btoa(binary) !== value) throw new Error();
  } catch { throw new UserFacingError("图片获取：Base64 无效，请使用原始字节的标准 Base64，不带 data: 前缀。"); }
  if (binary.length > MAX_INLINE_IMAGE_BYTES) throw new UserFacingError("图片获取：Base64 图片限 128 KiB。");
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export function imageSourceUrl(value: unknown): URL {
  let url: URL;
  try { url = new URL(str(value, "图片链接", 8192)); } catch { throw new UserFacingError("图片获取：需要完整的公网 HTTPS 图片地址。"); }
  const h = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || h.includes(":") ||
    /^(?:\d+\.){3}\d+$/.test(h) || !h.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|arpa)$/.test(h)) throw new UserFacingError("图片获取：仅允许公网 HTTPS 域名，禁止 IP、内网、凭据和自定义端口。");
  return url;
}
function publicIp(ip: string): boolean {
  if (ip.includes(":")) return /^[23][0-9a-f]{0,3}:/i.test(ip) && !/^2001:(?:db8|0|10|20):/i.test(ip) && !/^2002:/i.test(ip);
  const n = ip.split(".").map(Number);
  if (n.length !== 4 || n.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a,b] = n;
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0));
}
async function verifyPublicDns(host: string) {
  try {
    const answers = await Promise.all(["A", "AAAA"].map(async type => {
      const u = new URL("https://cloudflare-dns.com/dns-query"); u.searchParams.set("name", host); u.searchParams.set("type", type);
      const r = await fetch(u, { headers: { Accept: "application/dns-json" }, redirect: "manual", signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error();
      const body = await r.json() as { Status?: number; Answer?: { type: number; data: string }[] };
      if (body.Status !== 0) throw new Error();
      return (body.Answer ?? []).filter(x => x.type === 1 || x.type === 28).map(x => x.data);
    }));
    const ips = answers.flat();
    if (!ips.length || ips.some(x => !publicIp(x))) throw new Error();
  } catch { throw new UserFacingError("图片获取：域名无法安全解析为公网地址；请改用 Base64 或其他公网图片链接。"); }
}
export async function imageFromArgs(args: Record<string, unknown>): Promise<Uint8Array> {
  const inline = args.image_base64 !== undefined, remote = args.image_url !== undefined;
  if (inline === remote) throw new UserFacingError("图片获取：image_url 和 image_base64 请选择一个提供。");
  if (inline) return decodeInlineImage(args.image_base64);
  const url = imageSourceUrl(args.image_url);
  await verifyPublicDns(url.hostname);
  let response: Response;
  try { response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) }); }
  catch { throw new UserFacingError("图片获取：网络错误或下载超时，请检查链接有效期。"); }
  if (!response.ok || !response.body) throw new UserFacingError(`图片获取：下载返回 HTTP ${response.status}；不跟随重定向，请提供最终图片链接。`);
  const type = response.headers.get("content-type")?.split(";")[0].trim();
  if (type && !type.startsWith("image/") && type !== "application/octet-stream") throw new UserFacingError("图片获取：返回内容不是图片，请使用直接下载链接而非分享网页。");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (Number(response.headers.get("content-length") ?? 0) > MAX_INPUT) throw new UserFacingError("图片获取：输入图片超过 10 MiB 大小限制。");
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_INPUT) throw new UserFacingError("图片获取：输入图片超过 10 MiB 大小限制。");
      chunks.push(value);
    }
  } catch(e) { if (e instanceof UserFacingError) throw e; throw new UserFacingError("图片获取：读取图片时网络中断。"); }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return bytes;
}
export async function prepareImage(bytes: Uint8Array, purpose: string) {
  if (purpose !== "cover" && purpose !== "body") throw new UserFacingError("图片校验：用途请选择 cover 或 body。");
  if (!bytes.length || bytes.length > MAX_INPUT) throw new UserFacingError("图片校验：输入需为 1 byte–10 MiB。");
  let dimensions: ReturnType<typeof imageSize>;
  try { dimensions = imageSize(bytes); } catch { throw new UserFacingError("图片校验：无法识别或损坏的图片。"); }
  const { width, height, type, orientation } = dimensions;
  if (!width || !height || width < 8 || height < 8 || width * height > MAX_PIXELS || width > 8192 || height > 8192) throw new UserFacingError("图片校验：尺寸须至少 8×8，最多 400 万像素，单边不超过 8192。");
  if (!["jpg", "png", "gif", "webp"].includes(type ?? "")) throw new UserFacingError("图片转换：支持 JPEG、PNG、静态 GIF 和 WebP；其他格式请先转换。");
  if ((type === "webp" && Buffer.from(bytes).includes(Buffer.from("ANIM"))) || (type === "png" && Buffer.from(bytes).includes(Buffer.from("acTL")))) throw new UserFacingError("图片转换：不自动丢弃动画帧，请提供静态图片。");
  let raw: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
  try {
    if (type === "jpg") raw = jpeg.decode(bytes, { useTArray: true, tolerantDecoding: false, maxResolutionInMP: 4, maxMemoryUsageInMB: 48 });
    else if (type === "png") {
      pngReady ??= initPng(pngWasm); await pngReady;
      raw = await decodePng(Uint8Array.from(bytes).buffer as ArrayBuffer);
    } else if (type === "gif") {
      const reader = new GifReader(Buffer.from(bytes));
      if (reader.numFrames() !== 1) throw new UserFacingError("图片转换：不自动丢弃动画帧，请先选择静态帧。");
      const data = new Uint8Array(width * height * 4); reader.decodeAndBlitFrameRGBA(0, data); raw = { width, height, data };
    } else {
      webpReady ??= initWebp(webpWasm as unknown as Parameters<typeof initWebp>[0]); await webpReady;
      raw = await decodeWebp(Uint8Array.from(bytes).buffer as ArrayBuffer);
    }
  } catch (e) { if (e instanceof UserFacingError) throw e; throw new UserFacingError("图片转换：完整解码失败，图片可能损坏或格式不受支持。"); }
  if (raw.width !== width || raw.height !== height || raw.data.length !== width*height*4) throw new UserFacingError("图片校验：解码后的尺寸与文件头不一致。");
  const rotated = orientation && orientation >= 5 && orientation <= 8;
  const ow = rotated ? height : width, oh = rotated ? width : height;
  const scale = Math.min(1, (purpose === "cover" ? 900 : 1280) / ow);
  const w = Math.max(8, Math.round(ow * scale)), h = Math.max(8, Math.round(oh * scale));
  const pixels = new Uint8Array(w * h * 4);
  for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const ox = Math.min(ow-1,Math.floor(x/scale)), oy = Math.min(oh-1,Math.floor(y/scale));
    let sx=ox, sy=oy;
    switch(orientation) { case 2: sx=width-1-ox;break; case 3:sx=width-1-ox;sy=height-1-oy;break;case 4:sy=height-1-oy;break;case 5:sx=oy;sy=ox;break;case 6:sx=oy;sy=height-1-ox;break;case 7:sx=width-1-oy;sy=height-1-ox;break;case 8:sx=width-1-oy;sy=ox;break; }
    const s=(sy*width+sx)*4,t=(y*w+x)*4,a=raw.data[s+3]/255;
    for(let k=0;k<3;k++) pixels[t+k]=Math.round(raw.data[s+k]*a+255*(1-a)); pixels[t+3]=255;
  }
  const max = purpose === "cover" ? 10*1024*1024 : 1024*1024;
  let output: Uint8Array = jpeg.encode({width:w,height:h,data:pixels},85).data;
  if(output.length>max) output=jpeg.encode({width:w,height:h,data:pixels},65).data;
  if(output.length>max) throw new UserFacingError("图片转换：压缩后仍超出微信用途对应的大小限制，请降低尺寸。");
  const digest=await crypto.subtle.digest("SHA-256",output as BufferSource);
  return { bytes:output, metadata:{format:"jpeg",source_format:type,width:w,height:h,bytes:output.length,input_bytes:bytes.length,sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join(""),converted:true,cropped:false,orientation_applied:orientation??1} };
}
