# Image-post design and acceptance checklist

## Output contract
- WeChat 图片消息, not article/封面: portrait 3:4, 1080×1440 target. If image engine returns another size, inspect actual pixel dimensions and perform appropriate recomposition; never mislabel the dimensions.
- Deliver exactly N files for N independently requested cards. **Generate in separate image calls**, not a combined prompt. Check that each image contains only its own topic.
- Visual identity across series: coordinated palette, title treatment, illustration treatment and typography; each card's composition may vary.
- Phone-first: the central diagram should dominate; large Chinese headings, short labels, ample negative space; avoid dense tables and tiny footnotes.
- Conceptual hierarchy: one problem, one mechanism, one memorable conclusion per card. If overcrowded, cut secondary material rather than shrinking fonts.
- Technical diagrams should distinguish conceptual schematic from literal photographed/verified physical layout.
- For edits: record invariant content vs editable layout. Preserve approved semantic content, but freely reflow to meet the ratio. Do not add blank sidebars or distort the original.
- Inspect output after every generation: file count, dimensions, readable text, correct terminology, logical arrows, no overlapping labels, no duplication, no accidental TP/DP mixing.

## Post copy
- Title short, compelling, technically truthful; target 12–22 Chinese characters, not an official maximum.
- Caption target 80–180 Chinese characters; no verbose "图一/图二请看" instructions; do not repeat visual text.
- Verify editor/API limits at time of publishing; platform limits change. Hashtags only if helpful.
- User must explicitly approve actual publication; draft creation also requires request.

## Revision discipline
When user says "内容不变": retain facts, message and core diagrams; change only requested dimensions/visual composition. If user says "只改比例", do not redesign information. If a prior layout cannot fit legibly, explain and recompose while preserving substance. Do not regenerate unrelated approved cards.
