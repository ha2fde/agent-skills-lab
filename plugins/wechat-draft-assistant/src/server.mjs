import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { State } from './state.mjs';
import { WeChat } from './wechat.mjs';
import { serveStdio } from './protocol.mjs';
import { createHttpServer } from './http.mjs';

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--help')) {
    process.stdout.write('WeChat Draft Assistant\nNode.js 24+; no npm dependencies.\n\nnode --env-file-if-exists=.env src/server.mjs         # stdio (default)\nnode --env-file-if-exists=.env src/server.mjs --http  # Bearer-authenticated HTTP\n\nSet WECHAT_APP_ID, WECHAT_APP_SECRET and WECHAT_DATA_DIR.\nHTTP requires MCP_BEARER_TOKEN (random, >=32 characters).\nSee README.md for whitelist and client configuration.\n');
    return;
  }
  if (argv.some(a => !['--http', '--stdio'].includes(a)) || (argv.includes('--http') && argv.includes('--stdio'))) throw new Error('Use --stdio or --http. See --help.');
  // Validate HTTP options before opening any persistent state.
  const port = Number(env.PORT || 8787), host = env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
  const httpMode = argv.includes('--http');
  if (httpMode && (!env.MCP_BEARER_TOKEN || env.MCP_BEARER_TOKEN.length < 32)) throw new Error('Set a random MCP_BEARER_TOKEN (>=32 characters) for HTTP mode.');
  const state = new State(resolve(env.WECHAT_DATA_DIR || './data'), env.WECHAT_APP_ID || 'unconfigured');
  const service = new WeChat({ appId: env.WECHAT_APP_ID || '', appSecret: env.WECHAT_APP_SECRET || '', imageRoot: env.WECHAT_IMAGE_ROOT || '', state });
  if (!httpMode) {
    try { await serveStdio(process.stdin, process.stdout, service); } finally { state.close(); }
    return;
  }
  const csv = value => value.split(',').map(s => s.trim()).filter(Boolean);
  const server = createHttpServer(service, {
    token: env.MCP_BEARER_TOKEN,
    allowedHosts: csv(env.MCP_ALLOWED_HOSTS || `localhost:${port},127.0.0.1:${port},[::1]:${port}`),
    allowedOrigins: csv(env.MCP_ALLOWED_ORIGINS || ''),
  });
  server.once('error', () => { state.close(); process.stderr.write('HTTP server failed to start. Check host/port and directory permissions.\n'); process.exitCode = 1; });
  server.listen(port, host, () => process.stderr.write('WeChat draft MCP HTTP server ready.\n'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => { state.close(); }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Raw exceptions may embed sensitive paths or payloads. Startup errors stay generic.
  main().catch(() => { process.stderr.write('Startup failed. Check Node.js 24+, configuration, HTTP token, port and writable data directory. See --help.\n'); process.exitCode = 1; });
}
