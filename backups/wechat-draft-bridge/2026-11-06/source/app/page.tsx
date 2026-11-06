"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown, Circle, FileText, ImagePlus, KeyRound, Link2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";

type Status = {
  configured: boolean; verified: boolean; account: string | null; app_id: string | null; relay_url: string;
  has_app_secret: boolean; has_relay_key: boolean; verified_at: string | null; last_error: string | null;
  operations?: { action: string; state: string; created_at: string; media_id?: string }[];
};
type Asset = { name: string; purpose: string; media_id: string | null; url: string | null };
export default function Home() {
  const [status, setStatus] = useState<Status | null>(null), [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null), [busy, setBusy] = useState("");
  const [label, setLabel] = useState(""), [appId, setAppId] = useState(""), [secret, setSecret] = useState("");
  const [relayUrl, setRelayUrl] = useState(""), [relayKey, setRelayKey] = useState(""), [assets, setAssets] = useState<Asset[]>([]);
  const [purpose, setPurpose] = useState("cover"), [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  async function readStatus(fill = false) {
    const r = await fetch("/api/settings", { cache: "no-store" }), data = await r.json() as Status & { error?: string };
    if (!r.ok) throw new Error(data.error || "无法读取连接状态。");
    setStatus(data);
    if (fill) { setLabel(data.account ?? ""); setAppId(data.app_id ?? ""); setRelayUrl(data.relay_url ?? ""); }
    if (data.configured) {
      const media = await fetch("/api/media", { cache: "no-store" });
      if (media.ok) setAssets(((await media.json()) as { images: Asset[] }).images ?? []);
    }
  }
  useEffect(() => { readStatus(true).catch(e => setNotice({ error: true, text: e.message })).finally(() => setLoading(false)); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy("save"); setNotice(null);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json", "X-Wechat-Client": "settings" }, body: JSON.stringify({ label, app_id: appId, app_secret: secret, relay_url: relayUrl, relay_key: relayKey }) });
      const data = await r.json() as Status & { error?: string }; if (!r.ok) throw new Error(data.error);
      setStatus(data); setSecret(""); setRelayKey(""); setAssets([]);
      setNotice({ text: "凭据已加密保存。点击「检测连接」，核实微信草稿箱权限。" });
    } catch (e) { setNotice({ error: true, text: e instanceof Error ? e.message : "保存失败。" }); }
    finally { setBusy(""); }
  }
  async function check() {
    setBusy("check"); setNotice(null);
    try {
      const r = await fetch("/api/check", { method: "POST", headers: { "X-Wechat-Client": "settings" } }), data = await r.json() as { error?: string; draft_count?: number };
      if (!r.ok) throw new Error(data.error);
      await readStatus(); setNotice({ text: `已连接真实草稿箱，当前有 ${data.draft_count} 条草稿。现在可以在对话中查询草稿。` });
    } catch (e) { setNotice({ error: true, text: e instanceof Error ? e.message : "检测失败。" }); await readStatus().catch(() => {}); }
    finally { setBusy(""); }
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault(); if (!file) return;
    setBusy("upload"); setNotice(null);
    try {
      const body = new FormData(); body.set("image", file); body.set("purpose", purpose);
      const r = await fetch("/api/media", { method: "POST", headers: { "X-Wechat-Client": "settings" }, body }), data = await r.json() as Asset & { error?: string };
      if (!r.ok) throw new Error(data.error);
      await readStatus(); setFile(null); if (fileInput.current) fileInput.current.value = "";
      setNotice({ text: `「${data.name}」已上传到微信，可以在对话中引用这张${purpose === "cover" ? "封面" : "正文图片"}。` });
    } catch (e) { setNotice({ error: true, text: e instanceof Error ? e.message : "上传失败。" }); }
    finally { setBusy(""); }
  }
  const verified = status?.verified, configured = status?.configured;
  return <div className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon"><MessageCircle size={21} strokeWidth={1.8}/></span><span>公众号草稿助手</span></a><span className="private"><ShieldCheck size={14}/> 私有连接器</span></header>
    <main>
      <div className="eyebrow">WECHAT · DRAFT ASSISTANT</div>
      <section className="intro"><div><h1>从对话，到草稿箱。</h1><p>把文章、封面和配图交给助手。<br className="mobile-break"/>一次连接，以后直接开口。</p></div><div className={`status-pill ${verified ? "verified" : ""}`}><span/>{loading ? "读取状态中" : verified ? "草稿箱已验证" : configured ? "已配置 · 待检测" : "等待连接公众号"}</div></section>
      <div className="steps" aria-label="连接进度">{[["01", "配置公众号", configured], ["02", "检测连接", verified], ["03", "回到对话使用", verified]].map(([number, title, done], index) => <div className={`step ${done ? "done" : ""}`} key={String(number)}><span className="step-number">{done ? <Check size={14}/> : number}</span><span>{title}</span>{index < 2 && <div className="step-line"/>}</div>)}</div>
      {notice && <div className={`notice ${notice.error ? "error" : ""}`} role="status">{notice.error ? <Circle size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.text}</span></div>}
      <div className="content-grid"><div className="main-column">
        <section className="card connection-card"><div className="card-heading"><span className="section-icon"><KeyRound size={20}/></span><div><h2>连接你的公众号</h2><p>使用公众号后台的开发者凭据。</p></div></div>
          <form onSubmit={save}><label htmlFor="label">公众号名称<span>用于区分账号</span></label><input id="label" value={label} onChange={e => setLabel(e.target.value)} placeholder="例如：山河之间" maxLength={80}/>
            <label htmlFor="app-id">AppID</label><input id="app-id" className="mono" value={appId} onChange={e => setAppId(e.target.value)} placeholder="wx…" autoComplete="off" required maxLength={64}/>
            <label htmlFor="app-secret">AppSecret{status?.has_app_secret && <span className="saved-label"><Check size={12}/> 已保存，留空保留</span>}</label><input id="app-secret" type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder={status?.has_app_secret ? "已加密保存，修改时重新填写" : "填写公众号 AppSecret"} autoComplete="new-password" required={!status?.has_app_secret} maxLength={256}/>
            <details className="advanced"><summary><span><Link2 size={14}/> 固定 IP 转发服务</span><ChevronDown size={15}/></summary><div className="advanced-body"><p>托管连接器不承诺固定出口 IP。若微信提示错误码 40164，请接入固定公网 IP 的转发服务，并在公众号后台添加该服务器的出口 IP。</p><label htmlFor="relay-url">转发服务 HTTPS 地址</label><input id="relay-url" type="url" value={relayUrl} onChange={e => setRelayUrl(e.target.value)} placeholder="https://你的域名/wechat" autoComplete="off"/><label htmlFor="relay-key">转发密钥{status?.has_relay_key && <span>留空保留</span>}</label><input id="relay-key" type="password" value={relayKey} onChange={e => setRelayKey(e.target.value)} autoComplete="new-password" placeholder="至少 32 个字符"/><a className="text-link" href="/relay-guide">查看转发服务部署说明 <ArrowRight size={13}/></a></div></details>
            <div className="form-actions"><button className="primary" type="submit" disabled={!!busy || loading}>{busy === "save" ? <Loader2 size={16} className="spin"/> : <ShieldCheck size={16}/>}加密保存</button><button className="secondary" type="button" onClick={check} disabled={!configured || !!busy}>{busy === "check" ? <Loader2 size={16} className="spin"/> : <Link2 size={16}/>}检测连接</button></div>
            <p className="security-note"><ShieldCheck size={13}/> 密钥只在提交时使用，保存后不再显示。无需把密钥发到聊天中。</p>
          </form>
        </section>
        <section className="card media-card"><div className="card-heading"><span className="section-icon"><ImagePlus size={20}/></span><div><h2>准备封面与配图</h2><p>上传到微信后，助手就能在文章中使用。</p></div></div>
          <form onSubmit={upload}><div className="upload-row"><select aria-label="图片用途" value={purpose} onChange={e => setPurpose(e.target.value)}><option value="cover">文章封面</option><option value="body">正文配图</option></select><label className="file-picker" htmlFor="image-file"><ImagePlus size={17}/><span>{file?.name ?? "选择 JPEG / PNG 图片"}</span></label><input ref={fileInput} id="image-file" type="file" accept="image/jpeg,image/png" className="file-input" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={!configured}/><button className="secondary" disabled={!configured || !file || !!busy} type="submit">{busy === "upload" ? <Loader2 size={16} className="spin"/> : <ArrowDownToLine size={16}/>}上传</button></div><p className="field-hint">封面最大 10 MiB，正文图片最大 1 MiB。不同用途需分别上传。</p></form>
          {assets.length > 0 ? <div className="asset-list">{assets.map((a, i) => <div className="asset" key={i}><span className="asset-icon"><ImagePlus size={15}/></span><div><strong>{a.name}</strong><small>{a.purpose === "cover" ? "文章封面" : "正文配图"} · 已上传到微信</small></div><CheckCircle2 size={16}/></div>)}</div> : <div className="empty-media"><ImagePlus size={25}/><span>上传后，你可以说「用刚上传的图片作封面」。</span></div>}
        </section>
      </div><aside className="side-column">
        <section className="usage-card"><span className="mini-label">连接以后，这样使用</span><div className="quote-icon">“</div><h2>把这篇文章<br/>存进公众号草稿箱。</h2><p>助手准备排版、上传图片，并在保存后读回核验。</p><div className="example"><MessageCircle size={15}/><span>看看草稿箱里有哪些文章</span></div><div className="example"><MessageCircle size={15}/><span>把刚才那篇的标题改一下</span></div><div className="usage-footer"><FileText size={14}/> 当前提供草稿箱操作</div></section>
        <section className="help-card"><h3>在哪里找到凭据？</h3><p>登录微信公众平台，在开发相关设置中查看 AppID、AppSecret 和接口权限。</p><a href="https://mp.weixin.qq.com/" target="_blank" rel="noreferrer">打开微信公众平台 <ArrowRight size={13}/></a><div className="divider"/><h3>连接以什么为准？</h3><p>「检测连接」会实际读取草稿数量。公众号的图片、草稿写入权限，以微信接口返回结果为准。</p>{status?.verified_at && <p className="last-check">上次验证：{new Date(status.verified_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>}{status?.last_error && <p className="last-error">{status.last_error}</p>}</section>
      </aside></div>
      {status?.operations && status.operations.length > 0 && <section className="card recent"><h2>最近操作</h2>{status.operations.map((o, i) => <div className="operation" key={i}><span>{o.action === "create_draft" ? "创建草稿" : "修改草稿"}</span><span>{o.state === "complete" ? "微信已返回成功" : o.state === "unknown" ? "结果待核实" : o.state === "failed" ? "请求未完成" : "处理中"}</span><time>{new Date(o.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></div>)}</section>}
      <footer><span>公众号草稿助手</span><span>凭据加密保存 · 按账号隔离</span></footer>
    </main>
  </div>;
}
