# Handoff — 2026-11-07

## Current production

- Original project: `appgprj_6aed4c1fef588191b5b8f417f70bcc82`
- Live: https://wechat-draft-bridge.hac2fde.chatgpt.site
- Sites version: **5**; MCP service **1.1.1**; format `navy-gold-18-v1`
- Saved version: `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_dba9b4f7d37481919c66efa32ca5c531`
- Deployment: `appgdep_6aee6c69beac819193d2148eec7ea535` — **succeeded**, native timestamp 2026-11-07T00:10:26.783982+00:00
- Exact deployed Sites source commit: `d09939e0807c703373730dda539563f32224e74e`
- GitHub source/checks commit: `e3454cafab386712efea4fa68d7eae65c2d15586` (141 files; all paths, modes, byte sizes and blob hashes verified by remote readback)
- Runtime environment revision remained **1**. No runtime secret, D1 schema, plugin/app identity, audience or account-credential change.

## Backup and rollback

Original v3 source: `be1f5d2b65ffd22889d8bfeda43ca2a57cb2f322`.

Before-upgrade backup: `backups/wechat-draft-bridge/2026-11-07-before-upgrade/`, GitHub commit `574836fd10a79d856b510b855eff46661c8dfce5`; 133 original files / 785688 bytes verified. Earlier 2026-11-06 backup remains unchanged. Runtime secrets and production DB were intentionally not exported.

Retained v3 saved archive: `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_f27a758d08588191a549ae9e3e60b499`. Same-project redeployment is the rollback path; no DB migration is required. No live rollback drill performed. See DEPLOYMENT.md.

## Completed implementation

Preserved eight low-level tool signatures. Added **wechat_prepare_and_save_draft**. General public HTTPS fetch with DNS checks and strict Base64 <=128KiB, JPEG/PNG/static GIF/WebP decode/conversion, EXIF transpose, safe size/pixel bounds, purpose-specific material upload and metadata. Default static inline HTML: 18px/1.85, h2 23px, navy/gold, mobile wrapping and continuous structured references. Durable receipts prevent concurrent/replayed duplicate adds; timeout triggers bounded lookup, never blind re-creation. Readback compares actual text, images, links, metadata, emphasis and mobile styles. Known WeChat data-src/CDN rendition rewrites preserve image identity. Missing anchors remain an explicit validation failure.

## Verified results

- Local: TypeScript + **27 behavioral checks**, actual workerd Request compatibility, production build, compiled Worker PNG/JPEG/GIF/WebP conversion and end-to-end pipeline with temporary real D1/mock WeChat, retry and unknown-response recovery — passed.
- GitHub Actions: **success**, [run 42316543293](https://github.com/ha2fde/agent-skills-lab/actions/runs/42316543293). All install/type/test/build/built-worker checks completed. Initial 1.1.0 job's tests passed but optional cache cleanup failed; the follow-up removes that cache and the full job succeeds.
- Live through the existing installed plugin: service 1.1.1 and original configured credentials confirmed; Base64 cover/body upload and public HTTPS URL download→WeChat upload succeeded.
- Created one clearly named test draft; updated that same draft after observing WeChat rewrites. Final **readback_verified=true** for title, digest, cover, body image, text, headings, emphasis and mobile styles. A separate get_draft confirmed the result. Repeating the exact update request returned the same draft ID and verified result. No public publication/mass-send or existing-article edits were performed.
- Actual draft IDs, account identifiers, account image URLs and raw account/tool responses are excluded from this public handoff.

## Acceptance limits — do not claim complete

1. **Clickable references not passed.** The actual account stripped external anchors; an attempted platform-home link update was rejected with WeChat 45166. Its meaning was not confirmed from accessible official documentation. Final successful test uses explicitly plain-text destinations and continuous reference numbers. This validates the rest of the pipeline, not clickable links. High-level reference output keeps the full URL visible even if WeChat strips anchors, but reports links=false rather than declaring success. Verify with an allowed real WeChat article link/account permission before claiming clickable-link support end-to-end; do not invent the root cause or bypass platform restrictions.
2. **Fresh ChatGPT conversation not tested.** Current turn exposes the original eight tool schemas and does not refresh the new ninth tool. Native publication reports has_mcp=true and existing tools reach 1.1.1, but that is not proof that a new chat sees/can call the high-level tool. This environment cannot create a separate signed-in ChatGPT conversation. No new account, AppID/secret or replacement plugin is required.
3. **High-level real-WeChat end-to-end pending.** Its full pipeline passed actual compiled Worker/D1 mocked-transport tests; the real account live test used the existing low-level tools. In a fresh chat verify discovery and call the high-level tool with synthetic public test images, stable request_id, then replay the same request and independently get_draft. Never claim mock completion as live completion.
4. **Actual phone preview not tested.** Local browser connection to preview was refused while daemon reported running. `node --experimental-vm-modules scripts/test-wechat.mjs --layout` generates outputs/mobile-qa.html for 360/390/430px; this is not a passed browser screenshot or WeChat phone preview.

## Next operation

Use a fresh ChatGPT conversation with the existing 公众号草稿助手 plugin, load this handoff, discover tools and verify wechat_prepare_and_save_draft. Use request_id `maintenance-v111-fresh-chat-001` for one test operation and preserve it across retries. Obtain real reachable synthetic image bytes/URLs; do not put private account URLs or credentials into this public repository. Inspect clickable-link behavior separately. Record result in this same handoff, with exact deployed source, GitHub commit, tests, actual result and remaining limits. Future changes must back up → commit source → test → deploy same project → verify real readback → update HANDOFF.


## Fresh-chat live acceptance — 2026-11-07 (independent conversation)

**Scope and deployment:** This new ChatGPT conversation independently discovered and invoked `wechat_prepare_and_save_draft` (ninth tool). `wechat_connection_status` returned configured/verified, service `1.1.1`, format `navy-gold-18-v1` and capability `prepare_and_save_draft`. The original v5 Sites deployment identifiers and succeeded status above were checked against `RELEASE-VERIFICATION.json`; no Sites deployment-admin tool was available for a second native deployment-status query. Existing source and tool implementation were read from `source/lib/mcp-tools.ts`, `wechat-format.ts` and `wechat-validation.ts`. GitHub Actions run 42316543293 was independently queried and returned completed/success. No code or deployment changes were made.

**Live real-WeChat high-level end-to-end — PASS (without links):** Request `maintenance-v111-fresh-chat-003` uploaded the publicly hosted GitHub Explore Python PNG over HTTPS, converted it to JPEG as a cover, created exactly one clearly labeled test-only draft, and returned `created=true`, `outcome=saved`, `readback_verified=true`, with title/digest/cover/text/headings/emphasis/mobile-styles/static-HTML checks true. An independent `wechat_get_draft` returned the same title, content hash, cover and content. Replaying the *identical* high-level request with the *same* request_id returned the same media_id and verified result. A separate `wechat_list_drafts` showed only one matching fresh-chat test draft, supporting no duplicate on replay. This is real API evidence, not a mock-only assertion. The links check here was vacuous (no anchors); it does NOT establish clickable links.

**Additional live body-image and external-reference test — PARTIAL:** Request `maintenance-v111-links-001` used the same public PNG as both cover and body image and included one numbered `https://github.com/` reference plus `content_source_url`. The high-level tool returned `created=true`, `outcome=saved`; cover/body image uploads, formatting, and independent `wechat_get_draft` succeeded. All readback checks except `links` were true; `readback_verified=false` and `links=false` correctly exposed that WeChat removed the clickable anchor while preserving visible plain-text URL. The `content_source_url` field survived in readback; this does not establish that the phone UI renders a clickable 'Read original' entry. No public release or mass-send occurred.

**Failure-path observations:** A first synthetic Base64 payload failed validation before creation (`maintenance-v111-fresh-chat-001`, `stage=cover`, `created=false`). A Wikimedia image URL returned HTTP 403 (`maintenance-v111-fresh-chat-002`, `stage=cover`, `created=false`). A later attempt to reuse `-001` with *changed* content was rejected because request_id binds the original payload. This is correct mismatch protection; use a fresh ID for a genuinely new payload, and never change the payload when retrying an uncertain write. Both failed attempts explicitly returned no draft created.

**Clickable-link compatibility:** Independent documentation and third-party guidance indicate that external inline anchors can depend on WeChat account type and permissions; a commonly documented fallback is the article-level `content_source_url` ('阅读原文') or visible plain-text URLs. The current account's external inline anchor was *actually removed* in a new live high-level test, so clickable external references remain **NOT PASSED**. A known-permitted, already-published `mp.weixin.qq.com` article link has not yet been supplied/tested; do not claim any anchor class works without live readback. Do not attempt platform-restriction bypass.

**Still pending:** Actual iPhone/WeChat preview and visual layout checks at 360/390/430 px; whether a permitted internal WeChat article anchor survives; whether '阅读原文' is rendered and tappable on phone. No phone screenshot or native Sites-admin deployment-status refresh was available in this conversation. Do not mark these complete.

**Acceptance classification:** 27 behavioral checks + build + CI = **automated PASS** (previous release); new-chat tool discovery + real high-level cover upload/draft/readback + stable-ID replay + real body-image upload = **live PASS**; clickable inline external links = **live FAIL**; phone preview and internal-WeChat-link compatibility = **NOT TESTED**. Existing production remains v5 / service 1.1.1, no redeployment.

## Test-draft cleanup request — 2026-11-07

The user explicitly requests prompt removal of **only the assistant-created temporary acceptance drafts**, both now and after future tests. Current real WeChat draft listing returned four drafts: three known acceptance drafts and the unrelated real article `感谢这个世界是真实的` (must NOT touch). Exact verified cleanup candidates: `z-_mumxif9IVp3_gkx_RXJGW_-OYBrKi5TaNyLT5PDIl74zkZhRNS2AIb5PaIzx1`, `z-_mumxif9IVp3_gkx_RXH__SjuAKGUyGoCOFfgkV8MExXmnljgEjn_aREYHYEDo`, `z-_mumxif9IVp3_gkx_RXOpUEjgw4pKbUcklp6LdPkGiHAfeF1dHaFTnosj_D6mR`. **NOT YET DELETED**: current installed plugin exposes no delete tool. Do not claim cleanup completed. Before removal, get each exact media_id and match title/purpose; delete exclusively those IDs through a controlled authorized channel, then list and verify unrelated drafts remain unchanged. Future MCP test workflows must include post-test cleanup and record success/failure. Follow updated `skills/wechat-publisher/SKILL.md`; add a safe exact-ID delete-test-draft method to existing Sites project if needed, test, deploy and verify before using it. Do not ask for account secrets or recreate the plugin.
