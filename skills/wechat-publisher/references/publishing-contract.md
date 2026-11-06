# WeChat Publishing Contract — mandatory for every new article

This is the canonical acceptance contract. A new conversation MUST load this file alongside SKILL.md, quality-checklist.md, and image-upload-runbook.md before starting. If not loaded, do not claim the canonical workflow was followed.

## Deliverable definition
The user's request to "write and save a WeChat article" means: editorial article + mobile-formatted HTML + approved cover image actually uploaded to WeChat + draft saved + readback verified. A generated picture or local JPEG alone is not a completed cover. A draft with a missing or recycled cover is NOT complete. Default is draft-only.

## Fixed design tokens
- Chinese body: 18px, line-height 1.85–1.9; paragraphs margin-bottom 20–24px; restrained letter spacing.
- Section headings: 23px, line-height >=1.5, margin-top 36–44px, margin-bottom 20–24px; use navy (#17283f or #18273e) and champagne gold (#c4a46a).
- Avoid dense left-border heading blocks, cramped colored text inside pictures/callouts, horizontal process chains, and long unbroken English/API/URL strings.
- A 900×383 cover image is for the cover, not a substitute for mobile-friendly in-article layout.
- In-body emphasis: ~1–2 gold/bold phrases per section. Keep readable contrast; do not bold whole paragraphs.
- Any diagram/process chain in body: vertical stack for phones, with generous spacing and 17–18px type. Prefer simple inline HTML that WeChat preserves.
- No external CSS, JS, web fonts or unsupported HTML. Use inline styles and simple section/p/h tags.
- Reference labels must be complete and consecutive; URLs need wrapping.

## Editorial voice
- Start with a grounded contradiction, human consequence or concrete question, not a generic AI introduction.
- Short paragraphs, clear narrative escalation, specific facts and caveats. Distinguish reported numbers from analysis.
- Build toward a memorable, defensible insight and one natural discussion question.
- No clickbait that contradicts the evidence, no invented sources or fabricated statistics.
- Preserve headline and approved cover wording during layout-only revisions.

## Image upload — hard stop gate
1. Obtain original image bytes. Optimize cover to 900×383 RGB baseline JPEG, <=128KiB for the hosted Base64 path.
2. Use the exact verified Library Base64 bridge in image-upload-runbook.md. Check current connector schema; do not blindly use Google Drive URLs, fabricated ChatGPT URLs, image IDs or inaccessible local paths as image_url.
3. Verify the actual uploaded cover media_id, use it as thumb_media_id. Body illustrations, when present, require their own uploaded WeChat URLs.
4. Create/update draft only after image gate succeeds. Read back and verify title, body, thumb, references and highlights.
5. If image upload fails, troubleshoot and retry with a valid transport; never silently fall back to a different cover, publish text-only, or declare success.
6. Delete transient Base64 files; retain source cover.

## Acceptance status
Report these separately: cover uploaded; body images uploaded (or none); draft saved; readback verified; mobile preview physically checked (or not checked); published (normally no). Tool-side readback is not a real phone screenshot.

## Update discipline
For a verified new regression: repair the actual draft first; then update this contract/runbook and incident log in GitHub and read back the committed content. Prompts are not a substitute for executable tooling.
