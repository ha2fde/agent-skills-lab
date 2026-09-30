# Agent Skills Lab
**把解决过的问题，变成可以复用的 Agent 能力。**

A growing collection of practical Agent Skills for infrastructure, security, development and productivity.

维护者：[@ha2fde](https://github.com/ha2fde)。采用一套 SKILL.md，面向 Claude Code、Codex、Cursor、OpenCode 等支持 Agent Skills 的工具。安装支持不等于每个工作流都已在每个客户端实测。

## 技能目录

| 分类 | Skill | 用途 | 验证状态 |
|---|---|---|---|
| 系统运维 · operations | [tailscale-macos](skills/tailscale-macos/SKILL.md) | Mac Tailscale 安装、SSH 与排障 | 历史经验迁移；本次未做硬件复测 |
| 系统运维 · operations | [macos-remote-power](skills/macos-remote-power/SKILL.md) | Mac 插电保持唤醒、远程访问与回滚 | 历史经验迁移；本次未做硬件复测 |
| 开发工具 · development | [synology-gitea](skills/synology-gitea/SKILL.md) | 群晖 Gitea 与多远端 Git 备份 | 历史经验迁移；本次未做硬件复测 |
| 效率工具 · productivity | [workbuddy-daily-checkin](skills/workbuddy-daily-checkin/SKILL.md) | 腾讯 WorkBuddy 每日签到领积分 | 结构与语法检查；未复测活动 |

## 安装

正式仓库名为 `agent-skills-lab`，已公开。可使用以下命令列出并安装技能：

```bash
npx skills add ha2fde/agent-skills-lab --list
npx skills add ha2fde/agent-skills-lab --skill tailscale-macos -g -a claude-code
npx skills add ha2fde/agent-skills-lab --skill macos-remote-power -g -a codex
npx skills add ha2fde/agent-skills-lab --skill synology-gitea -g -a cursor
npx skills add ha2fde/agent-skills-lab --skill workbuddy-daily-checkin -g -a claude-code
```

旧版直接 clone 到 `~/.claude/skills` 的用户，先阅读 [迁移说明](docs/migration.md)，不要直接拉取新布局。

## 长期规划

| 分类 | 后续方向 |
|---|---|
| ai-infra | DGX Spark、本地模型部署、模型验收与性能评测 |
| security | 代码审计、AVR、Fuzzing、漏洞验证、供应链安全 |
| operations | 操作系统、远程连接、服务维护 |
| development | Git、开发环境、构建与自动化 |
| productivity | 文档、数据处理、日常工作流 |

未来方向仅为规划；不创建空 Skill，不把待验证流程标为可用。

## 仓库约定

- 正式技能统一位于 `skills/<skill-name>/`，分类记录在 [catalog.json](catalog.json)，避免分类调整导致安装路径变化。
- 技能保持独立，随技能一起分发必要脚本、参考资料和资产。
- 模板位于 `templates/SKILL.template.md`，避免被识别成正式 Skill。
- 名称用小写英文与连字符，描述写清任务与触发条件。
- 用真实使用记录区分“结构检查通过”和“目标机器验证通过”。

参阅 [设计规范](docs/skill-design-guide.md)、[贡献规范](CONTRIBUTING.md)、[发布指南](docs/publishing.md) 和 [路线图](docs/roadmap.md)。

格式与安装参考：[Agent Skills](https://agentskills.io/specification) · [skills CLI](https://github.com/vercel-labs/skills)。

## 使用与授权

执行脚本前检查目标平台、参数与变更范围。原有脚本保留，未在本次迁移中执行安装操作。
WorkBuddy 签到 Skill 保留原 MIT 许可证；其他内容当前未授予统一开源许可证；仓库公开可读也不等于获得再分发许可。正式公开发布前由维护者确定许可证。
