# AI 搜索优化执行手册（策划 / 执行 / 监测）

贯穿营销飞轮六阶段；各阶段能力中心均有 **「AI搜索」** 三级 Pill。详细选型见 [ai-search-skills-matrix.zh-CN.md](./ai-search-skills-matrix.zh-CN.md)。

## 1. 策划层（调研 + 策略）

**输入**：品牌、品类、竞品、现有站点。

**能力链**：

1. `geo-keyword-research` → AI 关键词与提问句式
2. `geo-competitor-analysis` → 竞品在 AI 回答中的可见度
3. `mkt-ai-seo` → AI 可见度审计清单
4. `pd-geo` → 关键词矩阵与国内平台策略

**产出**：`audit-checklist.md`、`keywords.md`、策略 Brief（`artifacts/geo/`）。

**试一下示例**：为【品牌名】做 AI 搜索基线调研：列出 10 个用户会问 AI 的问题、3 个竞品在回答中的提及情况，并输出关键词矩阵，直接开始做，做完告诉我文件在哪。

## 2. 执行层（创意 + 触达 + 发布）

**内容**：`geo-content-optimizer` / `geo-seo-content-writer` → `mkt-copywriting` 润色。

**结构**：`mkt-schema`、`geo-technical-seo`、llms.txt（参考 geo-seo-claude 方法论）。

**触达**：`mkt-email-sequence` → AI 友好引用结构与邮件序列。

**分发**：`mkt-programmatic-seo`、国内草稿 `yixiaoer`（pd-geo 第 7 步）。

**产出**：`optimized.md`、`schema.jsonld`、落地页 HTML。

## 3. 监测层（监测复盘）

**评分**：`geo_api`（pd-geo）+ `geo-aeo-audit` + `geo-on-page-audit`。

**跟踪**：`geo-rank-track`、`mkt-seo-audit` 周期审计。

**舆情**：`mkt-brand-mention`、`mkt-review-mining`。

**报告**：`od-data-report` HTML 周报、`verify-report.json`。

**产出**：`score.json`、`visibility-report.html`、月度复盘 Markdown。

## 4. 飞轮阶段与 AI搜索 Pill 对照

| 阶段 | AI搜索 Pill 要点 | 代表能力 |
|------|------------------|----------|
| 调研 | 基线、竞品在模型中的提及 | geo-keyword-research、geo-competitor-analysis、mkt-ai-seo |
| 策略 | 关键词与品牌定位 | pd-geo（双归属 brand_geo + AI搜索） |
| 创意 | 可引用、可摘录内容 | geo-content-optimizer、geo-seo-content-writer、geo-citability |
| 触达 | AI 友好改写与引用结构 | mkt-email-sequence |
| 发布 | llms.txt、schema、爬虫可达 | mkt-schema、mkt-programmatic-seo、geo-technical-seo |
| 监测 | 评分、审计、跟踪 | geo-aeo-audit、geo-on-page-audit、geo-rank-track、mkt-ai-seo |
