# claude-skills

自用的 agent skills。这个仓库**就是** `~/.claude/skills/` 本身——clone 到那个路径即可，
不需要 marketplace、不需要安装步骤。

## 为什么是这个路径

`~/.claude/skills/` 是 Claude Code 和 opencode 的**共同**发现路径：

| 工具 | 读取位置 |
|---|---|
| Claude Code | `~/.claude/skills/*/SKILL.md`、项目里 `.claude/skills/*/SKILL.md` |
| opencode | `~/.config/opencode/skills/`、**`~/.claude/skills/`**、`~/.agents/skills/`，项目里同理 |

放这儿两边都认，一次维护两处生效。

## 装到新机器

```bash
# macOS / Linux
git clone https://github.com/ha2fde/claude-skills.git ~/.claude/skills

# Windows (PowerShell)
git clone https://github.com/ha2fde/claude-skills.git "$HOME\.claude\skills"
```

目标目录必须不存在或为空。已经有内容的话先备份再合并。

同步：`git -C ~/.claude/skills pull`

## 现有 skill

| 名字 | 干什么 |
|---|---|
| `tailscale-macos` | macOS 上装/配/验 Tailscale，尤其是开 Tailscale SSH 服务端（必须用开源 tailscaled，所有 GUI 版都开不了）。含装机脚本和一整节「哪些验证方法是死胡同」 |
| `macos-remote-power` | 配电源策略让 Mac 插电时不休眠，随时能远程登录；拔电后自动恢复省电。一条 `pmset` 顶掉防休眠 App。含配置脚本 |

这两个是一套：`tailscale-macos` 解决「怎么连进来」，`macos-remote-power` 解决「连的时候机器是醒的」。

## 写新 skill 的规矩

目录结构：

```
<skill-名字>/
├── SKILL.md          必须全大写
└── <随便什么辅助文件>   脚本、模板、参考资料
```

`SKILL.md` 开头必须是 YAML frontmatter：

```yaml
---
name: skill-的名字
description: 这个 skill 干什么 + 什么时候该用它。写清楚触发场景，模型靠这句话决定要不要加载。
---
```

**四条硬要求**：

1. **`SKILL.md` 全大写**，`name` 和 `description` 必填，缺一个就不会被发现
2. **名字全局唯一**——跟其它来源的 skill 重名会被丢掉
3. **正文不要写死工具名**。别写「用 Bash 工具执行…」，写「运行以下命令」。
   `allowed-tools` 这类字段是 Claude Code 专有的，opencode 有自己的 `permission.skill` 机制，
   写死了就只能在一边用
4. **不放隐私**。仓库可能随时从 private 切成 public，所以从第一天就当它是公开的：
   - ❌ 机器名、内网/tailnet IP、tailnet 后缀、账号邮箱、真实用户名
   - ❌ token、auth key、密码、私有仓库地址
   - ✅ 一律用 `<机器名>`、`<用户名>`、`$USER` 这种占位符，或者从命令输出里动态取

新增 skill 后自查一遍：

```bash
grep -rniE '你的机器名|你的账号|tskey-|ghp_|gho_|100\.[0-9]+\.[0-9]+\.[0-9]+' .
```

## description 怎么写才会被触发

`description` 是唯一的匹配依据，写成「这个 skill 是关于 X 的」没用。要写**用户会说什么话**：

> ❌ `description: Tailscale 相关知识`
>
> ✅ `description: 在 macOS 上安装、配置、验证和排查 Tailscale……当用户要在 Mac 上装
> Tailscale、抱怨 Tailscale SSH 打不开、想让别的机器 ssh 进 Mac、或者要确认 SSH
> 服务端到底起没起来时使用。`
