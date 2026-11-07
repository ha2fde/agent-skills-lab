---
name: wechat-image-post
description: Create and revise WeChat Official Account 图片消息/贴图/小绿书 as independent mobile-readable 3:4 image cards, with one topic per image, strict approved-content preservation, concise captions, and visual QA. Trigger for 微信贴图、公众号贴图、图片消息、小绿书、滑动图集、贴图文案、贴图比例 and equivalent requests. Do not confuse with ordinary WeChat articles.
---

# WeChat Image Post / 微信贴图

## Scope and routing
This skill is for WeChat Official Account **图片消息** (贴图/小绿书), NOT article body illustrations, article cover images, or chat stickers. It is complementary to `skills/wechat-publisher`, which handles ordinary article drafts. Read this skill and its references when the user asks for a new image post or revisions. GitHub storage alone does not guarantee auto-loading in future chats: retrieve the current file or use an installed skill copy. Do not claim automatic discovery was verified without testing.

## Mandatory bootstrap and routing
On a new image-post request, fetch this exact GitHub file and both references before producing images. This is a separate skill from ordinary article publishing. If a user says "贴图", "图片消息", "小绿书", "一组图片", "按之前的贴图规范", or requests revision of an image-post series, apply this contract. A GitHub file alone does not auto-load into every conversation; never pretend it was loaded without fetching it.

## Mandatory workflow
1. Identify audience, core message and number of **independent image files**. Draft a card-by-card content map. One card answers one central question; do not repeat a topic merely to fill space.
2. Research technical facts before illustration where necessary. Separate verified product specifications from assumptions and conceptual diagrams; avoid fabricated benchmarks and unwarranted absolute performance claims.
3. Lock a shared design system: **3:4 portrait**, default target **1080 × 1440**, consistent visual language, adequate font size and breathing room. Choose layout individually for each topic; do not force identical layouts.
4. **Execution-level invariant: ONE tool invocation = ONE standalone card.** For N cards, make N sequential image-generation calls, each asking for exactly ONE complete portrait image. Do not put multiple card descriptions in the same call. Explicitly say "single standalone 3:4 portrait image, no collage, no grid, no split panels, no contact sheet". Inspect each returned result before calling the next. A single 2×2 image is ONE file, never four. Do not use a multi-image prompt that produces a composite. Do not present a collage preview as a deliverable.
   - If the image generator still returns a collage, **reject and regenerate that card as an independent image**; do not accept it as satisfying N deliverables. Cropping an earlier collage is an explicitly labeled emergency salvage, not a successful original generation; do not upscale and call it native high-resolution.
   - Deliver N separately verified image files/attachments, one per card, with actual pixel dimensions and separate links only after their paths exist. Never substitute illustrative image-search previews for the actual generated files.
5. Inspect each result for actual aspect ratio, independent file count, Chinese text accuracy, legibility at mobile display size, hierarchy, clipping, overlaps, and factual consistency. Regenerate the individual failing image only.
6. Ask for approval when the user requests review. **Approved facts, narrative and key diagrams are locked**. A request to adjust ratio permits recomposition and resizing of layout, NOT changing the approved informational substance; never stretch, crop off text, or pad awkwardly as a substitute for real composition.
7. **One post, one shared title and one shared caption.** Image-specific visual emphasis is an internal art direction, not four separate public captions. Keep user-approved wording and edits scoped. Do not reveal private first-person observations, personal locations, or how the idea arose unless the user explicitly authorizes them. When requested, craft engaging, tasteful, slightly provocative copy without invented personal encounters.
8. Write short post title and caption that complement rather than narrate every image. Verify current WeChat 图片消息 character limits in the actual editor/API when possible; do not confuse them with ordinary article limits. Editorial targets: title roughly 12–22 Chinese characters and caption roughly 80–180 Chinese characters, not asserted platform limits.
9. Saving a draft or publishing requires explicit user authorization and a connector capability check. Never assume ordinary article-draft API supports 图片消息. Do not claim publication without verified readback.

## Hard rejection gates
- Two requested cards embedded in one image.
- Any output not 3:4 when that ratio is specified.
- Text reduced to tiny captions because the poster is overloaded.
- Conceptual contamination (e.g. DP explanation dominated by TP allocation).
- Rewriting already-approved content while performing a format-only revision.
- Incorrect technical units, labels, or numbers.
- Extraneous conversational/process details such as internal verification commands, unless explicitly requested for the public post.

Read [design and QA](references/design-and-qa.md) and [approved case and failure lessons](references/ascend-case.md).

## Lifestyle / visual-impact image-post lessons (cycling series, 2026-11-07)
- Keep a **single coherent visual identity** across all cards (lighting, color grade, editorial styling), but use distinct framing and subjects to match each card's message. For cycling: overall fitted sportswear; expressive face and mirrored sports eyewear; athletic legs and healthy strength; café cycling friends **actively photographing each other** with a compact premium fixed-lens camera (Leica Q-like, not bulky DSLR).
- Preserve user-approved visual intensity: dynamic editorial composition, vivid contrast, expressive poses, distinctive accessories, and clear subject focus. Avoid flattening a compelling earlier concept into generic bland stock photography during revisions.
- An attractive adult subject and tasteful fitted sportswear are acceptable; focus on fitness, fashion, and social interaction rather than intrusive body-part-only crops.
- **Content lock:** When user says "use the earlier impactful images", first retrieve and inspect the approved assets, not silently replace with new unrelated search photos. Preserve the selected aesthetic; tell the truth if originals are unavailable or only cropped derivatives remain.
- **No process leakage:** A user's real-world sighting at a café is private creative context, not publishable copy by default. A single unified caption may mention coffee culture generally, but not claim the author personally encountered anyone.
- **Final acceptance matrix:** requested N == generated standalone N == delivered separate N; each actual 3:4 (prefer 1080×1440); each different focus; one common caption; style continuity; no accidental collage; truthful provenance and dimensions. Failure on any item means not complete.
- See [cycling regression case](references/cycling-case.md).
