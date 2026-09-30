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

页面标题采用 Agent Skills Lab；GitHub slug 暂仍是 claude-skills。
改名目标 agent-skills-lab。仓库保持私有；公开发布前检查完整历史与许可证。
