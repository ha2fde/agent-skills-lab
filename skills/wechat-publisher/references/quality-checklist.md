> Default only: 18px body, 23px headings, 1.85 line height, navy/champagne-gold. Honor each article's explicit background, text color, typography and spacing; never silently replace requested white/black with navy.

# WeChat Article QA Checklist

## Editorial
- [ ] Title has an honest, specific curiosity gap; avoid unsupported promises.
- [ ] First screen delivers tension and reason to keep reading.
- [ ] Reader can identify with the story; no unapproved personal details.
- [ ] Distinct thesis, useful examples, actionable conclusion, one natural engagement question.
- [ ] No invented statistics, testimonials, or success stories.

## Mobile presentation
- [ ] Mobile-safe type and spacing; when no style requested, body 18px, heading 23px, ~1.85 line height.
- [ ] Selective body highlights preserved after every edit.
- [ ] Long code, MCP payloads, URLs and English identifiers wrap correctly on mobile.
- [ ] Reference numbering continuous and complete.
- [ ] Inline CSS supported by WeChat editor; readback inspected.

## Images
- [ ] Cover ~900×383, JPEG RGB baseline, optimized bytes and safe crop.
- [ ] Approved Chinese headline wording unchanged.
- [ ] Main and alternative thumbnail crop visually checked.
- [ ] Cover uploaded to WeChat, `media_id` recorded.
- [ ] Body images separately optimized and uploaded when used.
- [ ] No claims about phone loading without actual phone preview.

## Delivery
- [ ] Draft created or updated; old draft preserved if requested.
- [ ] Readback matches title, content, emphasis, digest and `thumb_media_id`.
- [ ] Clearly distinguish draft success from publication.
- [ ] Final publication only on explicit instruction.

## Trigger and connected-tool checks
- [ ] Clarify whether the request explicitly authorizes saving a draft; writing alone does not.
- [ ] Confirm current callable schema rather than inferring from service version/capabilities.
- [ ] For a new synthetic test, mark test_draft=true only if callable; exact-ID cleanup only with trusted provenance. Legacy drafts are excluded.
- [ ] When saving was requested, let the user review in the draft box; report status succinctly, not the whole article in chat.

- [ ] If an article theme was requested, pass `theme` to the high-level MCP, read back `visual_style`, and inspect actual background/text/font. A saved draft with `visual_style=false` is not visually accepted.
