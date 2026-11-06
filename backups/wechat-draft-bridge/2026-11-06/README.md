# wechat-draft-bridge 原项目源码备份

备份日期：2026-11-06（北京时间）。

- 原项目 ID：`appgprj_6aed4c1fef588191b5b8f417f70bcc82`
- 原项目 URL：https://wechat-draft-bridge.hac2fde.chatgpt.site
- Sites 保存版本：v3
- 原源码提交：`be1f5d2b65ffd22889d8bfeda43ca2a57cb2f322`
- source/ 完整保留当前提交的 133 个受版本控制文件、文件模式及原始字节（785688 bytes）。
- MANIFEST.json 记录每个文件的 SHA-256、Git blob SHA-1、长度和模式，可逐文件验证。

## 部署配置

原配置保留在 source/.openai/hosting.json、source/vite.config.ts、source/worker/index.ts、source/package.json 和 source/pnpm-lock.yaml；D1 schema 及迁移位于 db/ 和 drizzle/。托管平台为 Cloudflare Workers，D1 绑定 DB，R2 未启用，capabilities 为 mcp。沿用原项目身份和访问策略（owner/custom），无需新建项目。

运行时变量元数据：WECHAT_CONFIG_ENCRYPTION_KEY 是平台已有 secret（revision 1）。接口隐藏其值；本备份不读取或复制密钥值。AppSecret、relay key、缓存 token 在 D1 内加密保存，生产数据库没有导出。更新原项目时必须保留原数据库绑定和原加密密钥；不可把这个公开源码备份当作数据库或灾备密钥备份。

## 安全排除范围

仅复制 git ls-files 中的当前源码，不复制 .git、历史提交、临时源码访问凭据、平台 bearer token、签名 URL、.env、.dev.vars、node_modules、dist 或运行时数据库。扫描疑似凭据字符串后，确认三处命中为测试用 mock 值（见 MANIFEST.json），当前源码无需改写。不要将平台 API 的原始响应加入公开仓库。

## 能否继续维护原项目

已验证当前账号为原项目 owner、可取回同一项目的完整源码，并成功获得该项目的短期源码访问凭据。源码 HEAD 与 v3 的 source.commit_sha 完全一致。可继续对原项目开发，并通过原项目 ID 的 Sites 保存/部署流程更新；短期凭据过期时重新申请同一项目的凭据即可。

本次没有修改原源码、没有向原源码仓库 push、没有新建项目、保存新版本、部署、修改线上变量、数据库或访问策略。未执行依赖安装/构建，也未试部署；因此部署通道具备权限和配置依据，但新的构建和实际发布成功尚未实测。浏览器打开 chatgpt.com/sites 后显示独立登录页面；源码恢复通过当前 ChatGPT 账号已连接的 Sites 接口完成。

## 验证方法

从 GitHub 读取该备份提交的递归 Git tree，将 source/ 下所有路径、模式、大小、blob SHA 与 MANIFEST.json 比较；要求文件数 133、字节总数 785688，缺失、额外或 SHA 不符数均为零。Git blob SHA 由原始字节计算并与原项目 git index 核对，因而可验证远端字节一致。
