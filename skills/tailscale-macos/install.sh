#!/bin/bash
# macOS Tailscale 装机脚本（开源 tailscaled 版，可当 SSH 服务端）
#
# 只在需要「让别的机器 ssh 进这台 Mac」时才用这个路线。
# 只是想上 tailnet 的话，装官网 .pkg GUI 版体验好得多。
#
# 用法：bash install.sh
# 也可以改名成 .command 放桌面双击运行。会问一次 sudo 密码。

set -u

say()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '  \033[33m⚠️  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m❌ %s\033[0m\n\n按回车关闭。\n' "$*"; read -r _; exit 1; }

printf '\033[1m===== macOS Tailscale 装机（tailscaled 版）=====\033[0m\n'

# ---------- 0. 平台与路径 ----------
say "检查平台"
case "$(uname -m)" in
  arm64)  BREW_PREFIX=/opt/homebrew ;;
  x86_64) BREW_PREFIX=/usr/local ;;
  *)      die "不认识的架构：$(uname -m)" ;;
esac
ok "$(uname -m) → Homebrew 前缀 $BREW_PREFIX"

TSD="$BREW_PREFIX/opt/tailscale/bin/tailscaled"
TS="$BREW_PREFIX/bin/tailscale"

# ---------- 1. 冲突检查 ----------
say "检查冲突（GUI 版和 tailscaled 会抢 utun，不能共存）"

if [ -d /Applications/Tailscale.app ]; then
  die "/Applications/Tailscale.app 还在。
     请先把它拖进废纸篓，然后【重启 Mac】（系统扩展只有重启才真正卸载），再跑这个脚本。"
fi
ok "没有 GUI app"

if systemextensionsctl list 2>/dev/null | grep -qi 'tailscale.*activated'; then
  die "还有已激活的 Tailscale 系统扩展。请【重启 Mac】后再跑这个脚本。"
fi
ok "没有残留的系统扩展"

if command -v brew >/dev/null 2>&1 && brew list --cask tailscale >/dev/null 2>&1; then
  warn "检测到 brew cask 版（也是 GUI 版）。正在卸载…"
  brew uninstall --cask tailscale || die "卸载 cask 失败，手动处理后重来"
  ok "cask 版已卸载"
fi

# ---------- 2. 回滚参考：记录装之前有没有 /etc/resolver ----------
if [ -d /etc/resolver ]; then
  RESOLVER_PREEXISTED=yes
  warn "/etc/resolver 装之前就存在 —— 以后回滚时【不要】整个删掉，只删 Tailscale 建的那些"
else
  RESOLVER_PREEXISTED=no
fi

# ---------- 3. Homebrew ----------
say "检查 Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  warn "没装 Homebrew。"
  printf '  现在安装？会从 GitHub 下载官方脚本，需要联网并输入密码。[y/N] '
  read -r ans
  case "$ans" in
    y|Y) /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
           || die "Homebrew 安装失败" ;;
    *)   die "没有 Homebrew 装不了。手动装完再来。" ;;
  esac
  eval "$("$BREW_PREFIX/bin/brew" shellenv)"
fi
ok "brew $(brew --version 2>/dev/null | head -1)"

# ---------- 4. 装开源版 ----------
say "安装 tailscale（--formula，不是 cask）"
if brew list --formula tailscale >/dev/null 2>&1; then
  ok "已安装，检查更新"
  brew upgrade tailscale 2>/dev/null || true
else
  brew install --formula tailscale || die "brew install 失败"
fi
[ -x "$TSD" ] || die "找不到 $TSD，brew 安装可能不完整"
ok "$("$TS" version 2>/dev/null | head -1)"

# ---------- 5. 装系统守护进程 ----------
say "装成开机自启的系统守护进程（要 sudo 密码）"
warn "装完之后不要用 'brew services start tailscale' —— 那会起一个用户级 agent 跟它抢 utun"
sudo "$TSD" install-system-daemon || die "install-system-daemon 失败"

printf '  等待 socket'
for _ in $(seq 1 20); do
  [ -S /var/run/tailscaled.socket ] && break
  printf '.'; sleep 0.5
done
printf '\n'
[ -S /var/run/tailscaled.socket ] \
  || die "守护进程 10 秒内没起来。查：sudo launchctl print system/com.tailscale.tailscaled"
ok "守护进程在跑（/Library/LaunchDaemons/com.tailscale.tailscaled.plist）"

# ---------- 6. 主机名 ----------
say "设置本机在 tailnet 里的名字"
DEFAULT_NAME=$(scutil --get LocalHostName 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')
[ -n "$DEFAULT_NAME" ] || DEFAULT_NAME="mac-$(date +%m%d)"
printf '  机器名 [%s]: ' "$DEFAULT_NAME"
read -r NODENAME
[ -n "$NODENAME" ] || NODENAME="$DEFAULT_NAME"
ok "用 $NODENAME"

# ---------- 7. 登录 ----------
say "登录 tailnet 并打开 SSH 服务端"
printf '  有 auth key 就粘进来（不回显），没有直接回车走浏览器登录\n'
printf '  （auth key 在 https://login.tailscale.com/admin/settings/keys 生成）\n'
printf '  key: '
read -r -s AUTHKEY
printf '\n'

UPARGS=(up --ssh "--hostname=$NODENAME")
if [ -n "$AUTHKEY" ]; then
  case "$AUTHKEY" in
    tskey-*) UPARGS+=("--authkey=$AUTHKEY"); ok "用 auth key 登录" ;;
    *)       die "auth key 应该以 tskey- 开头，你粘的不对" ;;
  esac
else
  warn "会弹浏览器 —— 注意别登错账号"
fi

sudo "$TS" "${UPARGS[@]}" || die "tailscale up 失败"
ok "已连上"

# ---------- 8. 免 sudo ----------
say "把 operator 设成 $USER（以后 tailscale 命令不用 sudo）"
sudo "$TS" set "--operator=$USER" || warn "设置失败，以后命令前面得加 sudo"
ok "operator = $USER"

# ---------- 9. 验证 ----------
say "验证"
printf '\n'
"$TS" status 2>&1
printf '\n'

"$TS" debug prefs 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for k in ('RunSSH','OperatorUser','Hostname','WantRunning'):
    v=d.get(k)
    mark='✅' if (k!='RunSSH' or v is True) else '❌'
    print('  %s %-14s %s' % (mark,k,v))
" 2>/dev/null || warn "读 prefs 失败"

printf '\n'
TAILNET=$("$TS" status --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
n=(d.get('Self') or {}).get('DNSName','')
print(n.split('.',1)[1].rstrip('.') if '.' in n else '')
" 2>/dev/null)

if [ -n "$TAILNET" ] && [ -f "/etc/resolver/$TAILNET" ]; then
  ok "MagicDNS：/etc/resolver/$TAILNET 已由 tailscaled 自动写好"
else
  warn "MagicDNS：/etc/resolver 里还没出现 tailnet 后缀，等几秒再看 —— 不用手工建"
fi

# ---------- 10. 后续 ----------
cat <<EOF

$(printf '\033[1m===== 装完了 =====\033[0m')

后台如果多出一条重名节点（比如 ${NODENAME}-1），说明旧记录还在：
  1. 去 https://login.tailscale.com/admin/machines 删掉旧的那条
  2. 回来跑：  tailscale set --hostname=$NODENAME && sudo dscacheutil -flushcache

$(printf '\033[1m验证 SSH 服务端 —— 本机查不出来，别在本机折腾\033[0m')
  · 后台 machines 页看 $NODENAME 那行有没有 SSH 标记
  · 从【别的机器】：  ssh $USER@$NODENAME    ← 不问密码直接进 = 成了
    首次会弹一次浏览器确认身份，这是策略里 action:"check" 的正常表现（每 12 小时一次）

  ⚠️ RunningSSHServer 这个字段在所有节点上永远是 null，不是故障，别拿它当依据。
  ⚠️ 从本机 ssh 自己的 100.x 地址必然 Connection refused（内核本地环回），不能用来验证。

日常升级：
  brew upgrade tailscale
  sudo $TSD install-system-daemon
  sudo launchctl kickstart -k system/com.tailscale.tailscaled

回滚（装之前 /etc/resolver 是否存在：$RESOLVER_PREEXISTED）：
  sudo $TSD uninstall-system-daemon
  brew uninstall tailscale
EOF

if [ "$RESOLVER_PREEXISTED" = "no" ]; then
  printf '  sudo rm -rf /etc/resolver          # 装之前没有这个目录，可以整删\n'
else
  printf '  # /etc/resolver 装之前就有，别整删！只删 tailnet 后缀、ts.net、\n'
  printf '  # search.tailscale 和那堆 *.in-addr.arpa / *.ip6.arpa\n'
fi

printf '\n按回车关闭。\n'
read -r _
