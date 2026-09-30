#!/bin/sh
# 在群晖 NAS 上部署 Gitea。
#
# 这个脚本在 **NAS 上以 root 运行**，不是在你的电脑上跑。
# 两种送上去的方式：
#   A. 已开 DSM SSH —— 见 SKILL.md 的 base64 通道（脚本内容不过命令行，无引号地狱）
#   B. 没开 SSH     —— 控制面板 → 任务计划 → 用户定义的脚本（用户选 root），整段贴进去
#
# 幂等：重复跑不会弄坏已有数据，volume 里的东西一直在。

set -u

# ============ 改这几行 ============
NAS_ADDR="192.0.2.10"     # NAS 的地址，写进 Gitea 的 ROOT_URL 和克隆地址。用 tailnet IP 或域名
WEB_PORT="3000"           # 宿主机上的网页端口
SSH_PORT="2222"           # 宿主机上的 git-ssh 端口。**不能用 22**，DSM 自己占着
BASE="/volume1/docker/gitea"
LOCK_SIGNUP="false"       # 第一次装填 false（第一个注册的人自动成为管理员）
                          # 注册完管理员后改成 true 再跑一次
# =================================

# 计划任务的 PATH 是残的，没有这行 synopkg 会 command not found
export PATH=/usr/syno/sbin:/usr/syno/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

step() { printf '\n===== %s =====\n' "$*"; }
die()  { printf '\n!!!!! 失败: %s\n' "$*"; exit 1; }

step "0. 环境"
uname -a
[ -d /usr/syno ] || printf '注意: 没看到 /usr/syno，这可能不是群晖\n'
df -h /volume1 2>/dev/null | tail -1

step "1. Container Manager"
# 「装了但停着」看起来和「没装」一模一样：/usr/local/bin/docker 是软链，只在运行时存在
STATUS=$(synopkg status ContainerManager 2>&1)
printf '%s\n' "$STATUS"
case "$STATUS" in
  *"turned on"*|*started*|*running*) printf '已在运行\n' ;;
  *stopped*)
      printf '装了但停着，启动它\n'
      synopkg start ContainerManager || die "启动 ContainerManager 失败"
      sleep 5 ;;
  *)
      printf '看起来没装，尝试安装\n'
      # 错误码 150 / "Failed to load package info" = 其实已经装了，不算失败
      synopkg install_from_server ContainerManager 2>&1
      synopkg start ContainerManager
      sleep 8 ;;
esac
synopkg is_onoff ContainerManager   # 确认开机自启，否则 NAS 重启后整个没了

DOCKER=/usr/local/bin/docker
[ -x "$DOCKER" ] || die "$DOCKER 还是不在，Container Manager 没起来"
"$DOCKER" version --format '{{.Server.Version}}' 2>&1 | head -1

step "2. 目录"
mkdir -p "$BASE/data" || die "建目录失败"
chown -R 1000:1000 "$BASE"          # 容器里的 git 用户是 1000
ls -ld "$BASE" "$BASE/data"

step "3. 写 compose 文件"
# 整份重写而不是 sed 改 —— 群晖的 busybox sed 不认 GNU 的 \n 替换
cat > "$BASE/docker-compose.yml" <<YAML
services:
  gitea:
    image: gitea/gitea:1
    container_name: gitea
    restart: unless-stopped
    environment:
      USER_UID: "1000"
      USER_GID: "1000"
      GITEA__database__DB_TYPE: sqlite3
      GITEA__database__PATH: /data/gitea/gitea.db
      GITEA__security__INSTALL_LOCK: "true"
      GITEA__server__DOMAIN: ${NAS_ADDR}
      GITEA__server__ROOT_URL: http://${NAS_ADDR}:${WEB_PORT}/
      GITEA__server__SSH_DOMAIN: ${NAS_ADDR}
      GITEA__server__SSH_PORT: "${SSH_PORT}"
      GITEA__server__SSH_LISTEN_PORT: "22"
      GITEA__service__DISABLE_REGISTRATION: "${LOCK_SIGNUP}"
      GITEA__service__REQUIRE_SIGNIN_VIEW: "${LOCK_SIGNUP}"
    volumes:
      - ${BASE}/data:/data
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "${WEB_PORT}:3000"
      - "${SSH_PORT}:22"
YAML
cat "$BASE/docker-compose.yml"

step "4. 起容器"
cd "$BASE" || die "cd $BASE 失败"
# --force-recreate 不能省！GITEA__* 只在**容器创建时**写进 app.ini。
# 不加的话改完环境变量 up -d 只会打印 "Container gitea Running" 然后什么都不做，
# 配置一点没变，而且不报错 —— 这是最难发现的坑。
"$DOCKER" compose up -d --force-recreate 2>&1 || die "compose up 失败"
sleep 12
"$DOCKER" ps --filter name=gitea --format '{{.Names}}  {{.Status}}  {{.Ports}}'

step "5. 核对 app.ini（以容器里的实际内容为准）"
"$DOCKER" exec gitea grep -E 'DISABLE_REGISTRATION|REQUIRE_SIGNIN_VIEW|SSH_PORT|ROOT_URL' \
  /data/gitea/conf/app.ini 2>&1

step "6. 验证"
# 陷阱：注册关闭时 /user/sign_up 照样返回 200，只有正文写着 "Registration is disabled"。
# 拿状态码判断会得出「没关上」的错误结论，必须看内容。
printf '首页状态码: '
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:${WEB_PORT}/" 2>&1
printf '注册页含 "registration is disabled" 次数: '
curl -s "http://127.0.0.1:${WEB_PORT}/user/sign_up" 2>/dev/null | grep -ci 'registration is disabled'

cat <<EOF

===== 完成 =====

网页:  http://${NAS_ADDR}:${WEB_PORT}/
克隆:  ssh://git@${NAS_ADDR}:${SSH_PORT}/<用户>/<仓库>.git

LOCK_SIGNUP 现在是 ${LOCK_SIGNUP}。
  false → 现在去网页注册，**第一个账号自动是管理员**；
          然后把本脚本顶部改成 true 再跑一次，把注册关掉。
  true  → 注册已关闭，匿名访问仓库会 303 跳到登录页。

别忘了: synopkg is_onoff ContainerManager 要是 on，否则 NAS 重启后服务不会自己回来。
备份:   把 ${BASE}/data 整个收进 Hyper Backup，那就是全部状态。
EOF
