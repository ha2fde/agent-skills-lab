# WeChat Publishing Contract — mandatory for every new article

This is the canonical acceptance contract. A new conversation MUST load this file alongside SKILL.md, quality-checklist.md, and image-upload-runbook.md before starting. If not loaded, do not claim the canonical workflow was followed.

## Deliverable definition
The user's request to "write and save a WeChat article" means: editorial article + mobile-formatted HTML + approved cover image actually uploaded to WeChat + draft saved + readback verified. A generated picture or local JPEG alone is not a completed cover. A draft with a missing or recycled cover is NOT complete. Default is draft-only.

## Fixed design tokens
- Mobile readability baseline: repair body text that is too small, cramped line spacing, inadequate paragraph whitespace and overflow. 18px / 1.85 and 20–24px paragraph space are useful defaults; safe article-specific choices take precedence.
- Headings should be clearly larger than body (around 23px / 1.5 by default). Color and background are chosen per article; navy/champagne-gold is an optional palette, not a mandatory treatment.
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
2. Prefer the deployed high-level MCP with a verified direct HTTPS image URL or real Base64 bytes <=128 KiB. Use the Library Base64 bridge only when source bytes cannot otherwise reach the server. Check the callable connector schema; do not use sharing pages, fabricated URLs, image IDs or local paths as image_url.
3. Verify the actual uploaded cover media_id, use it as thumb_media_id. Body illustrations, when present, require their own uploaded WeChat URLs.
4. Create/update draft only after image gate succeeds. Read back and verify title, body, thumb, references and highlights.
5. If image upload fails, troubleshoot and retry with a valid transport; never silently fall back to a different cover, publish text-only, or declare success.
6. Delete transient Base64 files; retain source cover.

## Acceptance status
Report these separately: cover uploaded; body images uploaded (or none); draft saved; readback verified; mobile preview physically checked (or not checked); published (normally no). Tool-side readback is not a real phone screenshot.

## Update discipline
For a verified new regression: repair the actual draft first; then update this contract/runbook and incident log in GitHub and read back the committed content. Prompts are not a substitute for executable tooling.

## Content-rich visual rhythm (default since 2026-11-07)
- The earlier problem was a plain white-background black-text draft that could not be restyled. Treat the new visual direction as article-specific; use hierarchy and spacing, and do not force the previous flat treatment back. Use designed hierarchy, purposeful contrast, warm paper/navy/champagne-gold accents, section rhythm and sparing quote/pull-quote panels. Keep enough uncluttered white space for mobile scanning; avoid bright backgrounds behind long paragraphs.
- **Mix authentic sourced photography and explanatory diagrams.** The former communicates real-world experience, challenge, stakes and consequences; the latter illustrates a thought structure, decision model or architecture. Each image must earn its place. Do not use stereotypical fantasy AI illustrations, photorealistic synthetic subjects disguised as real photos, or purposeless stock scenery. Verify rights and attribution for third-party photos.
- When asked to shorten, keep the article's core thesis and every distinct section's point, remove duplicated sentences and filler. Do not silently rewrite approved prose for a purely visual change.
- Existing cover and approved media remain untouched unless the user requests replacement. Update exact draft ID after fetching its latest content hash; never create an accidental second draft.
- **Renderer acceptance caveat:** On 2026-11-07, a valid inline CSS update with `background-color`, colored highlights and padded headings was accepted but these styling properties vanished from the WeChat get-draft readback. Treat such styles as unverified/not retained. Verify actual persisted markup, not only an API success flag. If colorful editorial bands are needed, upload and insert compact designed JPEG quote/section panels; keep them infrequent and readable alongside real photos and diagrams. Do not label an image-based solution as working HTML background CSS.
- Report whether real mobile preview was checked independently from server readback.

## Image-count and attention-priority acceptance (2026-11-07)
- Most valuable proposition/diagram goes early, after a concise hook, before extended argumentation. Important facts are not buried beneath multiple illustrations. For each subsequent image, require non-redundant explanatory or documentary value.
- Limit illustrated essays to **one strong explanatory diagram and one grounded documentary photo by default**, unless extra images are independently necessary. No redundant athletic, scenic, or quotation-card fillers. This is not a numeric hard cap for technical tutorials that legitimately need more diagrams.
- Never solve a complaint about flat white/dark typography by adding unrelated pictures. First establish which background/text CSS properties survive current WeChat server/editor sanitization. If not retained, mark typography/background task incomplete and address the rendering pipeline; no success claim based on tool's generic verification alone.
- For the real-world essay, the selected cliff-climber photo and early conceptual diagram are the user's preferred pair. Preserve the existing cover and avoid duplicating drafts.

## Intent and test-cleanup boundary
Writing, illustration or layout alone does not authorize creating a WeChat draft. When the user explicitly requests saving, deliver it to their draft box and let them review there instead of pasting a long full article in chat. New synthetic test drafts may use test_draft=true only when that parameter is actually callable, and must be removed by exact ID through the guarded delete tool after verification. Historical drafts lack trusted provenance and cannot pass that automatic gate. Source code and connection_status capabilities do not prove the ChatGPT tool catalog refreshed. Never formally publish without separate authorization.

- Preserve safe inline CSS for the chosen article palette and typography. A dark section needs explicit light text/headings; a light section may use dark text. Reject cramped 10px/1.1 formatting and unsafe positioning. Read back the actual style rather than assuming the server or WeChat kept it.
