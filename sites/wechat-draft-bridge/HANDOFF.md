# Handoff — 2026-11-07

Original project: appgprj_6aed4c1fef588191b5b8f417f70bcc82. Pre-upgrade: Sites v3/service 1.0.1, source be1f5d2b65ffd22889d8bfeda43ca2a57cb2f322. Before-upgrade GitHub backup commit: 574836fd10a79d856b510b855eff46661c8dfce5.

Prepared release: service 1.1.0, Sites source 820632affa2ecd86596cd88944d13fa9c7f03d7c. Deployment NOT YET PERFORMED at this commit; follow-up will record native terminal result.

## Completed

Recovered and inspected original tracked source, actual MCP tools, storage and deployment code. Confirmed owner and working original account. Mirrored/verified all 133 original files before edits. Preserved eight original tools and added wechat_prepare_and_save_draft. Implemented URL/Base64, image decode/conversion/EXIF, deterministic mobile HTML, structured reference numbering, readback content/style comparison and durable unknown-outcome lookup without duplicate add. No schema, auth, key, audience or plugin identity change.

Passed: TypeScript, 26 behavioral regressions, actual workerd Request semantics, production build, built Worker PNG/JPEG/GIF/WebP uploads and complete pipeline using temporary D1 with mocked WeChat. These do not establish real WeChat integration.

## Pending acceptance

- Save/deploy same Sites project and record returned version and status.
- Verify live account; create only test draft, verify actual title/cover/body/images/styles and same-ID retry.
- Check new tool in a genuinely new ChatGPT conversation. Current automation cannot itself start a signed-in new conversation; fresh protocol requests are a separate weaker check.
- Actual WeChat phone preview NOT performed. Local browser preview connection was refused while daemon reported running. `node --experimental-vm-modules scripts/test-wechat.mjs --layout` generates outputs/mobile-qa.html for 360/390/430 CSS px; no browser or phone acceptance claimed.
- Check GitHub Actions result after mirror push.

## Limits/recovery

Base64 <=128 KiB, total MCP body <=512 KiB; use URLs for larger multi-image requests. Image input <=10 MiB/4M pixels, animated images rejected, composition retained without crop. Unknown-result lookup scans latest 200 drafts and never retries add if lookup cannot uniquely identify a match. Retained v3 archive supports same-project rollback without DB migration; no live rollback drill performed. See DEPLOYMENT.md.


## Follow-up: actual v4 integration

Sites v4/service 1.1.0 deployed successfully at 2026-11-07T00:07:08Z, deployment appgdep_6aee6ba534f881919734443e846325f5, environment revision remained 1. Existing account remained configured. Real Base64 cover/body uploads and public HTTPS URL→WeChat upload succeeded. One test draft created; title/digest/cover/text/styles passed, but strict readback exposed WeChat rewriting img src→data-src and /0→/640, and removing external link anchors. No repeat draft was created. 1.1.1 fixes only CDN-image normalization; missing external anchors remain a real validation failure. Structured references now include visible destination URLs so the source is not lost when WeChat strips anchors. CI's test/build steps all passed but setup-node cache cleanup failed; removed optional cache configuration.

Prepared follow-up source: d09939e0807c703373730dda539563f32224e74e. Deployment pending at this commit. 27 local regressions and built Worker tests passed.
