# Approved success case: Huawei Ascend image post (2026-11-07)

Published reference: https://mp.weixin.qq.com/s/1QSo1JgVWIsblHBfKrT2gA

User explicitly confirmed satisfaction with the final four independent cards and post. This link is a reference, **not proof that this skill has fetched or verified the live article**. Do not copy the technical content into unrelated topics; reuse its editorial and QA standards.

## Four-card narrative
1. Atlas 800T A2 core overview: identity, hardware, essential specifications.
2. Atlas 800T A2 internal structure: dominant chassis cutaway; label principal subsystems; distinguish schematic from actual teardown.
3. TP / 模型切分: one model sharded across multiple accelerators to reduce per-device memory pressure, with communication tradeoffs.
4. DP / 模型复制: multiple model replicas serving different requests to improve concurrency/aggregate throughput. Keep this card focused on DP; do not force TP examples into its main diagram.

## Failure history and prevention
- Multiple separate images repeatedly rendered as one side-by-side or stacked image. Prevention: one tool invocation per card and verify output count.
- 16:9, overly tall, and near-square ratios substituted for requested WeChat 3:4. Prevention: lock dimensions before generation and inspect resulting pixels.
- Original image padded with sidebars to fit 3:4, resulting in awkward layout. Prevention: regenerate/recompose around approved content instead of mechanically padding.
- Too many text boxes and small type overwhelmed core diagram. Prevention: diagram-first, fewer words, readable mobile scale.
- TP and DP mixed, confusing the independent concepts. Prevention: distinct content map and independent conceptual models.
- Already-approved material rewritten during ratio adjustment. Prevention: content-lock and edit-scope control.
- Article-style lengthy caption and assumptions about WeChat title limits. Prevention: concise image-post copy and current editor/API validation.
- Private conversation details and troubleshooting commands appeared in public-facing material. Prevention: publish only user-facing content.

## Canonical lesson
**One card = one idea = one image file. Shared style does not mean shared canvas or identical layout. Preserve reviewed substance, recompose the layout, verify before delivering.**
