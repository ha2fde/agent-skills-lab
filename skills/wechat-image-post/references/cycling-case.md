# Cycling image-post regression: four separate cards (2026-11-07)

## User-approved creative contract
One shared headline/caption for the entire WeChat 图片消息, and four independent 3:4 portrait images, target 1080×1440 each. Four visual focal points:
1. Adult female road cyclist: vivid, high-impact overall fashion silhouette, helmet, fitted professional jersey and bib shorts.
2. Elegant face, expressive portrait, iridescent mirrored cycling glasses and premium technical gear.
3. Healthy athletic build, muscular thighs and calves, powerful cycling posture.
4. Three friends at café after a ride, one holding a portable premium Leica Q-style camera and photographing another, with visible mutual interaction, coffee and bikes.

Use coherent bright editorial color, striking contrast and clear focal hierarchy. Moderate suggestive fashion is fine; avoid objectifying extreme closeups. Do not use the user's private firsthand café observation in the public caption.

## Observed repeated failures
- Four image descriptions were bundled into a single generation, repeatedly yielding a 2×2 collage, even after the user explicitly demanded four separate deliverables.
- Later, one standalone image was generated, but subsequent requests again produced a collage.
- A collage was cropped into separate files, which technically created four files but reduced detail and weakened the original impactful visuals.
- The assistant mistakenly showed illustrative search images rather than the actual file outputs and overstated verification.
- The user had to repeat the same constraint many times.

## Correct testable protocol
For four cards, run image generation FOUR separate times, one card per call; inspect each result before proceeding. Reject any image containing multiple cards. Do not crop a collage as the default fix. Check actual independent file count and 3:4 dimensions. Save the outputs separately. Present exactly four real generated outputs plus ONE shared caption; no per-image publish captions. If using prior images, identify and preserve the user's approved originals, and disclose any crop/upscale.

## Approved post copy direction
Headline: 骑行女孩的吸引力，真的不只是一条紧身裤
Caption: visual impact of fitted cycling apparel, colorful eyewear, healthy leg strength, friends riding together, coffee and compact-camera portraits; finish with the appeal of an active social lifestyle. Avoid claiming a personal encounter or precise location.

## Acceptance criteria
- Four independent native outputs, not one four-panel poster.
- Each 3:4 portrait, default 1080×1440 when possible.
- One image, one focal theme; shared visual identity.
- One unified post title and caption.
- No user-private story disclosure.
- No claims of successful GitHub, WeChat or image QA without actual evidence.
