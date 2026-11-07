# Repeatable regression checks

From `sites/wechat-draft-bridge/source` in a clean checkout:

```sh
corepack pnpm install --frozen-lockfile
node node_modules/typescript/bin/tsc --noEmit
pnpm test
pnpm build
pnpm test:built
```

In ChatGPT Work's Sites environment use its install/build helpers instead of corepack; the same lockfile, TypeScript and test scripts apply. CI runs the checks above with Node 24/pnpm 11.25.0. A standalone build defaults to the portable profile; no Sites identity registration or remote publication occurs.

`test-wechat.mjs`: mocked transport and tables; real image codecs/HTML parser; legacy tool schemas, encrypted user separation, URL/private DNS/base64/size/redirect/format validation, inline layout, code/URL wrapping, references, create/update/concurrency hashes, durable idempotency, lost response reconciliation, readback mismatch and error/log privacy.

`test-worker-request.mjs`: actual workerd request and redirect semantics.

`test-built-worker.mjs`: actual compiled production Worker including WASM modules, temporary D1 with original migrations, synthetic credentials, PNG/JPEG/GIF/WebP fixtures, mock outbound WeChat/DNS/image server; upload, high-level save/readback and duplicate prevention. It cannot accidentally contact the real WeChat account because outboundService intercepts all requests and rejects unknown paths.

27 behavior checks currently pass. GitHub CI source commit e3454cafab386712efea4fa68d7eae65c2d15586 passed all jobs. Actual integration is separate: call the installed plugin against the unchanged account, create one test draft and read it back. Report API verification separately from WeChat phone rendering and fresh ChatGPT conversation verification. Never use a generated image preview ID as image bytes.

## v1.2.0 删除回归

37 项行为检查覆盖可信来源、普通和仅标题带测试字样的文章拒绝、目标 ID 错配、人为修改、账号和用户隔离、微信权限失败、超时对账、确认不存在、同请求重试、并发与独立草稿保护。生产构建后的 Worker 使用临时 D1 和完全拦截的模拟微信接口运行创建、删除、重试及其他草稿不变的闭环。Node/TypeScript、构建及 workerd Request 测试均通过；[CI 42320089868](https://github.com/ha2fde/agent-skills-lab/actions/runs/42320089868) success（镜像源码 commit `f381148ca3178f4689fca195db0e9c99fe88fa49`）。这些测试不会连接真实公众号或删除任何线上草稿。新的 ChatGPT 会话仍需独立确认工具发现。
