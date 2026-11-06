import { articleFields, hash, imageType, integer, object, readLimited, str, validateArticle, UserFacingError, WeChatError } from './validation.mjs';
import { imageFromArgs } from './images.mjs';

export class WeChat {
  constructor({ appId = '', appSecret = '', imageRoot = '', state, fetcher = fetch }) {
    this.appId = appId; this.appSecret = appSecret; this.imageRoot = imageRoot;
    this.state = state; this.fetcher = fetcher; this.token = null; this.tokenPending = null;
    this.verifiedAt = null;
  }
  requireConfig() {
    if (!/^wx[a-zA-Z0-9]{8,62}$/.test(this.appId) || !this.appSecret) {
      throw new UserFacingError('请在部署机器的 .env 或环境变量中配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET；不要把密钥发到对话中。');
    }
  }
  async wire(path, body, token, method = 'POST') {
    const url = new URL(path, 'https://api.weixin.qq.com');
    if (token) url.searchParams.set('access_token', token);
    const headers = {};
    let raw;
    if (body instanceof FormData) raw = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json; charset=utf-8'; raw = JSON.stringify(body); }
    let data;
    try {
      const response = await this.fetcher(url, { method, headers, body: raw, redirect: 'manual', signal: AbortSignal.timeout(25000) });
      if (!response.ok) { await response.body?.cancel(); throw new Error('transport'); }
      // Bound streamed responses, not only Content-Length.
      data = object(JSON.parse((await readLimited(response.body, 3 * 1024 * 1024)).toString('utf8')));
    } catch {
      throw new UserFacingError(path === '/cgi-bin/draft/add' || path === '/cgi-bin/draft/update'
        ? '微信写入未收到可靠响应，结果可能未知。请先查询草稿箱，勿换请求编号重复提交。'
        : '微信接口未返回有效响应，请检查网络或稍后重试。');
    }
    if (data.errcode && Number(data.errcode) !== 0) {
      const code = Number(data.errcode);
      const known = {
        40001: '接口凭据失效，请重新检测连接。', 40007: '素材 ID 无效或不属于当前公众号。',
        40014: '接口凭据无效，请重新检测连接。', 40125: 'AppSecret 不正确，请在部署机器更新。',
        42001: '接口凭据过期，请重新检测连接。', 48001: '公众号未获得该接口权限，请检查后台权限列表。',
        45009: '微信接口调用达到额度，请稍后再试。',
        40164: '服务器出口 IP 不在微信白名单中。请将本机或服务器的固定公网出口 IP 加入公众号后台白名单。',
      };
      if ([40001, 40014, 42001].includes(code)) this.token = null;
      // Never return raw upstream errmsg: it may contain credentials or query strings.
      throw new WeChatError(code, `${known[code] ?? '微信拒绝了请求，请核对参数和接口权限。'}（微信错误码 ${code}）`);
    }
    return data;
  }
  async accessToken() {
    this.requireConfig();
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    if (!this.tokenPending) this.tokenPending = (async () => {
      const data = await this.wire('/cgi-bin/stable_token', { grant_type: 'client_credential', appid: this.appId, secret: this.appSecret, force_refresh: false });
      if (typeof data.access_token !== 'string' || !data.access_token) throw new UserFacingError('微信未返回有效接口凭据。');
      const seconds = Number(data.expires_in ?? 7200);
      this.token = { value: data.access_token, expires: Date.now() + Math.max(0, (Number.isFinite(seconds) ? seconds : 0) - 180) * 1000 };
      return this.token.value;
    })();
    try { return await this.tokenPending; } finally { this.tokenPending = null; }
  }
  async api(path, body, method) { return this.wire(path, body, await this.accessToken(), method); }
  async connectionStatus() {
    return {
      configured: /^wx[a-zA-Z0-9]{8,62}$/.test(this.appId) && !!this.appSecret,
      verified: !!this.verifiedAt, verified_at: this.verifiedAt, image_path_enabled: !!this.imageRoot,
      mode: 'self_hosted_single_account', capabilities: ['create_draft', 'update_draft', 'list_drafts', 'get_draft', 'upload_images'],
      note: '凭据只在部署环境中配置；连接检测成功不等于草稿写入成功。本工具不提供发表、群发或删除接口。',
    };
  }
  async checkConnection() {
    this.verifiedAt = null;
    const data = await this.api('/cgi-bin/draft/count', undefined, 'GET');
    this.verifiedAt = new Date().toISOString();
    return { ...await this.connectionStatus(), draft_count: Number(data.total_count ?? 0), message: '已读取真实草稿数量；写入权限需在对应操作中确认。' };
  }
  async listDrafts(args) {
    const data = await this.api('/cgi-bin/draft/batchget', {
      offset: integer(args.offset ?? 0, '起始位置', 0, 1000000), count: integer(args.count ?? 10, '数量', 1, 20), no_content: 1,
    });
    return { total_count: data.total_count, item_count: data.item_count, drafts: (Array.isArray(data.item) ? data.item : []).map(item => {
      const d = object(item), content = d.content ? object(d.content) : {};
      return { media_id: d.media_id, updated_at: d.update_time, articles: (Array.isArray(content.news_item) ? content.news_item : []).map(a => {
        const article = object(a); return { title: article.title, author: article.author, digest: article.digest, thumb_media_id: article.thumb_media_id };
      }) };
    }) };
  }
  async getDraft(args) {
    const mediaId = str(args.media_id, '草稿 ID', 1024);
    const data = await this.api('/cgi-bin/draft/get', { media_id: mediaId });
    if (!Array.isArray(data.news_item) || !data.news_item.length) throw new UserFacingError('微信未返回有效的草稿文章。');
    return { media_id: mediaId, articles: data.news_item.map((a, index) => {
      const fields = articleFields(object(a)); return { index, ...fields, content_hash: hash(fields) };
    }) };
  }
  async readback(mediaId) {
    try { return { readback_verified: true, draft: await this.getDraft({ media_id: mediaId }) }; }
    catch { return { readback_verified: false, warning: '微信已返回写入成功及草稿 ID，后续读回失败。请查询此 ID，勿再次创建。' }; }
  }
  async createDraft(args) {
    this.requireConfig();
    if (!Array.isArray(args.articles) || args.articles.length < 1 || args.articles.length > 8) throw new UserFacingError('一次草稿应包含 1–8 篇文章。');
    const articles = args.articles.map(validateArticle);
    return this.state.once('create_draft', args.request_id, articles, async () => {
      const data = await this.api('/cgi-bin/draft/add', { articles });
      if (typeof data.media_id !== 'string' || !data.media_id) throw new UserFacingError('微信未返回草稿 ID，结果未知，请先查询草稿箱。');
      return { created: true, request_id: args.request_id, media_id: data.media_id, ...await this.readback(data.media_id) };
    });
  }
  async updateDraft(args) {
    this.requireConfig();
    const mediaId = str(args.media_id, '草稿 ID', 1024), index = integer(args.index, '文章索引', 0, 7);
    const expected = str(args.expected_content_hash, '当前内容指纹', 64), article = validateArticle(args.article);
    if (!/^[0-9a-f]{64}$/.test(expected)) throw new UserFacingError('请使用 get_draft 返回的 content_hash。');
    return this.state.once('update_draft', args.request_id, { mediaId, index, expected, article }, async () => {
      const before = await this.getDraft({ media_id: mediaId });
      if (before.articles[index]?.content_hash !== expected) throw new WeChatError(-1, '草稿已变化或索引无效，请重新读取后再修改。');
      await this.api('/cgi-bin/draft/update', { media_id: mediaId, index, articles: article });
      return { updated: true, request_id: args.request_id, media_id: mediaId, ...await this.readback(mediaId) };
    });
  }
  async uploadImage(args) {
    this.requireConfig();
    const name = str(args.filename, '文件名', 180), purpose = args.purpose;
    if (purpose !== 'cover' && purpose !== 'body') throw new UserFacingError('图片用途应为 cover 或 body。');
    const bytes = await imageFromArgs(args, this.imageRoot, this.fetcher), mime = imageType(bytes), form = new FormData();
    form.set('media', new Blob([bytes], { type: mime }), `image.${mime === 'image/png' ? 'png' : 'jpg'}`);
    const data = await this.api(purpose === 'cover' ? '/cgi-bin/material/add_material?type=image' : '/cgi-bin/media/uploadimg', form);
    if ((purpose === 'cover' && typeof data.media_id !== 'string') || (purpose === 'body' && typeof data.url !== 'string')) throw new UserFacingError('微信未返回图片素材 ID 或图片地址，请核实素材库后再上传。');
    const result = { name, purpose, media_id: data.media_id ?? null, url: data.url ?? null, uploaded_at: new Date().toISOString() };
    this.state.addImage(result);
    return result;
  }
  async listImages() { this.requireConfig(); return { images: this.state.listImages() }; }
}
