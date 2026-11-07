---
name: wechat-publisher
description: Use for any request mentioning 微信公众号、公众号文章、公众号草稿、公众号配图、封面、排版、草稿箱 or WeChat Official Account; write, format, upload images, save drafts and independently verify with the connected wechat_prepare_and_save_draft MCP tool.
---

# WeChat Publisher

Use when the user requests a 微信公众号 article, rewrite, cover, image, draft, or publishing workflow. The user controls final publication; default to **draft only**.

## Default execution route — live MCP 1.1.1 (verified 2026-11-07)

**Trigger phrases:** “写一篇公众号文章”, “帮我写公众号”, “生成公众号封面/配图”, “排版公众号”, “保存到公众号草稿箱”, “修改公众号草稿”, “公众号文章配图并保存”, “公众号文章发布前准备”, “WeChat Official Account article/draft”. Treat semantic equivalents the same, not only exact phrases.

**Tool/schema vs Skill:** This GitHub Skill supplies editorial rules and acceptance checks. The installed 公众号草稿助手 MCP supplies callable tool schemas and server-side workflow. Merely putting this file on GitHub does NOT force automatic Skill loading in every ChatGPT conversation; an installed/connected MCP can still be discovered directly. The current deployed v5 / MCP 1.1.1 already advertises `wechat_prepare_and_save_draft` in its tool catalog and server instructions. Do not claim a separate chat has auto-read GitHub unless it actually fetched it. A conversation already writing an article may need a fresh instruction to re-check the latest tool catalog.

**Decision policy:**
- User asks for **ideas, research, outline, or article text only**: compose text; do not create a WeChat draft without authorization.
- User asks for **a new article and explicitly to save to draft box**: after finalizing content and a real cover image source, call **`wechat_prepare_and_save_draft` first** (not manually reconstructing the older multi-tool pipeline). It accepts `request_id`, `title`, `digest`, `content`, `content_format`, `cover`, optionally `body_images` and `references`; image source is exactly one of accessible direct HTTPS `image_url` or real raw image-byte `image_base64` (<=128 KiB). For body images add `{{image:id}}` placeholders as standalone lines and match each `body_images[].id`. The server produces 18px navy/gold mobile HTML, uploads images, creates a draft and reads back. Never invent image URLs or pass a ChatGPT image handle as a URL.
- User asks to **update an existing draft**: read `wechat_get_draft` and use `wechat_update_draft` with the latest `content_hash`; do not accidentally create a new draft.
- User asks to **publish/send**: do not treat draft saving as publication. Existing connector has no formal publish/send tool.

**Idempotency and truthful status:** Generate a distinct `request_id` for a new operation; retry the *same operation with identical arguments and the same request_id*. If a write times out or outcome is unknown, reconcile using the draft list / known ID before any other write. Report `created`, `media_id`, `readback_verified`, separate check results, and `published=false`. A successful write with `links=false` is NOT a fully verified draft; preserve the created draft and do not re-create it. Inline external anchors were stripped by the real WeChat account on 2026-11-07; visible plain-text URLs or `content_source_url` do not prove tappability. Actual phone preview remains unverified until checked on WeChat mobile.

**Source of current production truth:** [Sites HANDOFF](../../sites/wechat-draft-bridge/HANDOFF.md), [release verification](../../sites/wechat-draft-bridge/RELEASE-VERIFICATION.json), [deployed MCP tool schema source](../../sites/wechat-draft-bridge/source/lib/mcp-tools.ts). Earlier Base64 Files Library workarounds are *legacy fallback only*, never the first route when the new high-level tool is available. Actual available tool schema always takes precedence over historical documentation.

## Non-negotiable acceptance gate

For any new article, follow [Publishing contract](references/publishing-contract.md) as the **source of truth**. Do not mark work complete without actual WeChat cover media_id, draft creation/update, and successful readback. The approved 18px/23px mobile layout and engaging, evidence-grounded narrative are mandatory. If a cover upload fails, solve that specific failure before claiming the article is ready. No silent fallback to an old cover or text-only draft.

## Mandatory new-conversation bootstrap

When a user asks for a new WeChat article or draft, **before drafting**, retrieve the latest version of this GitHub SKILL.md and its reference files, especially the mandatory publishing contract and image-upload runbook (or use a verified installed copy). Treat these as the user's canonical preferences. Never substitute a stale chat summary or a remembered older version. Confirm the currently connected WeChat MCP input schema before any image upload. If GitHub access is unavailable, state that the canonical skill could not be loaded and use the known defaults below; do not claim you loaded it. A GitHub repository cannot force automatic loading in arbitrary ChatGPT conversations; a new chat must explicitly request the bootstrap or have a compatible skill integration.

**Known-good article baseline:** The 2026-11-06 GPT-6 Cyber draft was successfully updated with 18px body, 23px headings, navy/champagne-gold styling, 1.85 line-height, generous paragraph spacing, bold key statements, prominent navy hero and concluding highlight, mobile-safe references, and readback verification. Use this as a styling reference, not as content to copy. Cover upload succeeded using an actual 900×383 JPEG file (~71KB) encoded as Base64, then a new WeChat media_id was saved into the draft and read back.

## Operating contract

1. Confirm the article goal and audience from context. For traffic-focused writing, use an accurate curiosity-driven headline, opening tension, relatable scenario, concrete insight, practical payoff and share-worthy ending. No fabricated case studies, statistics, endorsements, or guaranteed virality.
2. Privacy: default to generalized examples. Never expose personal projects, work, account credentials, internal security findings or identifiable anecdotes without explicit permission.
3. Compose a complete article; avoid generic motivational filler. Keep mobile paragraphs short. Preserve substantive claims and original title wording when the user asks for visual-only changes.
4. **Approved canonical mobile typography (2026-11-06): body 18px / line-height 1.85; section headings 23px / 1.5; dark navy and restrained champagne gold. Do not revert to 16px/20px or cyan for this user's default WeChat design without explicit request.** Keep 1–2 highlights inside each section and mobile-safe wrapping. Bold or color-highlight selected **in-body** key sentences (not only headings), with roughly 1–2 highlights per section. Never turn every paragraph into a callout.
5. WeChat cover default target 900×383 (about 2.35:1), JPEG RGB baseline, optimized for visual clarity and modest file size (prefer ~80–150 KB when feasible; not an official hard limit). Keep critical text in safe center region; inspect alternative crop previews. Never change the approved words in the image without consent.
6. For newly authorized draft creation, use the deployed `wechat_prepare_and_save_draft` high-level tool first. It obtains cover `media_id`, body image URLs, formatting and readback automatically; prefer a verified direct public HTTPS image URL, or raw-byte Base64 <=128 KiB. Use the lower-level upload path only as a diagnosed fallback. Ordinary Google Drive sharing URLs are not direct image URLs.
7. Create/update draft, then **read it back**. Check exact title, digest, media ID, body, highlighted spans, sections, image references, references numbering, mobile line wrapping of URLs/code/MCP requests. Do not say successful until the readback confirms.
8. Report independently: image uploaded, draft updated, readback verified, phone preview checked, and published. Tool-side readback does NOT prove actual phone loading performance.
9. Never publish, send, or delete without the user's explicit instruction. A request to put in the draft box does not authorize publishing.
10. After a verified failure or improvement, update the incident log and skill rules, with observed facts separated from hypotheses. Do not claim background automatic monitoring or cross-session auto-loading.

## Troubleshooting order

- Upload fails: inspect the exact MCP input contract; compare a previously successful small JPEG and a new image, using identical supported transport. Differentiate unsupported URL, invalid Base64, media_id mismatch, file format, and image size.
- Slow image: record where (ChatGPT preview, draft editor, phone article, published page), size, dimensions, encoding, client/network and whether upload/readback succeeded. Small files can still load slowly for transport/cache reasons. Do not attribute to layers: JPEG is flattened.
- Formatting lost: inspect returned HTML; restore inline `strong` emphasis and headings without altering content. Check mobile wrapping and reference indices.
- Preserve a known-good draft until the replacement is verified.

## Local deterministic preparation

For local image generation/optimization, [scripts/prepare_cover.py](scripts/prepare_cover.py) can prepare image bytes (requires Pillow). **Current live MCP 1.1.1 now provides a tested high-level one-click draft workflow, including image retrieval/conversion and readback.** The old Files Library Base64 bridge is a fallback for inaccessible image bytes, not a mandatory step. Cross-chat MCP discovery was actually tested on 2026-11-07; automatic loading of this separate GitHub Skill is not established.

## References
- [Mandatory publishing contract](references/publishing-contract.md)
- [Mandatory image-upload byte bridge](references/image-upload-runbook.md)
- [Visual and QA checklist](references/quality-checklist.md)
- [Incident log](references/incidents.md)

## Image bridge: legacy fallback preflight (2026-11-06)

- **Do not equate a generated ChatGPT image preview with accessible bytes.** Before promising an upload, obtain a real local file or reachable HTTPS download URL. An image-generation result identifier is not a file path, URL, or Base64 content. Never invent a sandbox path.
- Check the currently connected MCP schema on every run. The hosted `wechat_upload_image` currently accepts either `image_url` (server-downloadable HTTPS) **or** `image_base64` (raw bytes, maximum 128 KiB), not both. `purpose=cover|body`; cover max 10 MiB and body max 1 MiB through URL transport. The local/open-source MCP may have different limits; follow the actual tool contract, not an assumed universal limit.
- **If high-level URL transport cannot be used:** use the approved image file, flatten and convert to RGB JPEG, resize appropriately (cover 900×383), compress to <=128 KiB if using Base64, then upload raw file bytes encoded as Base64. Check JPEG magic bytes and decode before upload. If larger, use a genuinely reachable HTTPS image URL. Do not use an unrelated existing cover as a silent fallback.
- **Error-code discipline:** WeChat 40113 and 40137 were returned during attempted uploads on 2026-11-06. Treat these as observed API errors, not proof of a specific root cause. A 1×1 diagnostic PNG returning 40137 is not evidence that a valid, correctly encoded approved JPEG would fail. Record input format, actual size, tool result, and independently verified outcome. Do not repeat unverified speculative diagnoses.
- **Gate draft readiness:** Cover uploaded and media_id confirmed; body illustrations uploaded and their WeChat-hosted URLs inserted; full inline CSS saved; draft read back; exact image refs, titles, references and highlighted spans checked. If any gate fails, label draft **incomplete**. Never declare a complete illustrated article from a text-only draft.
- **Do not overwrite user-approved visuals or text** while debugging. If updating an existing draft, fetch its current content/hash and preserve its identity rather than creating duplicate drafts.
- **ChatGPT installation limitation:** GitHub publication makes this Skill installable by compatible clients via their Skill managers. It does not automatically register a new skill inside this ChatGPT session. Never claim it is installed or automatically loaded without an installation/availability check.
