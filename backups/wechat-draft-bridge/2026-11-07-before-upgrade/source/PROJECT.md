# 公众号草稿助手

Site-hosted private MCP plugin. Source project identity is in `.openai/hosting.json`.

The Site provides eight chat tools for connection status, read-only permission checks, draft listing/retrieval, image upload/listing, and draft creation/update. The setup website configures one WeChat Official Account per Site-scoped ChatGPT user. AppSecret, relay keys and cached access tokens are AES-GCM encrypted in D1 with user-bound additional authenticated data. The encryption key is a Sites runtime secret, never committed.

`WECHAT_CONFIG_ENCRYPTION_KEY`: Base64-encoded 32-byte AES key, configured through Sites runtime secrets. Do not rotate without a data migration.

WeChat account API permissions must be verified against the actual account. Hosted Worker egress is not guaranteed fixed. For IP-restricted accounts, configure the optional HTTPS relay hosted on a server with fixed public egress; the setup page supplies a dependency-free relay and Dockerfile.

Writes use per-account request receipts. Repeat the same request ID for a retry; if the upstream response is lost, the result is unknown and the connector refuses another write under that ID. Read the draft box before deciding to retry. There is no claim of distributed exactly-once delivery. Updates check the previously read article fingerprint before writing; a change in WeChat between that check and update cannot be made atomic by this API.

Image chat uploads prefer a short signed ChatGPT image URL; the server fetches it with no account headers, refuses redirects and limits downloaded bytes. Inline Base64 is limited to a 128 KiB image and decoded without a large intermediate character array. Larger local files use the existing private multipart form. MCP requests are bounded to 512 KiB, including streamed bodies. Per-tool production diagnostics record the tool, outcome, duration and safe error only; never arguments, credentials or signed image URLs.

Validation: `node node_modules/typescript/bin/tsc --noEmit`; `node --experimental-vm-modules scripts/test-wechat.mjs`; Sites build helper. Mock tests do not establish live WeChat account permissions.

Official API documentation references:
- https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add.html
- https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Update_draft.html
- https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Get_draft.html
- https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Get_draft_list.html
- https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/getStableAccessToken.html

These Tencent documentation pages were inaccessible from the authoring environment on 2026-11-06. API behavior is implemented using the established endpoint shapes and remains subject to the account's actual integration test.
