---
name: wechat-publisher
description: Plan, write, visually format, upload and verify WeChat Official Account articles and drafts, including viral editorial strategy, privacy review, mobile readability, cover-image optimization and MCP troubleshooting.
---

# WeChat Publisher

Use when the user requests a 微信公众号 article, rewrite, cover, image, draft, or publishing workflow. The user controls final publication; default to **draft only**.

## Operating contract

1. Confirm the article goal and audience from context. For traffic-focused writing, use an accurate curiosity-driven headline, opening tension, relatable scenario, concrete insight, practical payoff and share-worthy ending. No fabricated case studies, statistics, endorsements, or guaranteed virality.
2. Privacy: default to generalized examples. Never expose personal projects, work, account credentials, internal security findings or identifiable anecdotes without explicit permission.
3. Compose a complete article; avoid generic motivational filler. Keep mobile paragraphs short. Preserve substantive claims and original title wording when the user asks for visual-only changes.
4. Mobile typography default: body 18px / line-height 1.85, section headings 23px / 1.5; dark navy + restrained champagne gold. Bold or color-highlight selected **in-body** key sentences (not only headings), with roughly 1–2 highlights per section. Never turn every paragraph into a callout.
5. WeChat cover default target 900×383 (about 2.35:1), JPEG RGB baseline, optimized for visual clarity and modest file size (prefer ~80–150 KB when feasible; not an official hard limit). Keep critical text in safe center region; inspect alternative crop previews. Never change the approved words in the image without consent.
6. Prefer uploading image bytes via the connected WeChat MCP `upload_image` Base64 input; obtain and retain returned `media_id`, then set `thumb_media_id` in draft. Ordinary Google Drive URLs were rejected in observed tests. If the image is generated as a local file, encode its bytes and use the supported bridge; do not repeatedly retry the same unsupported URL input.
7. Create/update draft, then **read it back**. Check exact title, digest, media ID, body, highlighted spans, sections, image references, references numbering, mobile line wrapping of URLs/code/MCP requests. Do not say successful until the readback confirms.
8. Report independently: image uploaded, draft updated, readback verified, phone preview checked, and published. Tool-side readback does NOT prove actual phone loading performance.
9. Never publish, send, or delete without the user's explicit instruction. A request to put in the draft box does not authorize publishing.
10. After a verified failure or improvement, update the incident log and skill rules, with observed facts separated from hypotheses. Do not claim background automatic monitoring or cross-session auto-loading.

## Troubleshooting order

- Upload fails: inspect the exact MCP input contract; compare a previously successful small JPEG and a new image, using identical supported transport. Differentiate unsupported URL, invalid Base64, media_id mismatch, file format, and image size.
- Slow image: record where (ChatGPT preview, draft editor, phone article, published page), size, dimensions, encoding, client/network and whether upload/readback succeeded. Small files can still load slowly for transport/cache reasons. Do not attribute to layers: JPEG is flattened.
- Formatting lost: inspect returned HTML; restore inline `strong` emphasis and headings without altering content. Check mobile wrapping and reference indices.
- Preserve a known-good draft until the replacement is verified.

## References
- [Visual and QA checklist](references/quality-checklist.md)
- [Incident log](references/incidents.md)
