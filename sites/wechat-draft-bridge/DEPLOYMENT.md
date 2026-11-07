# Deployment and rollback

Use the Sites tools with the original project ID in `source/.openai/hosting.json`. This public GitHub mirror is not the platform's authenticated source origin.

1. Read current `get_site` and saved versions. Retain the deployed saved-version ID and source SHA. Reopen the same project with a freshly issued short-lived source repository credential through the Sites source helper. Keep credentials in memory/stdin only.
2. Mirror the complete sanitized tracked snapshot to a new dated backup directory; compare all file paths, modes, sizes and Git blob hashes after GitHub readback. Preserve existing repo/Skill directories.
3. Run TESTING.md checks in an isolated checkout. Never connect tests to production D1 or live credentials.
4. Use the Sites `site-workflow.mjs` helper from the selected checkout with the complete original open result and native source credential; package after successful build. The helper commits/pushes the exact source and returns commit_sha + archive. Save that exact commit/archive using `save_site_version`, then deploy its returned saved-version ID with the appropriate audience-aware Sites tool. Do not alter runtime variables, audience, D1 or plugin identity.
5. Poll only pending/building/publishing deployments. Record the terminal result/version/source SHA. Confirm original account still configured. Create only a clearly named test draft and verify title, text, styles, cover and body refs. Repeat the same request ID to confirm no duplicate. Do not edit existing articles to test this upgrade.
6. Record verification boundaries and HANDOFF, then commit the final mirror/docs and checks manifest to GitHub. A changed GitHub document alone does not mean the Site has been deployed.

## Rollback

Pre-upgrade v3 saved-version ID: `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_f27a758d08588191a549ae9e3e60b499`

Pre-upgrade source SHA: `be1f5d2b65ffd22889d8bfeda43ca2a57cb2f322`. The v3 archive is already saved in Sites. If post-deploy critical checks fail, deploy this exact saved version to the same project; do not create a Site. DB schema is unchanged, so rollback requires no DB restore or credential change. Preserve newly added text receipt states: v3 will safely refuse replaying an unknown newer operation. Do not rotate WECHAT_CONFIG_ENCRYPTION_KEY.

Rollback capability is established by the retained saved v3 archive; a live rollback/redeployment drill has not been performed unless explicitly recorded in HANDOFF.

## 当前 v7 / MCP 1.2.0

原项目原地部署：源代码 `e799710058a3c0a29f3b789f53a4e06b59abeb72`；保存版本 `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_3216e35964a88191a1bdace0164f14a2`；部署 `appgdep_6aee74c2a5488191a759944bed47978a` succeeded。D1 结构与线上密钥未变。先前短暂部署的 v6 已被 v7 覆盖，v7 修正了删除完成时保留原始来源快照。修改前 GitHub 备份分支 `backup/wechat-draft-bridge-v5-before-safe-delete-20261107`。如遇严重回归，可将原项目回滚到 v5 保存版本 `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_dba9b4f7d37481919c66efa32ca5c531`；不得新建项目、改密钥或删除 D1。回滚演练尚未执行。

## Current v9 / MCP 1.2.2 — article theme

Source `2f584bc149fac943fe499d0311d715d2ae0aa9cd`; saved version `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_b5a45819db48819183c57cba265d02ea`; deployment `appgdep_6aeedbee7b288191b75b1d6c10037137` succeeded. `theme` is optional on the high-level create path and does not change existing low-level signatures, secrets or D1 schema. To roll back, redeploy v8 saved version `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_651966a306ac8191ac84b3fc044795e9` on the same project. Recheck the live callable tool schema after a plugin catalog refresh; do not infer catalog sync from the connection status. For a live style smoke test, only create a newly marked synthetic test draft, verify `visual_style` by independent readback and delete its exact ID with the guarded test tool. Never use historical drafts as test inputs.

## Current v10 / MCP 1.2.3 — readability default, article-specific styles

Source `18a298e2775787edf02b62b8624365907955b75c`; saved version `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_302ff6f6d0e08191bdbeed607e2de692`; deployment `appgdep_6aeedf4be0208191a3d975581de3f9d6` succeeded. Safe inline CSS in `content` works through the current high-level tool even when optional `theme` is missing from a cached ChatGPT schema. Default mobile readability fixes are not color mandates. The live synthetic draft was read back with a non-white palette, then deleted by the guarded exact-ID tool with absent-target confirmation. Roll back to same-project v9 saved version `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_b5a45819db48819183c57cba265d02ea`; no schema/secret changes.

## v11 / MCP 1.2.4 — 草稿校验

- 原项目部署 appgdep_6aef026699088191899683b9d4cc8f73 成功。Sites 源提交 `ff582fc00011ed729e041407990eb9e17e127977`，GitHub 镜像提交 `6b51d84739843e53e2d8b57a27102ea51e688951`。逐文件比对 141 个 Git blob。项目受众和插件 ID 一致。回滚使用本项目 v10 已保存版本 `appgprj_6aed4c1fef588191b5b8f417f70bcc82~appgver_302ff6f6d0e08191bdbeed607e2de692`。
- 更新发布规则时分别更新 GitHub 与已安装的个人 Skill。此次发布的个人 Skill 使用随包规范。GitHub 变更不会直接替换安装内容，也不会部署 MCP。修改 MCP 后按本页步骤从原项目源代码构建、部署，再核对线上连接状态与 ChatGPT 实际工具参数。
- 新会话需以同账号 Work 自然语言请求验证自动选用。旧会话工具目录可能继续缺少 `changed_fields`。当前目录缺少时，修改草稿沿用全字段读回、只替换获授权字段、保留未改正文 HTML 的兼容路径。
- 微信合成稿正常写入及独立读回通过，微信 CDN URL 的等价改写通过身份比较。损坏图片、低对比度和文本伪流程图被拒绝。经受保护机制精确删除测试稿，独立查询确认目标不存在，草稿库存与基线一致。手机真实预览和独立登录 Work 会话触发未验收。
