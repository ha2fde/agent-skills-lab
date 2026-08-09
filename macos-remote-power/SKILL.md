---
name: macos-remote-power
description: 配置 macOS 电源策略，让 Mac 在插电时保持唤醒以便随时远程登录（SSH / 屏幕共享 / VNC），拔掉电源后自动恢复省电。当用户抱怨「远程连不上因为 Mac 睡着了」、要装防休眠 App（Amphetamine / Caffeine / KeepingYouAwake）、问 pmset 怎么设、或者想给「不休眠」加触发条件时使用。
---

# 让 Mac 随时能被远程登录

## 目标行为

```
插电 + 开盖  →  10 分钟屏幕黑掉（省电，不影响任何东西）→ 一直醒着，SSH 随时能进
拔掉电源     →  恢复原来的省电策略，带出门不费电
```

一条命令就能做到，**不需要装任何防休眠 App**。

---

## 先分清三种「睡」

macOS 里这是三件独立的事，最常见的误解就是把它们混为一谈：

| | pmset 参数 | 含义 | 对远程登录的影响 |
|---|---|---|---|
| **显示器休眠** | `displaysleep` | 屏幕黑掉 | **无影响**。黑屏 ≠ 休眠，系统照跑 |
| **整机休眠** | `sleep` | 系统进入睡眠 | ❌ **致命**，网络断，连不上 |
| **硬盘休眠** | `disksleep` | 机械盘停转 | 无影响（SSD 上基本没意义） |

典型的笔记本默认值是 `displaysleep 10` + `sleep 1`，意思是**闲置约 11 分钟就彻底睡死**。
远程登录场景下这是主要杀手。

---

## 命令

```bash
sudo pmset -c sleep 0
```

- `-c` = **只改「接通电源」这套策略**（charger）。`-b` 是电池，`-a` 是两者都改。
  只想插电时生效就用 `-c`，电池策略保持省电。
- `sleep 0` = 整机休眠的空闲计时器设为「永不」
- 写入 `/Library/Preferences/com.apple.PowerManagement.plist`，**重启后依然生效**

**先记下原值再改**，方便回滚：

```bash
pmset -g custom | sed -n '/AC Power/,$p' | grep -E '^\s+sleep '
```

**台式机**（Mac mini / Studio / Pro，没有电池）只有 AC 一套策略，`-c` 和 `-a` 等价。

图形界面的等价开关：系统设置 → 电池 → 电源适配器 → 「接通电源时防止 Mac 自动进入睡眠」。
位置随 macOS 版本会挪，命令行更稳当。

---

## 为什么必须「开盖」

**合盖是 `pmset` 唯一管不住的情况。** 合上盖子且没有外接显示器时，Mac 一定会睡，
电源策略改成什么都没用。

这才是防休眠 App（Amphetamine 的 Closed-Display Mode 之类）唯一不可替代的用途。
如果能接受开盖放着，就完全不需要它们 —— 这是本 skill 推荐的做法：**规则简单，没有额外软件，行为可预测**。

需要合盖运行的话：接外接显示器 + 电源（经典 clamshell 模式），或者用 Amphetamine 的
Closed-Display Mode（近几代 macOS 对合盖唤醒限制变多，要实测）。

---

## pmset 里那些容易误解的参数

跑 `pmset -g custom` 会看到一堆值，跟远程登录相关的：

| 参数 | 作用 | 能不能救你 |
|---|---|---|
| `ttyskeepawake 1` | 有远程 tty 会话（SSH 连着）时不进入空闲休眠 | ✅ **连上之后**不会中途睡着。默认就是 1 |
| `powernap 1` | 睡眠中定期短暂唤醒做 Time Machine、邮件、系统更新 | ❌ 只服务苹果自家服务，**不会让你能 SSH 进来** |
| `womp 1` | Wake on Magic Packet（网络唤醒） | ⚠️ 只能**同一个二层局域网**发魔术包，外网 / VPN / Tailscale 打不进来 |
| `tcpkeepalive 1` | 睡眠中维持部分网络存在感（查找我的等） | ❌ 不足以撑住 SSH |
| `hibernatemode` / `standby` | 睡久了把内存写盘 | 不睡就不起作用 |

**关键结论**：`ttyskeepawake` 解决的是「连上之后别睡」，**没有任何参数**能解决
「已经睡了还要连进去」。所以只能一开始就别让它睡。

唯一能「睡了还叫醒」的路子：同一 LAN 里有另一台常在线的机器（NAS、树莓派），
让它发 WoL 魔术包。但笔记本合盖 + Wi-Fi 的 WoL 很不可靠（通常要求插电，无线唤醒支持有限），
有线连着才稳。

---

## 代价

- **电费**：Apple Silicon 空闲、屏幕关闭大约 3–8W。全天不睡约 0.1 度电，一个月几毛钱
- **发热 / 风扇**：空闲状态基本不转
- **后台任务会跑**：Time Machine、Spotlight 索引、系统更新下载会在闲置时进行。多数情况是好事
- **电池**：插着电不涉及循环消耗，系统的优化充电会管住长期满电的问题

为了「随时能远程进来」，这些代价可以忽略。

---

## 它管不了的三件事

1. **合盖** —— 见上。这是最大的例外
2. **拔掉电源后** —— 电池策略没动，照样很快睡。这是刻意的
3. **手动睡眠** —— 苹果菜单 → 睡眠、⌥⌘⏻、合盖，都照样立刻睡。
   `pmset` 只管**自动**休眠

---

## 验证

```bash
pmset -g custom | sed -n '/AC Power/,$p' | grep -E '^\s+(sleep|displaysleep) '
```

`sleep 0` 就对了。

看当前谁在阻止休眠：

```bash
pmset -g assertions
```

`PreventUserIdleSystemSleep` 那行会列出发出断言的进程。注意有些工具（包括某些 CLI）
会自己拉 `caffeinate`，别把它误认成防休眠 App 在起作用。

---

## 回滚

```bash
sudo pmset -c sleep <原来的值>     # 笔记本常见默认是 1
```

要恢复整套出厂默认：`sudo pmset -a restoredefaults`（**会连电池策略一起重置**，慎用）。

---

## 顺带：卸载防休眠 App 时的坑

配好电源策略之后，Amphetamine / Caffeine / KeepingYouAwake 这类通常就多余了。删的时候：

**macOS 13 起有「App 管理」保护，命令行删不掉 `/Applications` 里的 App。**
`mv` / `rm` 会报 `Permission denied`，即使你在 admin 组、即使用 sudo 也可能不行。
必须在**访达**里拖进废纸篓（会要密码 / 触控 ID），或者去
系统设置 → 隐私与安全性 → App 管理 给终端授权。

用 `open -R /Applications/<名字>.app` 可以一步在访达里定位到它。

沙盒 App 还会在 `~/Library/Containers/<bundle-id>/` 留几十 KB 残留，
那个目录受 TCC 保护，命令行同样动不了，需要访达或完全磁盘访问权限。体积很小，不删也行。

**别给防休眠 App 配「某个后台服务在运行就不休眠」这类触发条件** ——
系统守护进程（launchd daemon）开机自启、24 小时常驻，这种条件恒为真，
等于「永不休眠」，还多绕了一层。要永不休眠就直接设永不休眠。
