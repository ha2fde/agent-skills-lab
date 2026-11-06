# WeChat MCP upgrade: implementation and release plan

Status: **source access pending**. Existing WeChat connector is functional, but current tools do not expose the Sites project's editable source or deploy operation. This is a specification, NOT evidence that the live MCP was upgraded.

## Non-negotiables
- Update the existing Sites-backed WeChat MCP, preserving project identity, plugin/app ID, hosting, secrets, account connection and existing drafts.
- Never copy AppSecret, access tokens, AppID or private images into this public repository.
- Never automatically publish; draft-only by default.
- Preserve old tool signatures and behavior. Add capabilities backward-compatibly.

## 1. Source recovery
1. Obtain edit access to the existing Sites project source using its owning editor or source repository; inspect existing server implementation, storage and deployment workflow.
2. Identify current `wechat_upload_image`, `wechat_create_draft`, `wechat_update_draft`, `wechat_get_draft` handlers and shared credential/HTTP clients.
3. Export or mirror sanitized source to a dedicated GitHub repository only after verifying no secrets, private account data, deployment bindings or credentials are committed. Preserve upstream deployment path.
4. Do not create a second production plugin or alter OAuth/secrets.

## 2. Proposed API change (requires real server schema review)
- Add `wechat_prepare_and_upload_image` accepting **one server-accessible image source** (HTTPS URL with SSRF protections, or bounded image bytes if connector transport supports them), purpose `cover|body`, and optional crop policy.
- A local path or ChatGPT-generated image ID is NOT server-accessible by default. Do not pretend otherwise. If source is not directly accessible, keep the proven bridge or add a first-party file integration only after its supported access contract is verified.
- Return media_id for cover, image URL for body, sha256, dimensions, bytes and processing status.
- Processing: decode safely, cap input size and pixel count, RGB, EXIF transpose, 900x383 cover crop with user-approved composition, baseline JPEG, bounded upload payload, timeout, retry with backoff only for safe/idempotent operations.
- SSRF controls: HTTPS-only, allowed hosts or verified signed image domains, reject private/loopback/link-local addresses, redirect checks, strict content-type and size/time limits.
- Add `wechat_save_verified_draft`: validate title/digest/HTML, enforce canonical mobile styles, resolve cover media ID, create/update with request_id idempotency and content_hash optimistic concurrency, read back and compare title, cover, body and references. Never silently substitute cover.
- Return structured statuses for each stage and explicit error codes. No claims of phone preview without actual phone test.

## 3. Formatting and editorial separation
- Skill owns writing quality, evidence, headline, article structure and citations.
- MCP owns deterministic HTML normalization and mobile QA. Canonical: body 18px/1.85–1.9, headings 23px/1.5+, 36–44px section spacing, navy/champagne gold, safe URL wrapping.
- Do not blindly rewrite article prose inside MCP. Preserve semantic content and in-body emphasis.
- In-article images must use WeChat-uploaded body URLs; cover uses thumb_media_id.

## 4. Regression test matrix
1. Cover JPEG 900x383 under 128KiB -> successful upload and media_id.
2. Oversized PNG, EXIF rotated image, transparent PNG, malformed image -> deterministic conversion or safe validation error.
3. Remote URL blocked/private IP/redirect/oversized payload -> safe failure, no upload.
4. Body illustration -> actual WeChat URL and preserved mobile sizing.
5. Draft create and update -> readback title, digest, body and cover; no duplicate on retry.
6. Simulated timeout after create -> lookup by request_id or existing drafts before retry; no blind duplicate.
7. Hash conflict -> reject stale update; don't overwrite.
8. 360px phone preview: headings, flowchart vertical, code/URLs wrap, no overflow; human preview is distinct from API readback.
9. Publication guard -> no publication endpoint invoked.

## 5. Rollout and acceptance
- Stage: test with a disposable draft and real uploaded cover. Keep production drafts untouched.
- Compare old tool behavior; deploy to existing project only after tests.
- Confirm new tools are visible in a **fresh ChatGPT conversation**; merely publishing a GitHub Skill does not guarantee automatic loading.
- Verify a complete end-to-end article in a new conversation, including image, mobile layout and readback.
- Only then mark the project completed. Keep a rollback snapshot of the prior deployment.

## Current verified work
- Skill and publishing contract updated in GitHub.
- Local cover preprocessor at `skills/wechat-publisher/scripts/prepare_cover.py` created.
- Actual live Sites MCP source and deployment not yet accessible in current session; no server-side upgrade has been performed.
