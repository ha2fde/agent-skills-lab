# 公众号草稿助手 / wechat-draft-bridge

Existing Sites-hosted private MCP, service 1.1.0. Preserve project identity in `.openai/hosting.json`, D1 DB, runtime secrets, audience and canonical plugin.

## Tools

The eight original tools remain. `wechat_prepare_and_save_draft` adds deterministic image processing, navy/gold mobile HTML, automatic reference numbering, draft creation and verified readback. `wechat_upload_image` now accepts public HTTPS image URLs with DNS/HTTPS checks, or standard Base64 <=128 KiB. JPEG/PNG/static GIF/WebP are decoded and encoded as baseline JPEG; input max 10 MiB / 4 million pixels. Cover width is bounded to 900, body to 1280, original composition retained without cropping. Transparency is flattened onto white. Animated images are rejected rather than silently selecting frames. EXIF orientation is applied and metadata stripped. Output body <=1 MiB, cover <=10 MiB.

Source download has time/size limits, DNS preflight rejects non-public addresses, and redirects/credentials/custom ports/IP literal URLs are rejected. Download requests carry no account headers. DNS preflight cannot pin Worker fetch's later DNS resolution; no private HTTP tunnel bindings are provisioned. Do not broaden this into an authenticated internal URL fetcher.

## Draft flow

`request_id` is required and stable for retries. D1's existing receipts primary key enforces one submission across concurrent requests. A new outer receipt persists prepared assets and expected article before the upstream add, then the returned draft ID before verification. On timeout it scans at most the latest 200 drafts for a unique full match; no automatic second add is allowed, including when the lookup fails or finds no match. Replaying a verified receipt returns the original result. Readback mismatch retains the real media_id and can be rechecked with the same input. No distributed exactly-once guarantee is claimed across WeChat and D1.

Low-level create/update retain their signatures; HTML is normalized server-side. Readback now compares title, digest, cover, text, links, image references, headings, emphasis and required mobile styles. HTML byte equality is reported separately because WeChat may rewrite markup. Actual phone preview is reported separately and is never implied by API success.

## Privacy and storage

`WECHAT_CONFIG_ENCRYPTION_KEY` is an existing Sites runtime secret. Never log or export its value. Do not rotate without migration. AppSecret, relay key and cached tokens stay AES-GCM encrypted in D1 using user-bound additional data. No schema migration is required. Existing account data and drafts stay in place. Receipts contain request fingerprints, prepared articles, asset references and results, never binary arguments or account secrets. Runtime diagnostics contain only tool name, outcome and duration, never error details, arguments, signed URLs or image data.

## Checks

`pnpm test`; `node node_modules/typescript/bin/tsc --noEmit`; Sites `build-site.mjs`; `pnpm test:built` (real workerd + temporary D1, mocked WeChat; no live credentials). Test fixtures are synthetic images only.

Maintenance docs and release handoff: `ha2fde/agent-skills-lab/sites/wechat-draft-bridge/`. Always back up source, verify checks, record source commits, save/deploy the same Sites project, perform test-only draft readback and update HANDOFF. Preserve v3 as pre-upgrade rollback. Never invoke public publication or mass-send APIs.
