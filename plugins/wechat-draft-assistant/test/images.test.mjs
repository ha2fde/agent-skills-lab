import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageFromArgs, imageSourceUrl, MAX_INLINE_IMAGE_BYTES } from '../src/images.mjs';
import { png } from './helpers.mjs';

test('image URL allowlist prevents arbitrary/private destinations and credential-bearing URLs', () => {
  for (const url of ['http://files.oaiusercontent.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://files.oaiusercontent.com.evil.example/x', 'https://user:pass@files.oaiusercontent.com/x', 'https://files.oaiusercontent.com:444/x']) {
    assert.throws(() => imageSourceUrl(url));
  }
  assert.equal(imageSourceUrl('https://files.oaiusercontent.com/x?sig=test').hostname, 'files.oaiusercontent.com');
});

test('bounded inline images and exclusive input sources', async () => {
  assert.deepEqual(await imageFromArgs({ purpose: 'body', image_base64: png.toString('base64') }), png);
  await assert.rejects(imageFromArgs({ purpose: 'cover', image_base64: Buffer.alloc(MAX_INLINE_IMAGE_BYTES + 1).toString('base64') }), /128 KiB/);
  await assert.rejects(imageFromArgs({ purpose: 'body', image_base64: '!!!!' }));
  await assert.rejects(imageFromArgs({ purpose: 'body', image_base64: png.toString('base64'), image_url: 'https://files.oaiusercontent.com/x' }), /只能提供一种/);
});

test('download has no account credentials, refuses redirects and enforces streamed size', async () => {
  const args = { purpose: 'body', image_url: 'https://files.oaiusercontent.com/x?sig=test' };
  const result = await imageFromArgs(args, '', async (_url, options) => {
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers, undefined);
    return new Response(png);
  });
  assert.deepEqual(result, png);
  await assert.rejects(imageFromArgs(args, '', async () => new Response('', { status: 302 })), /重定向/);
  await assert.rejects(imageFromArgs(args, '', async () => new Response(new ReadableStream({ start(c) { c.enqueue(Buffer.alloc(1024 * 1024)); c.enqueue(Buffer.alloc(1)); c.close(); } }))), /超过大小限制/);
});

test('local image access is disabled by default and confined to an opted-in image directory', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wechat-images-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'images'); await mkdir(root); await writeFile(join(root, 'cover.png'), png);
  await writeFile(join(dir, 'outside.png'), png); await symlink(join(dir, 'outside.png'), join(root, 'escape.png'));
  const args = { purpose: 'cover', image_path: 'cover.png' };
  await assert.rejects(imageFromArgs(args, ''), /未启用/);
  assert.deepEqual(await imageFromArgs(args, root), png);
  for (const image_path of ['../outside.png', join(dir, 'outside.png'), 'escape.png']) await assert.rejects(imageFromArgs({ ...args, image_path }, root));
});
