---
name: wechat-image-post
description: Create and revise WeChat Official Account 图片消息/贴图/小绿书 as independent mobile-readable 3:4 image cards, with one topic per image, strict approved-content preservation, concise captions, and visual QA. Trigger for 微信贴图、公众号贴图、图片消息、小绿书、滑动图集、贴图文案、贴图比例 and equivalent requests. Do not confuse with ordinary WeChat articles.
---

# WeChat Image Post / 微信贴图

## Scope and routing
This skill is for WeChat Official Account **图片消息** (贴图/小绿书), NOT article body illustrations, article cover images, or chat stickers. It is complementary to `skills/wechat-publisher`, which handles ordinary article drafts. Read this skill and its references when the user asks for a new image post or revisions. GitHub storage alone does not guarantee auto-loading in future chats: retrieve the current file or use an installed skill copy. Do not claim automatic discovery was verified without testing.

## Mandatory workflow
1. Identify audience, core message and number of **independent image files**. Draft a card-by-card content map. One card answers one central question; do not repeat a topic merely to fill space.
2. Research technical facts before illustration where necessary. Separate verified product specifications from assumptions and conceptual diagrams; avoid fabricated benchmarks and unwarranted absolute performance claims.
3. Lock a shared design system: **3:4 portrait**, default target **1080 × 1440**, consistent visual language, adequate font size and breathing room. Choose layout individually for each topic; do not force identical layouts.
4. Generate **one standalone image per tool request**, especially when asked for two separate TP/DP cards. Never make a side-by-side collage, stacked combined poster, spritesheet, or multi-panel composite representing separate deliverables.
5. Inspect each result for actual aspect ratio, independent file count, Chinese text accuracy, legibility at mobile display size, hierarchy, clipping, overlaps, and factual consistency. Regenerate the individual failing image only.
6. Ask for approval when the user requests review. **Approved facts, narrative and key diagrams are locked**. A request to adjust ratio permits recomposition and resizing of layout, NOT changing the approved informational substance; never stretch, crop off text, or pad awkwardly as a substitute for real composition.
7. Write short post title and caption that complement rather than narrate every image. Verify current WeChat 图片消息 character limits in the actual editor/API when possible; do not confuse them with ordinary article limits. Editorial targets: title roughly 12–22 Chinese characters and caption roughly 80–180 Chinese characters, not asserted platform limits.
8. Saving a draft or publishing requires explicit user authorization and a connector capability check. Never assume ordinary article-draft API supports 图片消息. Do not claim publication without verified readback.

## Hard rejection gates
- Two requested cards embedded in one image.
- Any output not 3:4 when that ratio is specified.
- Text reduced to tiny captions because the poster is overloaded.
- Conceptual contamination (e.g. DP explanation dominated by TP allocation).
- Rewriting already-approved content while performing a format-only revision.
- Incorrect technical units, labels, or numbers.
- Extraneous conversational/process details such as internal verification commands, unless explicitly requested for the public post.

Read [design and QA](references/design-and-qa.md) and [approved case and failure lessons](references/ascend-case.md).
