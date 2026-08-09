---
name: tailscale-macos
description: 在 macOS 上安装、配置、验证和排查 Tailscale，尤其是开启 Tailscale SSH 服务端（必须用开源 tailscaled，所有 GUI 版都开不了）。当用户要在 Mac 上装 Tailscale、抱怨 Tailscale SSH 打不开、想让别的机器 ssh 进 Mac、或者要确认 SSH 服务端到底起没起来时使用。
---

# macOS 上的 Tailscale

## 先分叉：要不要让这台 Mac 被别人 ssh 进来

| 需求 | 装什么 | 代价 |
|---|---|---|
| 只是上 tailnet | 官网 `.pkg` GUI 版 | 无。菜单栏、Taildrop 拖拽、自动更新都在 |
| **要当 SSH 服务端** | 开源 `tailscaled` | 没菜单栏、没自动更新、Taildrop 变命令行 |

**决定性事实**：Tailscale SSH **服务端**在**所有 macOS GUI 版**上都被 `IsSandboxedMacOS()` 挡死——
App Store 版、官网 `.pkg` 版、`brew install --cask` 版全都不行，报

```
The Tailscale SSH server does not run in sandboxed Tailscale GUI builds.
```

这**不是**「Tailscale SSH 只支持 Linux」。macOS 完全可以当服务端，换开源守护进程就行。

不需要 SSH 服务端的话**不要**折腾 tailscaled，GUI 版体验好得多。

---

## 安装（tailscaled 路线）

可以直接跑捆绑的 `install.sh`，或按下面手动来。

### 装之前

在 `https://login.tailscale.com/admin/settings/keys` 生成一个 auth key（Reusable），
可以让整个过程免浏览器交互。没有也行，会弹浏览器登录。

### 路径随架构变

- Apple Silicon：Homebrew 前缀 `/opt/homebrew`
- Intel：`/usr/local`

下文用 `$BREW` 代指。

### 步骤

```bash
# 1. Homebrew（新机器才需要）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 必须 --formula。装成 cask 就是 GUI 版，白干
brew install --formula tailscale

# 3. 装成开机自启的系统守护进程
sudo $BREW/opt/tailscale/bin/tailscaled install-system-daemon

# 4. 登录并开 SSH（没有 authkey 就去掉那段，会弹浏览器）
sudo tailscale up --ssh --hostname=<机器名> --authkey=<你的 auth key>

# 5. 免 sudo
sudo tailscale set --operator=$USER
```

已经装好了只想补开 SSH：`sudo tailscale set --ssh=true --operator=$USER`

**MagicDNS 不用手工配。** tailscaled 会自己写满 `/etc/resolver/`（tailnet 后缀、`ts.net`、
`search.tailscale` 加一堆反解）。网上让你手建 `/etc/resolver/<后缀>` 的教程已经过时了。

---

## 五个坑

1. **`brew services start tailscale` 不要用。** 它起的是用户级 agent，会跟
   `install-system-daemon` 装的系统守护进程抢 utun，两个都时断时续。装完只用 launchd 管。

2. **GUI app 不能和 tailscaled 共存**（同样抢 utun）。要换先删
   `/Applications/Tailscale.app`，然后**重启**——系统扩展只有重启才真正卸载。
   确认干净：`systemextensionsctl list | grep -i tailscale` 应该没有 `activated`。

3. **节点重名。** 后台还留着同名旧节点时，新节点会变成 `<名字>-1`。
   先去 `https://login.tailscale.com/admin/machines` 删旧的，再
   `tailscale set --hostname=<名字> && sudo dscacheutil -flushcache`。

4. **`brew upgrade` 只更新 `$BREW` 里那份。** `/usr/local/bin/tailscaled` 是
   `install-system-daemon` 复制过去的副本，大版本升级后要重跑一次
   `sudo $BREW/opt/tailscale/bin/tailscaled install-system-daemon`。

5. **判断当前跑的是哪种版本**：执行 `tailscale set --ssh`。
   GUI 版报上面那句错并且**不写入 prefs**；tailscaled 版静默接受，`RunSSH` 变 `true`。
   这是最快的区分办法。（辅助判据：bundle id `io.tailscale.ipn.macsys` = 官网独立版，
   `io.tailscale.ipn.macos` = App Store 版，两者都是 GUI 版。）

---

## 验证 SSH 服务端：先看哪些方法没用

这几条会浪费大量时间，**在本机上根本验不出来**：

- **`tailscale status --json` 里的 `RunningSSHServer`** —— 近期版本里**所有节点**
  （包括确实开了 SSH 的 Linux 机器）这个字段都是 `null`，它压根不填。看到 null 不代表故障。
- **从本机 ssh 自己的 `100.x` 地址** —— 内核把本机 tailnet IP 当本地地址直接环回，
  进不了 tailscaled 的隧道处理，撞上的是关着的系统 sshd，必然 `Connection refused`。
- **`tailscale debug netmap` 的 Hostinfo** —— 输出被裁剪，只剩 `Hostname`/`Services`。
- **`tailscale debug daemon-logs`** —— 常驻流式输出，会把脚本挂住。要用先想好怎么退出。

### 真正算数的两个

1. **控制端视角**：`https://login.tailscale.com/admin/machines` 看这台机器那行有没有 **SSH** 标记。
   本机上报了 SSH 主机密钥它才显示。
2. **端到端**：从**另一台**设备 `ssh <用户名>@<机器名>`。不问密码、不用密钥、直接进 shell = 成了。
   首次可能弹浏览器确认身份，这是策略里 `action: "check"` 的正常表现（每 12 小时一次）。

---

## 别的机器能不能互连

| 平台 | 能被 Tailscale SSH 进 | 能当客户端 |
|---|---|---|
| Linux | ✅ | ✅ |
| macOS（tailscaled） | ✅ | ✅ |
| macOS（GUI 版） | ❌ | ✅ |
| **Windows** | ❌ **没有服务端** | ✅ |
| iOS / Android | ❌ | 需第三方 App |

要 ssh 进 Windows 只能开它自带的 OpenSSH Server（管理员 PowerShell）：

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service sshd -StartupType Automatic
Start-Service sshd
```

⚠️ 这条走 tailnet 加密通道但**不是 Tailscale SSH**：不受 ACL 管控、没有 `check` 二次确认、
密钥自己管。务必配 `PasswordAuthentication no` 只留公钥，否则等于在 tailnet 里开了个密码登录口。

---

## ACL：`acls` 和 `ssh` 是两段

`https://login.tailscale.com/admin/acls` 里 `acls` 段管普通网络访问，
**`ssh` 段单独管 Tailscale SSH，两者不通用**——ping 得通、网页打得开，ssh 照样可能被拒，
报错还很含糊，很容易误判成 tailscaled 装坏了。

Tailscale 建 tailnet 时默认就带这段，通常不用改：

```json
"ssh": [
    {
        "action": "check",
        "src":    ["autogroup:member"],
        "dst":    ["autogroup:self"],
        "users":  ["autogroup:nonroot", "root"],
    },
],
```

`autogroup:self` = 能连自己名下的设备，所以同一个账号下的多台机器天然互通，加机器不用改策略。

`"check"` = 每 12 小时首次连接要在浏览器点一次确认。**建议保留**：Tailscale SSH 全程无密码，
凭据等于「设备在手」，留一道人工闸比较踏实。嫌烦才改 `"accept"`。

保存报语法错多半是**逗号**问题（编辑器用 HuJSON，允许末尾逗号和 `//` 注释，但缺逗号照样报错）。

---

## 排查时的环境陷阱

- **macOS 没有 `timeout` 命令。** 要硬超时用 `perl -e 'alarm N; exec @ARGV' <命令>`。
- **`tailscale ssh` 子命令不接受 `-o` 参数。** 要传 ssh 选项就直接用系统 `ssh`——
  Tailscale SSH 本来就是给标准 ssh 客户端用的。`tailscale ssh` 只是可选包装，
  唯一实际价值是拿控制端公布的主机密钥自动校验对端（省掉首次那句 `authenticity can't be established`）。
- **守护进程 socket** 在 `/var/run/tailscaled.socket`。`install-system-daemon` 之后
  它是 root 属主，所以 `tailscale set --operator=$USER` 之前所有命令都要 `sudo`。

---

## 回滚回 GUI 版

```bash
sudo $BREW/opt/tailscale/bin/tailscaled uninstall-system-daemon
brew uninstall tailscale
sudo rm -rf /etc/resolver        # 见下方注意
sudo networksetup -setsearchdomains Wi-Fi "Empty"
```

⚠️ `/etc/resolver` 整个目录通常是 tailscaled 建的（很多 Mac 装 Tailscale 前没有这个目录）。
**先确认**装之前有没有：有的话别整删，只删 tailnet 后缀、`ts.net`、`search.tailscale`
和那一堆 `*.in-addr.arpa` / `*.ip6.arpa`。

然后从 `https://pkgs.tailscale.com/stable/#macos` 下 `.pkg` 装回 GUI 版，
后台删掉多出来的节点。回到 GUI 版后 MagicDNS + Taildrop 恢复，
但 **Tailscale SSH 服务端就没了**——那时要远程进这台 Mac 只能开系统自带 sshd
（系统设置 → 通用 → 共享 → 远程登录），配合只留公钥。

---

## tailscaled 版的日常用法差异

**Taildrop 变命令行**（Finder 集成没了）：

```bash
tailscale file cp ~/某文件.pdf <对方机器名>:    # 发出去
tailscale file get ~/Downloads                   # 收进来（不再自动落盘）
```

**升级**：

```bash
brew upgrade tailscale
sudo $BREW/opt/tailscale/bin/tailscaled install-system-daemon
sudo launchctl kickstart -k system/com.tailscale.tailscaled
```

**没有**菜单栏图标、**没有**自动更新，这是固有代价。
