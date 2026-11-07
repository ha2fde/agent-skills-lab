import { parseDocument } from "htmlparser2";
import { isTag, type AnyNode } from "domhandler";
import { textContent } from "domutils";
import { UserFacingError } from "./errors";
import { object, str, type Article } from "./wechat-validation";

export const FORMAT_VERSION = "mobile-style-v4";
export type ArticleTheme = { background_color: string; text_color: string; heading_color: string; accent_color: string; font_family: "system" | "serif"; body_size: number; heading_size: number; line_height: number };
const defaultTheme: ArticleTheme = { background_color:"#ffffff", text_color:"#4c5665", heading_color:"#506d92", accent_color:"#946b30", font_family:"system", body_size:18, heading_size:23, line_height:1.85 };
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
function safeInlineStyle(input: string, tag: string): string {
  const accepted: string[] = [];
  for (const part of input.split(";")) {
    const pos = part.indexOf(":"); if (pos < 0) continue;
    const key = part.slice(0,pos).trim().toLowerCase(), value = part.slice(pos+1).trim();
    if (!value || /[!;{}<>\\]/.test(value) || /url\s*\(|var\s*\(|expression\s*\(/i.test(value)) continue;
    if (["color","background-color"].includes(key) && /^#[0-9a-fA-F]{6}$/.test(value)) accepted.push(`${key}:${value.toLowerCase()};`);
    else if (key === "font-family" && /^(?:Georgia|serif|sans-serif|system-ui|"?(?:PingFang SC|Microsoft YaHei|Songti SC)"?)(?:\s*,\s*(?:Georgia|serif|sans-serif|system-ui|"?(?:PingFang SC|Microsoft YaHei|Songti SC)"?))*$/i.test(value)) accepted.push(`${key}:${value};`);
    else if (key === "font-size" && /^\d{2}px$/.test(value)) {
      const size=Number.parseInt(value,10), min=["h2","h3"].includes(tag)?18:14, max=["h2","h3"].includes(tag)?30:22;
      if (size>=min && size<=max) accepted.push(`${key}:${size}px;`);
    } else if (key === "line-height" && /^(?:1\.[5-9]\d?|2(?:\.[0-2]\d?)?)$/.test(value) && Number(value)<=2.2) accepted.push(`${key}:${value};`);
    else if (key === "font-weight" && /^(?:bold|normal|[4-8]00)$/.test(value)) accepted.push(`${key}:${value};`);
    else if (key === "text-align" && /^(?:left|center|right)$/.test(value)) accepted.push(`${key}:${value};`);
    else if (["margin-top","margin-bottom","padding-top","padding-bottom","padding-left","padding-right"].includes(key) && /^(?:0|[1-9]\d?)px$/.test(value) && Number.parseInt(value,10)<=48) accepted.push(`${key}:${value};`);
  }
  return accepted.join("");
}
function themeStyles(t: ArticleTheme, explicitBackground: boolean): Record<string, string> {
  const font = t.font_family === "serif" ? 'Georgia,"Songti SC","Noto Serif CJK SC",serif' : '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  const body = `font-size:${t.body_size}px;line-height:${t.line_height};`;
  return {
  section: wrap + body + `color:${t.text_color};font-family:${font};` + (explicitBackground ? `background-color:${t.background_color};` : ""),
  p: wrap + body + "margin:0 0 22px;",
  h2: wrap + `font-size:${t.heading_size}px;line-height:1.5;color:${t.heading_color};margin:40px 0 22px;font-weight:700;`,
  h3: wrap + `font-size:${Math.max(18,t.heading_size-2)}px;line-height:1.5;color:${t.heading_color};margin:32px 0 20px;font-weight:700;`,
  strong: "font-weight:700;",
  em: "font-style:italic;", span: wrap,
  a: wrap + `color:${t.heading_color};text-decoration:underline;`,
  pre: wrap + "font-size:15px;line-height:1.85;white-space:pre-wrap;margin:20px 0;padding:16px;",
  code: wrap + "font-size:15px;white-space:pre-wrap;",
  blockquote: wrap + `margin:24px 0;padding:18px;`,
  ul: wrap + "padding-left:24px;margin:0 0 22px;", ol: wrap + "padding-left:24px;margin:0 0 22px;",
  li: wrap + body + "margin:0 0 12px;",
  img: "max-width:100%;width:100%;height:auto;display:block;margin:24px auto;",
  hr: `border:0;border-top:1px solid ${t.accent_color};margin:28px 0;`, br: "",
  table: wrap + "width:100%;table-layout:fixed;border-collapse:collapse;font-size:16px;margin:24px 0;",
  thead: "", tbody: "", tr: "", th: wrap + "padding:8px;", td: wrap + "padding:8px;border-bottom:1px solid #ddd;",
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

function css(style: string) {
  const props = new Map<string, string>();
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon >= 0) props.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim().toLowerCase().replace(/\s+/g, " "));
  }
  return props;
}

function luminance(color: string) {
  const hex = color.match(/^#([a-f0-9]{6}|[a-f0-9]{3})$/i)?.[1];
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  const values = hex ? (hex.length === 3 ? [...hex].map(x => x + x) : hex.match(/../g)!).map(x => parseInt(x, 16))
    : rgb?.slice(1).map(Number);
  if (!values || values.some(v => v > 255)) return undefined;
  const [r, g, b] = values.map(v => {
    const channel = v / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOk(foreground: string, background: string) {
  const fg = luminance(foreground), bg = luminance(background);
  return fg !== undefined && bg !== undefined && (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) >= 4.5;
}

function pseudoDiagram(value: string) {
  const arrows = /(?:-{1,3}>|={1,3}>|[→⇒➜➝⟶↓⇓←↔])/g;
  return (value.match(arrows)?.length ?? 0) >= 2 || /[┌┐└┘├┤┬┴┼╔╗╚╝╠╣]/.test(value) || /(?:^|\n)\s*\+(?:[-=]{2,}\+)+/.test(value);
}

export function normalizeHtml(content: string, theme?: unknown): string {
  if (content.length > 100000) throw new UserFacingError("排版校验：正文过长。");
  const t = resolveTheme(theme), styles = themeStyles(t, theme !== undefined && object(theme).background_color !== undefined);
  const document = parseDocument(content, { decodeEntities: true });
  function render(node: AnyNode, fg: string, bg: string, code = false): string {
    if (node.type === "text") {
      if (node.data.trim() && !contrastOk(fg, bg)) throw new UserFacingError("排版校验：文字与背景对比度至少须为 4.5:1。请调整颜色。");
      if (!code && pseudoDiagram(node.data)) throw new UserFacingError("排版校验：请把文本箭头流程图改为清晰的独立图片。");
      return escapeHtml(node.data);
    }
    if (node.type === "comment") return "";
    if (!isTag(node)) return "";
    let tag = node.name.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "base", "svg", "video", "audio", "meta"].includes(tag)) throw new UserFacingError("排版校验：只接受静态 HTML 和内联 CSS，移除脚本、表单及嵌入内容。");
    if (Object.keys(node.attribs).some(k => /^on/i.test(k))) throw new UserFacingError("排版校验：正文不允许事件处理器。");
    if (tag === "h1") tag = "h2";
    if (tag === "b") tag = "strong";
    if (tag === "div" || tag === "article") tag = "section";
    if (!(tag in styles)) throw new UserFacingError("排版校验：正文含不支持的 HTML 标签。");
    const inline = safeInlineStyle(node.attribs.style ?? "", tag);
    if (css(inline).has("background-color") && !["section","blockquote","pre","th","td"].includes(tag))
      throw new UserFacingError("排版校验：段落、标题和行内文字不允许整块底色。请使用清晰的文字颜色和留白。");
    if (["p","h2","h3","pre","li"].includes(tag) && (tag === "pre" ? /[┌┐└┘├┤┼╔╗╚╝]|(?:^|\n)\s*\+(?:[-=]{2,}\+)+/.test(textContent(node)) : pseudoDiagram(textContent(node))))
      throw new UserFacingError("排版校验：检测到文本伪流程图，请改为独立图片。");
    let style = tag === "section" ? wrap + `font-size:${t.body_size}px;line-height:${t.line_height};` : styles[tag];
    // Explicit safe per-article inline styles override fallback typography/palette.
    style += inline;
    const props = css(style);
    const nextFg = props.get("color") ?? fg, nextBg = props.get("background-color") ?? bg;
    let attrs = style ? ` style="${escapeHtml(style)}"` : "";
    if (tag === "a") attrs += ` href="${escapeHtml(httpUrl(node.attribs.href ?? ""))}"`;
    if (tag === "img") attrs += ` src="${escapeHtml(wechatImageUrl(node.attribs.src ?? node.attribs["data-src"] ?? ""))}" alt="${escapeHtml(node.attribs.alt ?? "")}"`;
    if (tag === "img" || tag === "br" || tag === "hr") return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${node.children.map(child => render(child, nextFg, nextBg, code || tag === "code" || tag === "pre")).join("")}</${tag}>`;
  }
  const html = document.children.map(node => render(node, t.text_color, t.background_color)).join("");
  if (!textContent(document).trim()) throw new UserFacingError("排版校验：正文没有文字。");
  return `<section style="${escapeHtml(styles.section)}">${html}</section>`;
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
    if (["section","p","h2","h3","strong","span","em","li","a","pre","code","blockquote","hr","th","td","img","table","ul","ol"].includes(n.name)) {
      const props: Record<string,string> = {};
      const declarations = css(s);
      for (const key of ["color","background-color","font-family","font-size","line-height","border-top","font-weight","text-align","letter-spacing","word-spacing","width","max-width","height","min-width","white-space","display","position","table-layout","margin","margin-top","margin-bottom","padding","padding-top","padding-bottom","padding-left","padding-right"]) {
        const value = declarations.get(key);
        if (value !== undefined) props[key] = value;
      }
      visualStyles.push(props);
    }
    if (n.name === "img") images.push(imageIdentity(n.attribs.src ?? n.attribs["data-src"] ?? ""));
    if (n.name === "a") links.push(n.attribs.href ?? "");
    if (n.name === "h2") { headings.push(textContent(n)); headingStyle &&= /font-size:\s*(?:1[8-9]|2\d|30)px/i.test(s); }
    if (n.name === "strong" || n.name === "b") emphasis.push(textContent(n));
    if (/font-size:\s*(?:1[4-9]|2[0-2])px/i.test(s) && /line-height:\s*(?:1\.[5-9]\d*|2(?:\.\d+)?)/.test(s)) bodyStyle = true;
    if (["a", "pre", "code"].includes(n.name)) wrapStyle &&= /(?:overflow-wrap:\s*anywhere|word-wrap:\s*break-word)/.test(s);
    if (["script", "iframe", "style", "form", "object", "embed", "svg"].includes(n.name) || Object.keys(n.attribs).some(key => /^on/i.test(key))) unsafe = true;
    walk(n.children);
  }); walk(d.children);
  return { text: textContent(d).replace(/\s+/g, " ").trim(), images, links, headings, emphasis, visualStyles, safe: !unsafe, bodyStyle, headingStyle, wrapStyle };
}
export function verifyArticle(expected: Article, actual: Article) {
  const a = surface(expected.content), b = surface(actual.content);
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  const checks = { title: expected.title === actual.title, digest: expected.digest === actual.digest, cover: expected.thumb_media_id === actual.thumb_media_id,
    author: expected.author === actual.author, comments: expected.need_open_comment === actual.need_open_comment && expected.only_fans_can_comment === actual.only_fans_can_comment, source_url: expected.content_source_url === actual.content_source_url,
    text: a.text === b.text, images: same(a.images, b.images), links: same(a.links, b.links), headings: same(a.headings, b.headings), emphasis: same(a.emphasis, b.emphasis),
    mobile_styles: b.bodyStyle && b.headingStyle && b.wrapStyle, visual_style: same(a.visualStyles,b.visualStyles), static_html: b.safe };
  return { verified: Object.values(checks).every(Boolean), checks, html_exact_match: expected.content === actual.content, phone_preview_checked: false };
}
