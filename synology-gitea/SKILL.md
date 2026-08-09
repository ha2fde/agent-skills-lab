---
name: synology-gitea
description: 在群晖 NAS（Synology DSM）上用 Container Manager 跑一个自建 Gitea，当作 GitHub 的第三份异地备份，并把本地仓库配成「一条 git push 同时推多个远端」。当用户说要自建 git 服务器、想在 NAS 上装 Gitea/Gogs、担心 GitHub 被封或封号想找备份、问怎么多远端同步、或者在没有终端的自动化环境里要远程操作群晖时使用。
---

# 在群晖上自建 Gitea

目标：本地一条 `git push` 同时推 GitHub + 云端镜像 + 自家 NAS，三份互不依赖。

**先确认这事值不值得做。** 只是怕**被墙**的话，用代理就够了，不需要自建 —— 自建防的是
**封号 / 仓库被删 / 平台跑路**这类「东西没了」的风险。两者别混。

---

## 群晖的三个反直觉前提

装之前先接受这三条，否则会在上面耗掉大半时间。

### 1. Tailscale SSH 在群晖上开不了

DSM 是 Linux，套件版 Tailscale 也是正经 `tailscaled`，但：

```
$ tailscale set --ssh=true
The Tailscale SSH server does not run on Synology.        # 退出码 1
```

这是**客户端侧的硬编码限制**，调参数、改 ACL 都没用。**别在这上面反复试。**

**尤其别指望「ssh 进去用官方脚本装静态二进制」能绕过。** 源码里
（`envknob/featureknob/featureknob.go` 的 `CanRunTailscaleSSH()`）判断用的是
`distro.Get() == distro.Synology`，而 `distro.Get()` 只看**机器上有没有 `/usr/syno` 目录**
—— 跟 Tailscale 从哪儿装的完全无关，同一份代码同一个检查。
（macOS GUI 版那条判断的是 `IsSandboxedMacOS()`，那是**构建产物**的属性，
所以换开源 tailscaled 真能解决。两者机制不同，容易混。QNAP 和群晖同款待遇。）

源码里唯一的口子是 `!envknob.UseWIPCode()`，即给 tailscaled 设 `TAILSCALE_USE_WIP_CODE=1`。
**不建议**：这开关是全局的，放行守护进程里所有未完成代码路径；Tailscale 把它挡在 WIP 后面
本来就是因为没在 NAS 上测过，何况 DSM 自己的 sshd 也占着 22。

要 ssh 进群晖只能开 DSM 自带的 sshd：控制面板 → 终端机和 SNMP → 勾「启动 SSH 功能」。
想收紧就用 DSM 防火墙把 22 端口限制到 `100.64.0.0/10`（Tailscale 的 CGNAT 段），
效果接近「只有 tailnet 能进」，但认证仍是密码/公钥，不是 tailnet 身份。

### 2. DSM 计划任务能当 root 跑脚本，但 PATH 是残的

完全没有 shell 的时候，**控制面板 → 任务计划 → 新增 → 触发的任务 → 用户定义的脚本**
（用户选 `root`，「运行命令」框里贴脚本，保存后选中 → 运行）是唯一的 GUI 提权入口。

但它的 PATH 里**没有 `/usr/syno/bin`**，`synopkg`、`synowebapi` 全部 `command not found`。
脚本第一行必须自己补：

```sh
export PATH=/usr/syno/sbin:/usr/syno/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

计划任务**没有回显**，脚本里要自己 `>> /tmp/xxx.log 2>&1`，否则失败了完全看不见。
一次性的任务跑完记得删掉 —— 配置写进系统后重启依然生效，留着只是多个定时炸弹。

### 3. Container Manager「装了但没启动」看起来和「没装」一模一样

`/usr/local/bin/docker` 是个**软链，只在套件运行时存在**。套件停着的时候：

```
-ash: /usr/local/bin/docker: No such file or directory
```

很容易误判成没装。先查状态再决定装不装：

```sh
synopkg status ContainerManager      # 输出 package ContainerManager is stopped / turned on
synopkg start  ContainerManager
synopkg is_onoff ContainerManager    # 确认开机自启
```

`synopkg install_from_server ContainerManager` 报 **错误码 150** 或
`Failed to load package info` = **已经装了**，不是失败。

---

## 没有终端时怎么在群晖上跑 root 脚本

agent / CI 这类环境里 `sudo` 和 `ssh` 都要 TTY，而且**不能让用户把密码贴进对话**。
两种通道二选一：

| 通道 | 适用 | 代价 |
|---|---|---|
| DSM 任务计划 | 完全没开 SSH | 无回显，要自己写日志文件，每轮都要人去点「运行」 |
| **base64 over ssh + 弹终端** | 已开 DSM SSH | 每轮人输一次密码，但**有完整回显** |

第二种是主力，模式如下 —— 脚本内容不经过命令行引号，输出落到文件由调用方直接读，
用户全程只需要输密码，不用复制粘贴任何东西：

```bash
# 1) 把要在 NAS 上以 root 跑的脚本写到本地 /tmp/nas-remote.sh
# 2) 编码后拼成一条 ssh 命令，输出 tee 到本地文件
B64=$(base64 < /tmp/nas-remote.sh | tr -d '\n')
cat > /tmp/nas-go.sh <<EOF
ssh -t <用户名>@<NAS-地址> "echo $B64 | base64 -d > /tmp/r.sh && sudo sh /tmp/r.sh; rm -f /tmp/r.sh" 2>&1 | tee /tmp/nas-out.txt
EOF

# 3) 弹一个真正的终端窗口出来（macOS），用户在里面输密码
osascript -e 'tell application "Terminal" to do script "sh /tmp/nas-go.sh"'

# 4) 用户说「好了」之后读 /tmp/nas-out.txt
```

要点：

- **`ssh -t` 必须有**，否则远端 `sudo` 同样读不到密码
- 一次会输**两遍**密码：ssh 登录一遍、`sudo` 一遍
- **别用 heredoc 直接喂 `sudo sh`** —— stdin 被脚本内容占了，`sudo` 就没地方读密码。
  base64 绕开的正是这个冲突，顺带躲掉所有引号转义问题
- 脚本里每步都 `echo` 一句标记，失败时才知道断在哪

**要不要为了省事在 NAS 上装公钥 + 配 NOPASSWD sudo？** 这是个安全取舍，得让用户自己定。
注意：**把 sudo 限制到只允许 `docker` 命令等于没限制** —— 能跑 docker 就能挂载宿主根目录，
docker root ≡ 完整 root。别拿「只放开 docker」当折中方案卖给用户。

---

## 岔路：Docker 还是套件版

装之前一定会有人问「套件中心里点一下不就完了」。先澄清事实（2026-08 核对）：

**官方套件中心里没有 Gitea。** 官方只有 **Git Server** —— 裸 git over SSH，
没有网页、没有 issue / PR，基本只是个带权限的共享文件夹。要装 Gitea 得先给 DSM
**添加第三方套件源 SynoCommunity**。SynoCommunity 确实有 Gitea（当时是 `1.26.2-29`，
上游最新 `1.27.1`，落后约一个小版本，维护得不算差）。

| | Docker（本 skill 的做法） | SynoCommunity 套件 |
|---|---|---|
| 来源 | Gitea 官方镜像 | 志愿者构建 + 他们自己的签名 |
| 前置 | Container Manager（官方源） | **给整个 DSM 加一条第三方软件来源** |
| 升级 | `docker compose pull && up -d` | 等维护者跟进；停更就卡在旧版 |
| 配置 | compose 里的环境变量，单文件、可版本控制 | 改 `app.ini`，照样得 SSH 进去 |
| 备份 | 一个目录 = 全部状态 | 数据散在 `@appstore` 等处 |
| 搬家 | compose 丢到任何 Linux 就能跑 | 绑死群晖 |
| 内存 | 多一层 Container Manager 常驻 | 原生跑，略省 |

值得权衡的其实只有两条：

- **套件版的实在好处是省内存。** Gitea 本身是个 Go 单文件吃不了多少，
  但 Container Manager 要一直开着。**NAS 内存紧张（2G 那档还跑着别的）时这条有分量。**
- **Docker 的实在好处是不引入第三方源。** 加 SynoCommunity 不是「只信这一个包」，
  是给整个 DSM 多开一条信任链，以后从那儿装的所有东西都走它。
  为一个能用 Docker 跑的服务开这个口子，通常不划算。

**换成套件版能省掉的坑很少**：只省了写 compose 和 `--force-recreate` 那条。
Tailscale SSH 进不了群晖、任务计划的残 PATH、没终端怎么拿 root、22 端口被 DSM 占着、
注册页返回 200 的验证陷阱 —— 一个都省不掉。这些是**群晖本身**的税，跟用不用 Docker 无关。

---

## 部署

### 端口

DSM 自己占着 22 和 80/443，所以：

| Gitea | 宿主端口 | 说明 |
|---|---|---|
| Web 3000 | `3000` | 冲突就换，改 `ROOT_URL` 即可 |
| SSH 22（容器内） | **`2222`** | 不能用 22 |

### compose 文件

放 `/volume1/docker/gitea/docker-compose.yml`（`docker` 共享文件夹是 Container Manager 的惯例位置）：

```yaml
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
      GITEA__server__DOMAIN: <NAS-地址>
      GITEA__server__ROOT_URL: http://<NAS-地址>:3000/
      GITEA__server__SSH_DOMAIN: <NAS-地址>
      GITEA__server__SSH_PORT: "2222"          # 对外公布的端口，写进克隆地址
      GITEA__server__SSH_LISTEN_PORT: "22"     # 容器内实际监听
      GITEA__service__DISABLE_REGISTRATION: "true"
      GITEA__service__REQUIRE_SIGNIN_VIEW: "true"
    volumes:
      - /volume1/docker/gitea/data:/data
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "3000:3000"
      - "2222:22"
```

- **sqlite3 足够**。个人自用几十个仓库，上 MySQL/Postgres 只是多一个要备份的东西
- `chown -R 1000:1000 /volume1/docker/gitea` —— 容器内 `git` 用户是 1000
- `INSTALL_LOCK: "true"` 跳过网页安装向导，直接进登录页

捆绑脚本 `install-gitea.sh` 是这一整段的可执行版本（顶部改几个变量即可），
按上面的 base64 通道丢到 NAS 上以 root 跑。

### 第一个用户

Gitea 里**第一个注册的账号自动成为管理员**。所以顺序是：

1. `DISABLE_REGISTRATION` 先留 `false`（或者干脆先不写这条）
2. 浏览器开 `http://<NAS-地址>:3000/` → 注册 → 这个号就是 admin
3. **再**把 `DISABLE_REGISTRATION` 改成 `true` 并重建容器

### ⚠️ 改了环境变量必须 `--force-recreate`

`GITEA__*` 只在**容器创建时**写进 `app.ini`。改完 compose 直接 `up -d` 会输出
`Container gitea Running` 然后**什么都不做**，配置一点没变。这个坑不报错，最难发现。

```sh
docker compose up -d --force-recreate
```

数据都在 volume 里，重建不丢东西。改完去容器里核对一眼才算数：

```sh
docker exec gitea grep -E 'DISABLE_REGISTRATION|REQUIRE_SIGNIN_VIEW' /data/gitea/conf/app.ini
```

---

## 验证：一个会骗人的信号

**`/user/sign_up` 在注册关闭时照样返回 HTTP 200。** 页面正文写着 "Registration is disabled"，
但状态码毫无区别。拿 `-o /dev/null -w '%{http_code}'` 去验会得到「没关成功」的错误结论。

要看**内容**：

```sh
curl -s http://<NAS-地址>:3000/user/sign_up | grep -ci 'registration is disabled'   # ≥1 才算关上
curl -s -o /dev/null -w '%{http_code}\n' http://<NAS-地址>:3000/<用户>/<仓库>       # 303 → 未登录被挡
```

`REQUIRE_SIGNIN_VIEW` 生效时匿名访问仓库会 **303 跳到 `/user/login?redirect_to=...`**。
这两条都过，才是真的锁上了。

顺带一个副作用要有心理准备：锁上之后 **`/api/v1/version` 匿名也问不出来了**（返回空）。
想从外面查版本号得带凭据，或者进容器 `docker exec gitea gitea --version`。

---

## 本地接进来

### SSH 配置

```
Host <别名>
  HostName <NAS-地址>
  Port 2222
  User git                 # 固定是 git，不是你的 DSM 账号
  IdentityFile ~/.ssh/<你的密钥>
  IdentitiesOnly yes
```

生成一把**不带密码短语**的专用密钥（`ssh-keygen -t ed25519 -C "nas-gitea"`），
公钥贴进 Gitea 的「设置 → SSH 密钥」。不带密码短语是为了 push 全程非交互。

**用公钥，别用 API 令牌。** 令牌是密码性质的东西、会过期、还容易漏进日志和对话记录；
公钥可以随便公开贴。

### 一条 push 推多个远端

```bash
git config --unset-all remote.origin.pushurl        # 先清干净
git remote set-url --add --push origin <github-url>
git remote set-url --add --push origin <镜像-url>
git remote set-url --add --push origin <别名>:<用户>/<仓库>.git
```

**两个必踩的坑：**

1. **第一条 `--add --push` 会把默认 push 地址顶掉。** 只加新的那条 = 从此不推 GitHub。
   **所有**地址都必须显式加进去，一条都不能省。
2. **首推别用 `git push -u <新远端> main`。** `-u` 会把上游改成新远端，
   之后裸 `git push` 只走那一个，多推白配。已经踩了就
   `git branch --set-upstream-to=origin/main main` 改回来。

验证：`git push --dry-run` 应该打印 **N 次** `Everything up-to-date`（N = 远端个数）。
再对一遍四处的 commit：

```bash
git rev-parse --short HEAD
git ls-remote <别名> refs/heads/main
```

---

## 别忘了收尾

- **容器自启**：`restart: unless-stopped` 只管 Docker 守护进程重启，
  还要 `synopkg is_onoff ContainerManager` 确认套件本身开机自启，否则 NAS 重启后整个没了
- **备份**：`/volume1/docker/gitea/data` 一整个目录就是全部状态，用 Hyper Backup 收进去
- **DSM SSH 要不要关回去**：关了就没有维护通道了，下次改配置只能走任务计划。
  长期建议是「关掉 + 需要时临时开」，但要跟用户讲清楚代价
- **一次性的计划任务用完删掉**

---

## 这套方案不解决什么

- **不是异地容灾。** NAS 和你人在同一个屋里，火灾进水一起没。真正的异地那层还得靠云端
- **不提供网页展示。** Gitea 有 Pages 的替代品但都要额外折腾，对外站点仍然靠 GitHub Pages
- **多推不是同步。** 只在你 push 的那一刻三边一致；在别处直接改了某一边不会自动传播
- **冷备还得单独做**：`git bundle create <名字>.bundle --all` 生成单文件，扔移动硬盘
