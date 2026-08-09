#!/bin/bash
# 让 Mac 插电时保持唤醒，方便随时远程登录（SSH / 屏幕共享）
#
#   插电 + 开盖  →  屏幕照常黑掉，但系统一直醒着
#   拔掉电源     →  恢复原来的省电策略
#
# 只改「接通电源」策略，不动电池策略。
# 用法：bash setup.sh        （会问一次 sudo 密码）

set -u

say()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '  \033[33m⚠️  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m❌ %s\033[0m\n' "$*"; exit 1; }

printf '\033[1m===== 配置 macOS 电源策略（远程登录用）=====\033[0m\n'

[ "$(uname)" = "Darwin" ] || die "这个脚本只能在 macOS 上跑"

# ---------- 有没有电池 ----------
if pmset -g batt 2>/dev/null | grep -q "InternalBattery"; then
  HAS_BATTERY=yes
else
  HAS_BATTERY=no
fi

# ---------- 读当前值 ----------
say "当前设置"
CUR_SLEEP=$(pmset -g custom 2>/dev/null | sed -n '/AC Power/,$p' | awk '$1=="sleep"{print $2; exit}')
CUR_DISP=$(pmset -g custom 2>/dev/null | sed -n '/AC Power/,$p' | awk '$1=="displaysleep"{print $2; exit}')
CUR_TTY=$(pmset  -g custom 2>/dev/null | sed -n '/AC Power/,$p' | awk '$1=="ttyskeepawake"{print $2; exit}')

[ -n "${CUR_SLEEP:-}" ] || die "读不到当前 AC 电源策略"

if [ "$HAS_BATTERY" = yes ]; then
  BAT_SLEEP=$(pmset -g custom 2>/dev/null | sed -n '/Battery Power/,/AC Power/p' | awk '$1=="sleep"{print $2; exit}')
  printf '  笔记本（有电池）\n'
  printf '  电池:  sleep=%s\n' "${BAT_SLEEP:-?}"
else
  printf '  台式机（无电池，只有一套 AC 策略）\n'
fi
printf '  插电:  sleep=%s  displaysleep=%s  ttyskeepawake=%s\n' "$CUR_SLEEP" "${CUR_DISP:-?}" "${CUR_TTY:-?}"

if [ "$CUR_SLEEP" = "0" ]; then
  ok "插电时已经是「永不自动休眠」，不用改"
  NEED_CHANGE=no
else
  NEED_CHANGE=yes
  printf '\n'
  warn "现在插电闲置约 $(( ${CUR_DISP:-0} + CUR_SLEEP )) 分钟后整机休眠 → 远程就连不上了"
fi

# ---------- 改 ----------
if [ "$NEED_CHANGE" = yes ]; then
  say "把插电时的整机休眠改成「永不」"
  printf '  会执行:  sudo pmset -c sleep 0\n'
  printf '  原值 %s 会记在下面的回滚命令里。继续？[Y/n] ' "$CUR_SLEEP"
  read -r ans
  case "${ans:-y}" in
    n|N) printf '\n已取消，什么都没改。\n'; exit 0 ;;
  esac
  sudo pmset -c sleep 0 || die "pmset 执行失败"
  ok "已设置"
fi

# ---------- ttyskeepawake ----------
if [ "${CUR_TTY:-1}" != "1" ]; then
  say "顺带打开 ttyskeepawake（SSH 会话连着时不进入空闲休眠）"
  sudo pmset -c ttyskeepawake 1 && ok "已打开" || warn "设置失败，不影响主要目标"
else
  ok "ttyskeepawake 已经是 1 —— SSH 连上之后不会中途睡着"
fi

# ---------- 验证 ----------
say "验证"
pmset -g custom 2>/dev/null | sed -n '/AC Power/,$p' \
  | grep -E '^[[:space:]]+(sleep|displaysleep|disksleep|ttyskeepawake) ' | sed 's/^/  /'

NEW_SLEEP=$(pmset -g custom 2>/dev/null | sed -n '/AC Power/,$p' | awk '$1=="sleep"{print $2; exit}')
printf '\n'
if [ "$NEW_SLEEP" = "0" ]; then
  ok "插电时永不自动休眠"
else
  die "sleep 还是 $NEW_SLEEP，没生效"
fi

# ---------- 说明 ----------
cat <<EOF

$(printf '\033[1m===== 配好了 =====\033[0m')

现在的行为：

  插电 + 开盖  →  ${CUR_DISP:-10} 分钟屏幕黑掉（省电，不影响任何东西）
                  → 一直醒着，远程随时能进
EOF

if [ "$HAS_BATTERY" = yes ]; then
cat <<EOF
  拔掉电源     →  回到电池策略（sleep=${BAT_SLEEP:-?} 分钟），带出门不费电
EOF
fi

cat <<EOF

$(printf '\033[1m必须开盖\033[0m')
  合盖且没有外接显示器时 Mac 一定会睡，pmset 管不了。
  这是唯一需要防休眠 App（Closed-Display Mode）的场景。

$(printf '\033[1m别误会的两点\033[0m')
  · 屏幕黑掉 ≠ 休眠。黑屏时系统在跑、网络在线、SSH 照常
  · 锁屏也不影响 SSH —— 远程登录不依赖 macOS 的图形登录状态

$(printf '\033[1m回滚\033[0m')
  sudo pmset -c sleep $CUR_SLEEP

EOF
