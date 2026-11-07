# Architecture

ChatGPT canonical Site plugin → authenticated stateless POST /mcp → tool router → image/HTML pipeline → WeChat APIs → readback verifier. The Site supplies the stable per-site user ID; no client-provided user IDs are trusted.

- `lib/mcp-tools.ts`: eight compatible original tools plus `wechat_prepare_and_save_draft`, complete machine-readable input schema and server instructions.
- `lib/wechat-image.ts`: public HTTPS/DNS preflight, bounded download, strict Base64, metadata/pixel checks, WASM PNG/WebP plus JavaScript JPEG/GIF decode, EXIF transpose, alpha flatten, baseline JPEG encode, output SHA-256/dimensions/bytes. 128 KiB inline cap remains deliberate to keep chat tool transport bounded; larger images use URL. Image IDs and local filesystem paths are not downloadable inputs.
- `lib/wechat-format.ts`: parser-based static HTML allowlist, canonical inline CSS (18px/1.85, h2 23px, navy/gold), safe line wrapping, structured reference numbering, structural readback comparison. It does not invent or rewrite article prose.
- `lib/wechat.ts`: existing encrypted account client and D1 receipts, image upload and draft CRUD. High-level pipeline persists intent before submit; checks ambiguous submissions by recent-draft scan; no blind retries.
- D1: `wechat_connections`, `wechat_images`, `wechat_receipts`. Schema unchanged. R2 remains disabled. Existing runtime encryption key and production rows are preserved.
- Worker entry, auth helper, manifest and migration remain unchanged. Original plugin/app identity and audience are preserved by native Sites update.

No logs contain uploaded bytes, Base64, article HTML, account credentials or signed URL query strings. Public backup contains only synthetic test images. Secrets, production DB and temporary Sites credentials are intentionally excluded; this is a source backup, not a complete data disaster-recovery backup.

Remaining bounds: no animation flattening, input cap 4M pixels, bounded reconciliation latest 200 drafts, DNS preflight is separate from fetch resolution, no browser-driven actual WeChat phone preview or autonomous new ChatGPT conversation creation.

Actual integration note: WeChat may rewrite img src to data-src and CDN rendition /0 to /640; comparison canonicalizes only the known qpic identity. External anchors were stripped by the actual account, so their clickable behavior is not verified. Plain-text reference destinations are retained, and missing requested anchors never count as a successful readback.
