---
name: workbuddy-daily-checkin
description: 领取 WorkBuddy 桌面端「Buddy加油站」每日签到积分，查询签到状态并排查失败。当用户要求 WorkBuddy 签到、Buddy加油站领积分或定时签到时使用。需在本人已登录 WorkBuddy 的机器上运行。
---

# WorkBuddy 每日签到领积分

> ⚠️ **免责声明（发布前请务必阅读）**
> 本 skill 通过复现 WorkBuddy 桌面端客户端**未公开的内部接口**（`/v2/billing/meter/daily-checkin`）来领取积分，
> 依赖当前客户端版本内部的登录态文件路径与接口形态，**WorkBuddy 版本更新后可能失效**。
> 它仅读取**运行者本人机器上**的登录态文件，不含任何共享凭据；请仅用于你自己的账号，并自行承担使用风险。
> 脚本不写死用户名 / 机器目录，按平台用 `os.homedir()` 自动推导路径。

## 用途
复现 WorkBuddy 桌面端「Buddy加油站 → 立即领取」按钮背后的请求，自动领取每日签到积分。
脚本直接调用客户端内部接口；其稳定性取决于当前客户端和服务端版本。

## 何时使用
- 用户要求自动 / 定时领取 WorkBuddy 签到积分。
- 用户提到 "Buddy加油站" / "每日签到" / "积分活动" / "自动领积分"。
- 需要把该流程做成 automation（定时任务）或排查领取失败。

## 逆向得到的接口（核心，非显而易见，且不含任何个人凭据）
> 以下域名 / 路径 / 请求头是 WorkBuddy 客户端公开调用的，与具体用户无关；
> 仓库不包含用户 token 或密码。脚本读取本地登录态，刷新成功后会将新 token 写回该文件。
- 后端域名：`https://www.codebuddy.cn`（`api.codebuddy.cn` 返回 404，`console.codebuddy.cn` 不通）。
- 查询状态：`POST /v2/billing/meter/checkin-activity-status`（body `{}`）。
- 领取：`POST /v2/billing/meter/daily-checkin`（body `{}`）。
- 本地登录态文件（由 WorkBuddy 客户端写入，含 `auth.accessToken` / `auth.refreshToken`）：
  - Windows 标准位置：`<USERPROFILE>\AppData\Local\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop.info`
  - macOS 位置：`~/Library/Application Support/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info`
  - 脚本按当前平台用 `os.homedir()` 自动推导，**不写死用户名 / 机器目录**；若自动定位失败，可用环境变量 `WORKBUDDY_AUTH_INFO` 指定该文件绝对路径。
- 必需请求头：`Authorization: Bearer <JWT>`、`X-User-Id: <account.uid>`、`X-Product-Code: workbuddy`（缺此头后端报 400 / 错误码 17043）；`X-Device-Token`（Turing 风控头）实测非必需。
- token 刷新：`POST https://www.codebuddy.cn/auth/realms/copilot/protocol/openid-connect/token`，`grant_type=refresh_token&client_id=console&refresh_token=...`，返回新 access_token / refresh_token。
- 客户端实现位于 WorkBuddy 安装目录的 `resources/app.asar`（Electron 归档，内部 JS 为明文，可直接用 node 读二进制后 `indexOf` 搜字符串，无需整包解压）。

## 执行步骤
1. 运行脚本（需 Node 18+，使用全局 `fetch`）：
   ```
   node <skill_dir>/scripts/claim_workbuddy_checkin.js
   ```
   - 若运行环境里 `node` 不在 PATH，可改用本机 node 绝对路径。
   - `<skill_dir>` 为本 skill 所在目录。
2. 脚本自动完成：读取本机登录态 → 若 accessToken 5 分钟内过期则用 refreshToken 续期并写回 → 查询今日是否已签到 → 未签到才领取 → 打印结果（成功 / 已领 / 异常）。
3. 仅在用户要求定时运行时，使用目标机器的计划任务工具；明确时区、时间、运行账号及脚本路径。云端任务无法直接读取用户电脑登录态，不要假设各 Agent 具有相同 automation API。

## 注意事项 / 可移植性
- **不含共享凭据**：仓库不携带 token 或密码；脚本会读取本人登录态并可能写回刷新结果。不要输出登录态文件、Authorization 头或 token。
- **路径可移植**：路径按平台 + `os.homedir()` 推导，换机器 / 换用户名无需改代码（仅 WorkBuddy 安装到非默认位置时可能需 `WORKBUDDY_AUTH_INFO` 覆盖）。
- 仅使用运行者本人账号；内部接口不等于受支持的公共 API。执行会提交签到请求，并可能刷新及修改本地登录态；按当前活动规则和实际返回结果判断。
- 幂等：今日已签到则跳过，重复运行安全；脚本不会重复扣费或重复领。
- 登录态文件失效（退出登录 / 改密码）时 refresh 会失败，脚本报错退出，不会越权操作。
- 若 WorkBuddy 改版导致登录态文件位置或接口路径变化，回到 `app.asar` 重新 grep `daily-checkin` / `checkin-activity-status` 即可定位新实现。

## 验收与来源

- 以实际响应判断领取积分数，不保证默认 100 积分仍有效。
- 成功或今日已签到是预期结果；状态/领取异常应视为失败，不能只凭进程退出码判断。
- 本次迁移仅检查结构和 JavaScript 语法，未访问真实账号或实测积分活动。
- 来源：ha2fde/workbuddy-daily-checkin，源提交 c40a65f12aed797f9f290f073219c89f50490089。保留同目录 LICENSE（MIT）。
