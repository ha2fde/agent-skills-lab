import { parseDocument } from "htmlparser2";
import { isTag, type AnyNode } from "domhandler";
import { textContent } from "domutils";
import { UserFacingError } from "./errors";
import { object, str, type Article } from "./wechat-validation";

export const FORMAT_VERSION = "mobile-theme-v2";
export type ArticleTheme = { background_color: string; text_color: string; heading_color: string; accent_color: string; font_family: "system" | "serif"; body_size: number; heading_size: number; line_height: number };
const defaultTheme: ArticleTheme = { background_color:"#ffffff", text_color:"#17283f", heading_color:"#17283f", accent_color:"#c4a46a", font_family:"system", body_size:18, heading_size:23, line_height:1.85 };
export function resolveTheme(value: unknown): ArticleTheme {
  if (value === undefined) return { ...defaultTheme };
  const input = object(value);
  if (Object.keys(input).some(k => !(k in defaultTheme))) throw new UserFacingError("排版主题包含不支持的字段。");
  const result = { ...defaultTheme };
  for (const key of ["background_color","text_color","heading_color","accent_color"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(input[key])) throw new UserFacingError(`排版主题 ${key} 需要六位十六进制颜色。`);
    result[key] = input[key].toLowerCase();
  }
  if (input.font_family !== undefined) {
    if (input.font_family !== "system" && input.font_family !== "serif") throw new UserFacingError("排版字体仅支持 system 或 serif。");
    result.font_family = input.font_family;
  }
  for (const [key,min,max] of [["body_size",14,22],["heading_size",18,30],["line_height",1.5,2.2]] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < min || input[key] > max || (key !== "line_height" && !Number.isInteger(input[key]))) throw new UserFacingError(`排版主题 ${key} 超出允许范围。`);
    result[key] = input[key];
  }
  return result;
}
const wrap = "max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-wrap:break-word;word-break:normal;";
function themeStyles(t: ArticleTheme): Record<string, string> {
  const font = t.font_family === "serif" ? 'Georgia,"Songti SC","Noto Serif CJK SC",serif' : '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  const body = `font-size:${t.body_size}px;line-height:${t.line_height};`;
  return {
  section: wrap + body + `color:${t.text_color};background-color:${t.background_color};font-family:${font};`,
  p: wrap + body + "margin:0 0 22px;",
  h2: wrap + `font-size:${t.heading_size}px;line-height:1.5;color:${t.heading_color};margin:40px 0 22px;font-weight:700;`,
  h3: wrap + `font-size:${Math.max(18,t.heading_size-2)}px;line-height:1.5;color:${t.heading_color};margin:32px 0 20px;font-weight:700;`,
  strong: `font-weight:700;color:${t.heading_color};`,
  em: "font-style:italic;", span: wrap,
  a: wrap + `color:${t.heading_color};text-decoration:underline;`,
  pre: wrap + "font-size:15px;line-height:1.85;white-space:pre-wrap;margin:20px 0;padding:16px;background-color:#f5f3ef;",
  code: wrap + "font-size:15px;white-space:pre-wrap;",
  blockquote: wrap + `margin:24px 0;padding:18px;background-color:${t.background_color};color:${t.text_color};`,
  ul: wrap + "padding-left:24px;margin:0 0 22px;", ol: wrap + "padding-left:24px;margin:0 0 22px;",
  li: wrap + body + "margin:0 0 12px;",
  img: "max-width:100%;width:100%;height:auto;display:block;margin:24px auto;",
  hr: `border:0;border-top:1px solid ${t.accent_color};margin:28px 0;`, br: "",
  table: wrap + "width:100%;table-layout:fixed;border-collapse:collapse;font-size:16px;margin:24px 0;",
  thead: "", tbody: "", tr: "", th: wrap + "padding:8px;background-color:#f5f3ef;", td: wrap + "padding:8px;border-bottom:1px solid #ddd;",
  };
}
export const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function httpUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new UserFacingError("排版校验：链接必须为完整的 HTTP/HTTPS 地址。"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new UserFacingError("排版校验：链接协议或凭据无效。");
  return value;
}
export function wechatImageUrl(value: string) {
  const u = new URL(httpUrl(value));
  if (!/(?:^|\.)(?:qpic\.cn|qlogo\.cn|weixin\.qq\.com)$/.test(u.hostname)) throw new UserFacingError("排版校验：正文图片必须先上传微信。");
  return value;
}
export function normalizeHtml(content: string, theme?: unknown): string {
  if (content.length > 100000) throw new UserFacingError("排版校验：正文过长。");
  const t = resolveTheme(theme), styles = themeStyles(t);
  const document = parseDocument(content, { decodeEntities: true });
  function render(node: AnyNode): string {
    if (node.type === "text") return escapeHtml(node.data);
    if (node.type === "comment") return "";
    if (!isTag(node)) return "";
    let tag = node.name.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "base", "svg", "video", "audio", "meta"].includes(tag)) throw new UserFacingError("排版校验：只接受静态 HTML 和内联 CSS，移除脚本、表单及嵌入内容。");
    if (Object.keys(node.attribs).some(k => /^on/i.test(k))) throw new UserFacingError("排版校验：正文不允许事件处理器。");
    if (tag === "h1") tag = "h2";
    if (tag === "b") tag = "strong";
    if (tag === "div" || tag === "article") tag = "section";
    if (!(tag in styles)) throw new UserFacingError("排版校验：正文含不支持的 HTML 标签。");
    let style = styles[tag];
    // Retain emphasis without accepting arbitrary positioning, URLs or sizing.
    if (/color\s*:\s*#c4a46a\b/i.test(node.attribs.style ?? "")) style += `color:${t.accent_color};`;
    if (/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(node.attribs.style ?? "")) style += "font-weight:700;";
    let attrs = style ? ` style="${style}"` : "";
    if (tag === "a") attrs += ` href="${escapeHtml(httpUrl(node.attribs.href ?? ""))}"`;
    if (tag === "img") attrs += ` src="${escapeHtml(wechatImageUrl(node.attribs.src ?? node.attribs["data-src"] ?? ""))}" alt="${escapeHtml(node.attribs.alt ?? "")}"`;
    if (tag === "img" || tag === "br" || tag === "hr") return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${node.children.map(render).join("")}</${tag}>`;
  }
  const html = document.children.map(render).join("");
  if (!textContent(document).trim()) throw new UserFacingError("排版校验：正文没有文字。");
  return `<section style="${styles.section}">${html}</section>`;
}
export function prepareHtml(content: string, format: unknown, references: unknown = [], placeholders = new Map<string, string>(), theme?: unknown) {
  let html = format === "text" ? content.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") : content;
  for (const [id, url] of placeholders) html = html.split(`{{image:${id}}}`).join(`<img src="${escapeHtml(url)}" alt="${escapeHtml(id)}">`);
  if (/\{\{image:/.test(html)) throw new UserFacingError("排版校验：正文图片占位符没有对应图片。");
  if (!Array.isArray(references) || references.length > 50) throw new UserFacingError("排版校验：参考资料应为最多 50 项的数组。");
  const refNodes = references.map(r => { const v = object(r); return { title: str(v.title, "资料标题", 240), url: httpUrl(str(v.url, "资料链接", 2000)) }; });
  const plain = textContent(parseDocument(html));
  const citations = Array.from(plain.matchAll(/\[(\d+)\]/g), m => Number(m[1]));
  if (refNodes.length && citations.some(n => n < 1 || n > refNodes.length)) throw new UserFacingError("排版校验：正文引用编号超出参考资料范围。");
  if (!refNodes.length && citations.length) {
    const n = Math.max(...citations);
    if (n > 50 || Array.from({ length: n }, (_, i) => i + 1).some(i => !citations.includes(i))) throw new UserFacingError("排版校验：参考编号必须从 [1] 开始连续；建议使用 references 数组自动生成。");
  }
  if (refNodes.length) html += "<h2>参考资料</h2>" + refNodes.map((r, i) => `<p>[${i + 1}] <a href="${escapeHtml(r.url)}">${escapeHtml(r.title)} · ${escapeHtml(r.url)}</a></p>`).join("");
  return normalizeHtml(html, theme);
}
function imageIdentity(value: string) {
  try {
    const u=new URL(value);
    if (/(?:^|\.)qpic\.cn$/.test(u.hostname)) {
      u.protocol="https:";
      u.pathname=u.pathname.replace(/\/(?:0|100|132|200|300|640|1080)$/,"/image");
      for(const key of ["from","wx_fmt","wxfrom","wx_lazy","tp"]) u.searchParams.delete(key);
      u.searchParams.sort();
    }
    return u.toString();
  } catch { return value; }
}
function surface(content: string) {
  const d = parseDocument(content, { decodeEntities: true });
  const images: string[] = [], links: string[] = [], headings: string[] = [], emphasis: string[] = [];
  let unsafe = false, bodyStyle = false, headingStyle = true, wrapStyle = true;
  const visualStyles: Record<string,string>[] = [];
  const walk = (nodes: AnyNode[]) => nodes.forEach(n => {
    if (!isTag(n)) return;
    const s = n.attribs.style ?? "";
    if (["section","p","h2","h3","strong","span","em","li","a","pre","code","blockquote","hr","th","td"].includes(n.name)) {
      const props: Record<string,string> = {};
      for (const part of s.split(";")) { const pos=part.indexOf(":"); if(pos<0) continue; const key=part.slice(0,pos).trim().toLowerCase(); if(["color","background-color","font-family","font-size","line-height","border-top"].includes(key)) props[key]=part.slice(pos+1).trim().toLowerCase().replace(/\s+/g," "); }
      visualStyles.push(props);
    }
    if (n.name === "img") images.push(imageIdentity(n.attribs.src ?? n.attribs["data-src"] ?? ""));
    if (n.name === "a") links.push(n.attribs.href ?? "");
    if (n.name === "h2") { headings.push(textContent(n)); headingStyle &&= /font-size:\s*(?:1[8-9]|2\d|30)px/i.test(s); }
    if (n.name === "strong" || n.name === "b") emphasis.push(textContent(n));
    if (/font-size:\s*(?:1[4-9]|2[0-2])px/i.test(s) && /line-height:\s*(?:1\.[5-9]\d*|2(?:\.\d+)?)/.test(s)) bodyStyle = true;
    if (["a", "pre", "code"].includes(n.name)) wrapStyle &&= /(?:overflow-wrap:\s*anywhere|word-wrap:\s*break-word)/.test(s);
    if (["script", "iframe", "style", "form"].includes(n.name)) unsafe = true;
    walk(n.children);
  }); walk(d.children);
  return { text: textContent(d).replace(/\s+/g, " ").trim(), images, links, headings, emphasis, visualStyles, safe: !unsafe, bodyStyle, headingStyle, wrapStyle };
}
export function verifyArticle(expected: Article, actual: Article) {
  const a = surface(expected.content), b = surface(actual.content);
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  const checks = { title: expected.title === actual.title, digest: expected.digest === actual.digest, cover: expected.thumb_media_id === actual.thumb_media_id,
    author: expected.author === actual.author, source_url: expected.content_source_url === actual.content_source_url,
    text: a.text === b.text, images: same(a.images, b.images), links: same(a.links, b.links), headings: same(a.headings, b.headings), emphasis: same(a.emphasis, b.emphasis),
    mobile_styles: b.bodyStyle && b.headingStyle && b.wrapStyle, visual_style: same(a.visualStyles,b.visualStyles), static_html: b.safe };
  return { verified: Object.values(checks).every(Boolean), checks, html_exact_match: expected.content === actual.content, phone_preview_checked: false };
}
