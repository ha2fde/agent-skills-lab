---
name: wechat-publisher
description: 自动匹配微信公众号写作、配图、封面、排版、修改草稿、保存到草稿箱、读回验收和安全清理测试草稿等自然语言要求，包括“帮我写公众号”“写一篇公众号文章，配图并保存到草稿箱”与语义等价表达。Use for WeChat Official Account articles and drafts. Only save when explicitly requested; never formally publish without separate authorization.
---

# WeChat Publisher

Use when the user requests a 微信公众号 article, rewrite, cover, image, draft, or publishing workflow. The user controls final publication; default to **draft only**.

## 自动触发与原插件路由（服务端 MCP 1.2.2）

**Trigger phrases:** “写一篇公众号文章”, “帮我写公众号”, “生成公众号封面/配图”, “排版公众号”, “保存到公众号草稿箱”, “修改公众号草稿”, “公众号文章配图并保存”, “公众号文章发布前准备”, “WeChat Official Account article/draft”. Treat semantic equivalents the same, not only exact phrases.

**Tool/schema vs Skill:** 已安装的个人 `wechat-publisher` 是自然语言自动触发入口，并读取本 GitHub 规范；GitHub 文件自身不能自动安装。原 Sites 项目 v8 / MCP 1.2.1 已在维护会话恢复十个工具及 `test_draft` 参数；1.2.2 增加文章级 `theme`。新会话仍须以实际可调用 schema 为准。以当前会话真正可调用的 schema 为准；不能把服务端能力声明当成插件目录同步成功。

**Explicit tool mapping:** `wechat_connection_status` checks the account; `wechat_prepare_and_save_draft` creates only when saving was requested; `wechat_get_draft` reads back or prepares an update; `wechat_update_draft` modifies the exact existing draft; `wechat_delete_test_draft` is restricted to eligible, newly marked test drafts and requires a callable current schema. For a new synthetic test, use `test_draft=true` only if the high-level tool's *callable schema* includes it and the title starts `【测试草稿·勿发布】`; after acceptance, delete only its precise ID. The three legacy drafts are ineligible.

**Decision policy:**
- User asks for **ideas, research, outline, or article text only**: compose text; do not create a WeChat draft without authorization.
- User asks for **a new article and explicitly to save to draft box**: after finalizing content and a real cover image source, call **`wechat_prepare_and_save_draft` first** (not manually reconstructing the older multi-tool pipeline). It accepts `request_id`, `title`, `digest`, `content`, `content_format`, `cover`, optionally `body_images` and `references`; image source is exactly one of accessible direct HTTPS `image_url` or real raw image-byte `image_base64` (<=128 KiB). For body images add `{{image:id}}` placeholders as standalone lines and match each `body_images[].id`. The server repairs cramped mobile typography and preserves safe per-article inline styling; optional `theme` supplies defaults where needed, uploads images, creates a draft and reads back. Never invent image URLs or pass a ChatGPT image handle as a URL.
- User asks to **update an existing draft**: read `wechat_get_draft` and use `wechat_update_draft` with the latest `content_hash`; do not accidentally create a new draft.
- User asks to **publish/send**: do not treat draft saving as publication. Existing connector has no formal publish/send tool.

**Idempotency and truthful status:** Generate a distinct `request_id` for a new operation; retry the *same operation with identical arguments and the same request_id*. If a write times out or outcome is unknown, reconcile using the draft list / known ID before any other write. Report `created`, `media_id`, `readback_verified`, separate check results, and `published=false`. A successful write with `links=false` is NOT a fully verified draft; preserve the created draft and do not re-create it. Inline external anchors were stripped by the real WeChat account on 2026-11-07; visible plain-text URLs or `content_source_url` do not prove tappability. Actual phone preview remains unverified until checked on WeChat mobile.

**Source of current production truth:** [Sites HANDOFF](../../sites/wechat-draft-bridge/HANDOFF.md), [release verification](../../sites/wechat-draft-bridge/RELEASE-VERIFICATION.json), [deployed MCP tool schema source](../../sites/wechat-draft-bridge/source/lib/mcp-tools.ts). Earlier Base64 Files Library workarounds are *legacy fallback only*, never the first route when the new high-level tool is available. Actual available tool schema always takes precedence over historical documentation.

## Test-draft cleanup policy (user-approved, 2026-11-07)

- Temporary drafts created **by the assistant solely for MCP regression/acceptance testing** must be deleted promptly **after verification**, not left in the user's real WeChat drafts. This cleanup authorization does **not** extend to real articles, drafts the user is writing, previously existing drafts, or any other draft whose provenance is uncertain.
- Before deleting, require positive identification: exact recorded `media_id` plus a readback matching test-only title and purpose. Never delete by loose prefix, date, position, or a broad “测试” title filter. List drafts again after deletion and confirm unrelated articles remain unchanged.
- If the connected plugin schema lacks `wechat_delete_test_draft`, **do not claim deletion** or seek secret keys. Check the actual callable schema after deployment; diagnose any stale directory before synthetic delete acceptance. Do not silently retain test drafts without reporting them. Do not silently retain test drafts without reporting them. Never repurpose `wechat_update_draft` as deletion.
- Current confirmed cleanup targets from testing only (not an authorization to delete any similarly named draft): `z-_mumxif9IVp3_gkx_RXJGW_-OYBrKi5TaNyLT5PDIl74zkZhRNS2AIb5PaIzx1` (MCP 1.1.1 手机排版回归), `z-_mumxif9IVp3_gkx_RXH__SjuAKGUyGoCOFfgkV8MExXmnljgEjn_aREYHYEDo` (新会话一键流程验收), `z-_mumxif9IVp3_gkx_RXOpUEjgw4pKbUcklp6LdPkGiHAfeF1dHaFTnosj_D6mR` (参考链接与正文图片). Read each again before any delete. This list may grow only from individually verified test-draft creation records.
- The server-side `wechat_delete_test_draft` exists in the current original project, but only a truly callable tool schema permits use. It requires exact media_id, stable request_id, server-owned test provenance, unchanged article and a post-delete readback. Historical test drafts lack trusted provenance; do not backfill or bypass it.

## Per-article visual style and acceptance gate

The server's `wechat_prepare_and_save_draft.theme` accepts optional `background_color`, `text_color`, `heading_color`, `accent_color` (six-digit hex), `font_family` (`system` or `serif`), `body_size` (14–22 px), `heading_size` (18–30 px), and `line_height` (1.5–2.2). Choose values from the user's current article direction; choose a non-flat palette when the user asks to replace a plain white-background black-text draft; the exact colors follow this article's direction. Use safe inline CSS in the article HTML for a chosen style, with or without `theme`; the latter is optional and may be absent from a cached tool schema. The updated high-level formatter preserves safe inline HTML colors, background, font and spacing even when the current tool catalog lacks `theme`. Use per-article HTML styling and verify `visual_style`; do not abandon the high-level workflow solely because the optional `theme` schema is stale. Never claim full visual acceptance if WeChat strips the chosen style. Read back the actual draft and check `visual_style` along with content; distinguish a WeChat sanitizer rewrite from successful rendering. Mobile wrapping, safe static HTML and truthful readback remain requirements.

## Non-negotiable acceptance gate

For an explicitly requested draft, follow [Publishing contract](references/publishing-contract.md) as the **source of truth**. Do not mark work complete without actual WeChat cover media_id, draft creation/update, and successful readback. Mobile readability and the user's selected per-article style are mandatory; readable 18px/23px typography is a baseline, while navy/gold is an optional fallback. If a cover upload fails, solve that specific failure before claiming the article is ready. No silent fallback to an old cover or text-only draft.

## Mandatory new-conversation bootstrap

When a user asks for a new WeChat article or draft, the installed personal `wechat-publisher` should trigger from natural language and retrieve this GitHub SKILL.md plus the mandatory publishing contract and image-upload runbook before drafting. Treat these as the user's canonical preferences. Never substitute a stale chat summary or a remembered older version. Confirm the currently connected WeChat MCP input schema before any image upload. If GitHub access is unavailable, state that the canonical skill could not be loaded and use the known defaults below; do not claim you loaded it. GitHub alone cannot force loading, but the installed personal Skill supplies a compatible trigger; verify its presence in a fresh conversation rather than inferring it from this file.

**Known-good article baseline:** The 2026-11-06 GPT-6 Cyber draft was successfully updated with 18px body, 23px headings, navy/champagne-gold styling, 1.85 line-height, generous paragraph spacing, bold key statements, prominent navy hero and concluding highlight, mobile-safe references, and readback verification. Use this as a styling reference, not as content to copy. Cover upload succeeded using an actual 900×383 JPEG file (~71KB) encoded as Base64, then a new WeChat media_id was saved into the draft and read back.

## Article genre routing — mandatory (2026-11-07)

Determine the **article genre before writing**, and do not blend incompatible styles by default.

- **Technical / architecture / product-analysis articles** (AI, cybersecurity, infrastructure, tools, agent systems, industry analysis): use an engineering/analytical style, **not a lyrical essay**. Lead with the core finding and decision-useful conclusion (in the first 2–3 paragraphs). Then explain the problem, architecture, key mechanisms, product comparison, operational constraints, and implications. Dense, factual, concise prose; clear short sections, concrete architecture paths, comparison dimensions, mechanism and trade-off explanations, precise terminology, and source-backed facts. Prioritize information density and completeness over rhetoric. Present key point first in each section; eliminate filler, poetic abstractions, repeated inspirational conclusions, decorative scenery and unsupported extrapolation. **Expand technical substance, not article length through padding.**
- **Humanistic / reflective / travel / personal-interest essays**: a narrative, sensory, exploratory or literary voice may be appropriate when the user asks for it. Keep that style separate from technical articles.
- A topic involving freedom or work-life meaning does not automatically make an AI architecture analysis a reflective essay. Treat the user's selected technical genre as controlling. A concise implications section is fine, but most space should go to design rationale, execution boundaries, real-world trade-offs, and a clear architecture model.
- For technical WeChat articles, favor a compact upfront **core conclusion**, then **3–6 high-density sections**, a product comparison across explicit dimensions, and a mobile-readable vertical architecture flow (identity/entry → task persistence/orchestration → tools/execution runtime → resources → artifacts/approval). Distinguish product-confirmed capabilities from proposed architecture, and local remote-control from true server-side persistence. Include operational aspects: asynchronous execution, scheduling, state checkpoints, offline/retry, data sync, permission boundaries, costs, security/audit, and actual limitations if relevant.
- Preserve user's private details by default. When revising an existing draft, update **in place** (get_draft → latest hash → update_draft → readback); keep its existing cover/images unless explicitly asked to change them. Avoid duplicating references or source lists.

### Technical article readability override (2026-11-07)

For public-facing technical WeChat essays, **technical does not mean engineering documentation**. The priority order is: **clear central insight → readable logic → meaningful technical depth → supporting facts**. Never equate information density with jargon volume, exhaustive checklists, product feature catalogs, or section count.
- Begin directly with the one core takeaway, ideally in the first sentence; remove repetitive throat-clearing and introductory filler.
- Explain one central question in a coherent progression: problem → intuitive architecture/mental model → selective product evidence → consequences and constraints. Prefer 4–5 sections where possible.
- Assume mainstream products are already known; do not write product introductions or complete inventories. Mention each only to demonstrate a *difference relevant to the thesis*.
- Use ordinary Chinese, concrete cross-device scenarios, and short purposeful paragraphs. Keep architectural depth at the level needed for comprehension; explain mechanisms in natural language before introducing technical terms. One simple mobile-readable architecture diagram often beats a specification-style five-layer stack.
- Human readability and insight are essential even in technical writing. Avoid both lyrical/personal essay filler **and** dry developer-document rhetoric. Keep facts, interpretation, and boundaries clear.
- Editorial self-test: can an informed reader state the single thesis after the opening, follow why each section exists, and understand why the product comparisons matter? If not, simplify before publishing.

### Visual-first mobile editing and references (2026-11-07)
- For technical WeChat articles, favor **one simple architecture image plus one compact comparison image**, with consistent typography, palette and visual language. Diagrams should be understandable on a phone without zooming; prefer vertically stacked, short-label cards over dense landscape tables or tiny side annotations.
- Remove excess whitespace **inside images and in surrounding HTML**. Avoid decorative empty paragraphs or repeated image captions. Uploaded images must be verified in actual draft content.
- When the reader benefits more from a visual than prose, show the visual first and keep supporting prose short and nonduplicative.
- A **references section is optional, not mandatory**. Omit it when it does not add reader value, there is no quotation/license requirement and the claims are noncontroversial or otherwise adequately grounded. Retain citations when necessary for unusual, contested, timely or specific claims; this is an editorial choice, not permission to omit necessary attribution.
- User revisions about illustrations, whitespace or references are **localized changes**: preserve the approved article's central thesis, title and architecture narrative; update the existing draft rather than rewriting the entire piece.

## Operating contract

1. Confirm the article goal and audience from context. For traffic-focused writing, use an accurate curiosity-driven headline, opening tension, relatable scenario, concrete insight, practical payoff and share-worthy ending. No fabricated case studies, statistics, endorsements, or guaranteed virality.
2. Privacy: default to generalized examples. Never expose personal projects, work, account credentials, internal security findings or identifiable anecdotes without explicit permission.
3. Compose a complete article; avoid generic motivational filler. Keep mobile paragraphs short. Preserve substantive claims and original title wording when the user asks for visual-only changes.
4. **Default mobile typography: body 18px / line-height 1.85; section headings 23px / 1.5; navy and restrained champagne gold. If the user specifies a different background, colors or typography for this article, pass a `theme` to the high-level tool and honor that request.** Keep 1–2 highlights inside each section and mobile-safe wrapping. Bold or color-highlight selected **in-body** key sentences (not only headings), with roughly 1–2 highlights per section. Never turn every paragraph into a callout.
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

For local image generation/optimization, [scripts/prepare_cover.py](scripts/prepare_cover.py) can prepare image bytes (requires Pillow). **Current live MCP 1.2.0 provides the high-level one-click draft workflow, including image retrieval/conversion and readback; new deletion schema discovery remains unverified.** The old Files Library Base64 bridge is a fallback for inaccessible image bytes, not a mandatory step. Cross-chat MCP discovery was actually tested on 2026-11-07; automatic loading of this separate GitHub Skill is not established.

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

## Visual editorial defaults — user-approved (2026-11-07)

For future WeChat articles, choose a visual direction for the article. Navy/gold is only an available fallback when the user gives no design direction. The user previously asked to replace a plain white-background black-text draft; never infer that white/black is the preferred target style. The selected style must survive formatting and readback. Create visual hierarchy with an editorial rhythm: vivid but restrained navy/champagne-gold title panels, section separators, meaningful pull quotes, breathing room, and varied blocks. Preserve 18px body/23px headings and mobile legibility; avoid turning every paragraph into a colored box. This is an optional baseline, never a rule overriding an article's requested visual style.

**Image selection:** Combine (a) genuine, verifiably sourced documentary/lifestyle/sports photographs that illuminate a real claim or human experience and (b) original legible diagrams explaining relationships, decision flows or architecture. Use photos for lived reality and diagrams for understanding. Do not substitute glossy photorealistic AI-generated people, generic lone-figure-at-sunset, decorative landscapes or repetitive AI fantasy imagery. If genuine photo licensing/attribution cannot be verified, do not misrepresent an AI-generated image as documentary photography. Check image relevance, source rights and attribution. Usually 2–3 purposeful body visuals are preferable to one image per section. Preserve selected photographs, diagrams and existing cover during typography-only revisions.

**Density:** Users favor concise articles that retain each chapter's unique argument and the full throughline, but remove restatements, repetitive rhetorical questions and motivational filler. During layout-only edits, keep approved text intact. When explicit copyediting is requested, tighten rather than add words, keep the core thesis and each section.

**WeChat renderer limitation confirmed 2026-11-07:** Using `wechat_update_draft` with inline CSS `background-color`, gold `strong` color, chapter backgrounds and padding returned a successful API write, but independent `wechat_get_draft` readback stripped those visual CSS properties. Therefore success status alone does NOT mean colorful backgrounds survived. After any styling change inspect actual returned HTML specifically for background/color properties. If stripped, use uploaded mobile-friendly decorative **image-based editorial bands or quote panels** rather than claiming inline background styling worked. Keep these occasional and meaningful; they supplement, not replace, the selected photographic and explanatory images. Verify all image URLs and keep the existing original draft/media ID.

**Completion protocol:** On a user-authorized draft edit, update the exact existing draft, read back independently, report what survived WeChat sanitization and what cannot be confirmed without mobile preview. Never claim public publication, phone rendering, or automatic cross-chat Skill loading.

## Reader-first sequencing and image restraint — user correction (2026-11-07)

- **Lead with substance, not decorative build-up.** For a short-attention audience, place the most important thesis, argument structure and/or explanatory diagram near the start (after a brief strong hook), not at the end. Order sections by reader value, not merely by chronology. The key visual should be discovered before the reader drops off.
- **Fewer, stronger images.** Every image must pass an independent information-value test: does it explain a concept, show evidence, or provide a distinctive real-world experience not already conveyed? Two excellent images beat five mediocre ones. Never pad an article with a running/finish-line photograph, quotation card, or other visual just because there is another section. The user specifically approved one documentary cliff-climbing photo and one clear conceptual/architecture diagram for the article "感谢这个世界是真实的". Removed redundant runner photo and both decorative quote-card images in the revised draft on 2026-11-07.
- **No ornamental images in lieu of typography.** Quote-card screenshots are not a substitute for solving text-background design. Make backgrounds, type color and hierarchy visually distinct only when they are actually supported and verified on the WeChat side. If the platform sanitizer strips CSS, say the background request is **not solved**. Do not declare it fixed because the save call succeeded or because extra images were inserted.
- **Platform limitation revalidated:** The WeChat draft service accepted added CSS `background`, `padding`, and gold emphasis in an update; independent `wechat_get_draft` removed the background and added text-color declarations. Thus a plain white canvas remains; it needs a *separate renderer/service fix and real readback or phone verification*, not another decorative card.
- After updates inspect image count and order, original cover ID, title, complete text/chapters and persisted background/text style. Report deficiencies explicitly.


## Market-facing editorial and draft-first review (2026-11-07)

- For public WeChat articles derived from private conversations, transform the idea into a **general market need / product landscape**. Do not use first-person anecdotes, locations, employers, holdings, brokerage accounts, travel details, or identifying clues unless explicitly authorized. Generalize scenarios without suggesting the author personally experienced them.
- Prefer **short, visual-first** public-facing copy. One clear thesis, a compact use-case comparison, existing market offerings, realistic limits; avoid long multi-section essays, repeated examples, and verbose introductions. Illustrations should explain the idea, not decorate it.
- **Draft-first review preference within authorized saving:** when the user explicitly requests saving a WeChat article, place it in the connected draft box for their own review and avoid pasting the full article into chat. A request only to write or rewrite text is not authorization to create a draft. Never formally publish without separate explicit authorization; report draft status and failed checks succinctly.
- Keep these reusable preferences public and generic; do not store the private triggering anecdote or user-specific financial details in this repository.

## Mobile readability defaults versus article style (2026-11-07)

The user's default means **repair poor mobile display**, especially cramped paragraphs, small body text, weak whitespace and overflow. It does not mean a fixed background or ink color. A white background with dark text, a dark background with light text, or another coherent palette may suit an individual article. In HTML input, safe inline `color`, `background-color`, approved `font-family`, 14–22px body / 18–30px headings, 1.5–2.2 line-height, bounded spacing and text alignment survive the v1.2.3 formatter. Unsafe positioning, URL CSS, scripts and tiny/cramped sizes are discarded. Readback checks `visual_style`; if WeChat changes it, report the mismatch. When choosing dark surfaces, explicitly style text and headings for contrast. Never confuse this baseline with authorization to override the user's chosen visual direction.

## Draft-bound visual delivery — mandatory correction (2026-11-07)

- For requests to write/revise a WeChat article with illustrations, the deliverable is the **updated WeChat draft**, not an image shown in ChatGPT. Do not generate or display unsolicited standalone pictures in the conversation and then stop. Any generated illustration is an intermediate asset only.
- **Required order:** determine article angle and concise text → prepare only genuinely useful visual(s) → obtain actual image bytes or valid direct URL → upload via WeChat tool → embed the returned WeChat-hosted body-image URL into the intended paragraph → update the **existing** draft with its latest content hash → independently read back and confirm the exact image URL exists in the saved article and appears in the correct order.
- If the image was generated but was not uploaded and embedded, it is **not delivered**. Never call the article illustrated or complete, and do not spend image-generation effort without a credible upload-and-insert path. If an image tool automatically shows a preview in chat, still finish the draft integration and avoid treating that preview as the result.
- Prioritize visual explanation for complex mechanisms; do not add decorative landscapes or unrelated illustrations. Keep the article concise, popular-technical and accessible. For new-adoption topics, lead with the transition from awareness to actual everyday use, not with a narrow edge-case risk. Explain safety boundaries briefly and proportionately.
- Report only confirmed outcomes: draft updated, body image uploaded, actual WeChat image URL present in readback, mobile preview checked or not. Never claim the user can see the image in the draft merely because it appeared in ChatGPT.

## Editorial intent is not article copy (2026-11-07)

- Treat the user's conversational explanations as **creative direction and editorial reasoning**, not automatically as phrases to copy into the headline, opening, diagram, or article. Phrases like “从听说到真正使用”, “先驱者的实验”, “让大众开始接受” can describe the desired market positioning without being publishable copy.
- **Two-stage translation before drafting:** (1) privately extract the actual reader-facing proposition, audience, useful examples, emphasis and exclusions; (2) write fresh, natural public-facing headline and prose based on those conclusions. Do not echo the user's meta-discussion or explain the writing strategy to readers.
- Apply a **headline contamination check**: reject titles that merely repeat the user's planning vocabulary, abstract slogans or marketing frameworks. Prefer a concrete reader question, actual capability or useful outcome. For example, an AI-mail article should foreground that ChatGPT can operate Gmail and what this enables, rather than a process slogan about adoption.
- Apply the same check to body copy and visuals. No invented personal first-person experience, unnecessary “大家都听过” claims, or narrative about how the author and assistant arrived at the angle. Remove boilerplate and overlong framing. A public technical explainer should be concise, accessible and benefit-driven.
- User feedback is guidance on **what to communicate**, not necessarily **how to phrase it**. Revisions should reinterpret intent, not perform literal find-and-replace. Keep approved assets only when their visible text and framing remain aligned with the revised thesis; replace outdated captions or images if they still repeat rejected slogans.
- For authorized WeChat drafts, implement changes directly in the existing draft and independently verify readback; do not paste the article into chat for review.
