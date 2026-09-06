# P0 门控清单

发布/交付前必须满足：

- [ ] P0-1 已 `read_skill mkt-ai-seo` 且存在 `audit-checklist.md` 或等价审计段落
- [ ] P0-2 存在 `keywords.md`（≥5 条关键词或验证问句）
- [ ] P0-3 存在至少一篇成稿（`drafts/` 或 `optimized.md`）
- [ ] P0-4 已尝试 `geo_api` score；或有 `score.json` / `score-estimate.md` 并注明模式
- [ ] P0-5 已对验证问句执行 **web_search**（必要时博查 fallback），并有 `verify-report.json` / `verification-plan.md`；勿依赖 Perplexity Key
- [ ] P0-6 已向用户报告 `artifacts/geo/<slug>/` 下主要文件路径

P1（建议）：`schema.jsonld`、`report.md`、HTML 周报。
