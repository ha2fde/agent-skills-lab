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

## 测试草稿安全删除交接 — 2026-11-07

**当前线上：** 原项目 Sites **v7**、MCP **1.2.0**；源提交 `e799710058a3c0a29f3b789f53a4e06b59abeb72`；保存版本 `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_3216e35964a88191a1bdace0164f14a2`；部署 `appgdep_6aee74c2a5488191a759944bed47978a` **succeeded**（2026-11-07T00:46:04.345806+00:00），has_mcp=true，环境修订 1，原插件 ID、访问范围、凭据和 D1 保持。GitHub 源码提交 `f381148ca3178f4689fca195db0e9c99fe88fa49`；修改前备份分支 `backup/wechat-draft-bridge-v5-before-safe-delete-20261107`。v6 曾短暂上线，v7 修正删除后来源快照的保存，目前 v7 为唯一现行版本。**本次没有发送任何真实删除调用，也没有修改现有草稿。**

**工具与守卫：** 原九个工具保持兼容，新增 `wechat_delete_test_draft`，仅有必填 `media_id`（准确 ID）与 `request_id`（8–100 位字母数字下划线连字符；同次重试不变）。一键保存工具增可选 `test_draft:boolean`，创建时为 true 且标题以 `【测试草稿·勿发布】` 开头，微信成功读回后才会在现有 D1 receipts 中生成服务器自有记录，绑定站点认证用户、公众号 AppID、创建操作收据、media ID、原始标题/摘要/封面/完整内容指纹。删除请求无法凭自报标记或标题取得资格。删除前核对来源收据与微信实际内容，在目标条件锁后再次读回，写审计收据，再最多发送一次微信 draft/delete，随后 GET 确认消失；不明结果只对账，重试不再次发送。微信明确错误会记录错误码并报告失败。成功后保留原始来源快照和独立删除审计记录。无批量删除。

**历史三篇：** 先前那三个 ID 创建于来源标记功能之前，旧记录无法证明明确的测试用途和原始读回快照。它们**不具备本工具的自动删除资格**；不允许回填或仅凭标题推定。《感谢这个世界是真实的》及其他现有草稿保持原样。后续若要清理，需用户对每个精确 ID 分别核对创建会话证据、当前完整正文/标题/摘要/封面、确认未转为正式稿，并对三个目标分别明确授权，由另行审计的人工管理路径执行；不要削弱默认工具的校验。

**测试与限制：** TypeScript、37 项行为测试、构建、真实编译 Worker/隔离 D1/模拟微信全链路、workerd Request、[CI 42320089868](https://github.com/ha2fde/agent-skills-lab/actions/runs/42320089868) 均通过。生产中已有插件的 `wechat_connection_status` 读到 service 1.2.0、配置正常且能力列表含 delete_test_draft。**当前会话预加载的插件工具清单仍是九个，新会话是否出现第十个删除工具须独立验收；直接从执行容器 POST /mcp 的尝试返回 HTTP 403，不能据此宣称线上 tools/list 已验证。** 未对真实草稿调用删除，这是用户本次明确要求。微信删除接口没有内容哈希条件参数，因此最终读回与删除之间存在无法完全消除的外部编辑竞态；实现对所有可检测变化拒绝，绝不通过标题、批量或猜测回填来源。回滚至前述 v5 保存版本仅在严重回归时执行，未实测回滚。
