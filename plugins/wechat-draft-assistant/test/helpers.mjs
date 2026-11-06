import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { State } from '../src/state.mjs';
import { WeChat } from '../src/wechat.mjs';
import { articleFields } from '../src/validation.mjs';

export const article = { title: '测试文章', content: '<p>架构与实现。</p>', thumb_media_id: 'mock-cover-id' };
export const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1cAAAAASUVORK5CYII=', 'base64');
export function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'wechat-draft-test-'));
  const state = new State(directory, 'wx0000000000000000');
  let closed = false;
  const controls = { failWrite: false, rejectWrite: false, failRead: false, redirect: false };
  const calls = [], drafts = new Map();
  const fetcher = async (input, options) => {
    const url = new URL(input), path = url.pathname;
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    calls.push({ url, options, body, path });
    if (controls.redirect) return new Response('', { status: 302, headers: { Location: 'https://example.org' } });
    if (path === '/cgi-bin/stable_token') return Response.json({ access_token: 'mock-access-token-not-real', expires_in: 7200 });
    if (path === '/cgi-bin/draft/count') return Response.json({ total_count: drafts.size });
    if (path === '/cgi-bin/draft/batchget') return Response.json({ total_count: drafts.size, item_count: drafts.size, item: [...drafts].map(([media_id, news_item]) => ({ media_id, content: { news_item } })) });
    if (path === '/cgi-bin/draft/add') {
      if (controls.rejectWrite) return Response.json({ errcode: 48001, errmsg: 'do not leak mock-app-secret-not-real' });
      const media_id = `mock-draft-${drafts.size + 1}`;
      drafts.set(media_id, body.articles);
      if (controls.failWrite) throw new Error('lost response containing mock-app-secret-not-real');
      return Response.json({ media_id });
    }
    if (path === '/cgi-bin/draft/get') {
      if (controls.failRead) throw new Error('read unavailable');
      return Response.json({ news_item: drafts.get(body.media_id) ?? [articleFields(article)] });
    }
    if (path === '/cgi-bin/draft/update') {
      const current = drafts.get(body.media_id) ?? [articleFields(article)];
      current[body.index] = body.articles; drafts.set(body.media_id, current);
      return Response.json({ errcode: 0, errmsg: 'ok' });
    }
    if (path === '/cgi-bin/material/add_material') return Response.json({ media_id: 'mock-uploaded-cover', url: 'https://mmbiz.qpic.cn/mock-cover' });
    if (path === '/cgi-bin/media/uploadimg') return Response.json({ url: 'https://mmbiz.qpic.cn/mock-body' });
    throw new Error(`Unexpected mock path: ${path}`);
  };
  const service = new WeChat({ appId: 'wx0000000000000000', appSecret: 'mock-app-secret-not-real', state, fetcher });
  t.after(() => { if (!closed) state.close(); rmSync(directory, { recursive: true, force: true }); });
  return { service, state, directory, calls, controls, drafts, close() { state.close(); closed = true; } };
}
