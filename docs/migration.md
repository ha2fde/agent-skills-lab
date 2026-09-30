# 从 claude-skills 迁移

本次保留 3 个 Skill 的名称、正文与脚本内容，仅把目录迁入 skills/。
原始版本：4181df134bf1ba19db8481eac707662d4f088865。

| 原路径 | 新路径 |
|---|---|
| tailscale-macos/ | skills/tailscale-macos/ |
| macos-remote-power/ | skills/macos-remote-power/ |
| synology-gitea/ | skills/synology-gitea/ |

## 旧安装方式

旧仓库本身位于 ~/.claude/skills，直接 git pull 新布局后，客户端可能不再发现嵌套技能。
迁移前检查 git status，备份本地改动和技能目录。把仓库移至普通源码目录，再使用
`npx skills add <本地仓库路径> --skill tailscale-macos -g -a claude-code`
按需安装每个技能。也可手工复制 skills/ 下的独立目录到客户端技能路径。
不要复制整个仓库，不要直接覆盖同名的本地自定义技能。

此次不修改用户设备。迁移完成后用客户端技能列表确认，再做实际任务验证。

## 仓库名称与可见性

仓库已正式改名为 ha2fde/agent-skills-lab，并于 2026-09-30 公开，保留现有提交历史。
已有源码 checkout 可更新远端：
```bash
git remote set-url origin https://github.com/ha2fde/agent-skills-lab.git
```
这只更新源码仓库地址；旧技能安装目录仍需按上面的布局迁移。

## WorkBuddy 签到 Skill

从 ha2fde/workbuddy-daily-checkin 导入至 skills/workbuddy-daily-checkin/，保留名称、原脚本与 MIT 许可。
统一 frontmatter，修正“只读登录态”“无副作用”说明及平台专有定时指令。
原独立仓库已于 2026-09-30 在迁移复核后删除；脚本与 MIT 许可证内容一致，Skill 说明已标准化。后续维护与安装统一使用 ha2fde/agent-skills-lab。旧仓库安装地址失效；本次不创建计划任务、不运行领取。
