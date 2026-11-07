# Verified Incidents and Lessons

## 2026-11-06: WeChat cover upload and mobile formatting

**Observed:** Google Drive URL-based image upload was rejected with an error indicating only ChatGPT HTTPS image links were supported for `image_url`, with Base64 or private upload as alternatives. A direct Base64 JPEG upload via the existing MCP succeeded and returned a WeChat `media_id`. A second cover with approved wording also uploaded. Draft cover replacement succeeded and readback verified. User reported that the resulting image displayed quickly.

**Not established:** Whether the earlier slow rendering was caused by network/cache, unsupported image transport, JPEG progressive encoding, pixel dimensions, or another factor. A successful upload and one fast preview do not isolate root cause. JPEG files do not preserve editable Photoshop layers.

**Preventive action:** Use supported Base64 upload; target 900×383, RGB baseline JPEG, modest byte size; confirm media ID and readback; ask for actual phone preview to assess speed.

**Formatting regression:** Recreating a draft removed in-body emphasis while retaining headings. Later eight key emphasis spans were restored and readback verified. Preserve emphasized phrases through revisions, not only headings.

**Other known issues:** Long MCP request/code blocks wrapped incorrectly on mobile despite appearing correct on PC; reference numbering was incomplete. Both require explicit mobile QA before delivery.

**Safety:** Never put AppSecret, AppID, personal account details or private source material in public repository content. No auto-publication.

## 2026-11-07: plugin tool registry lag
Sites v7 / MCP 1.2.0 ran and advertised delete_test_draft, yet a separate fresh ChatGPT conversation still exposed only nine old schemas and rejected test_draft before sending. Separate runtime capabilities, plugin tool registration, and an installed Skill trigger in diagnosis. Do not create new unmarked test drafts while deletion is unavailable.
