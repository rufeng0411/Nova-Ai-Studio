---
name: geo-competitor-analysis
description: GEO 竞品与 AI 可见度对标。用户要竞品分析、对标矩阵、竞品关键词 gap、competitor 报告时使用。
---

<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 交付写入 **`<task-artifact-dir>/`**；主文件 `competitor-analysis.md`（中文 UI 可用 `《{品牌}》竞品对标.md`，alias 保留英文）。
- **禁止** ask_user_question 挡首文件；检索 `web_search` → 博查 fallback。
- 报告 MD 完成后 `read_skill geo-dual-report` 同步同名 `.html`。
<!-- NOVA-EXEC-END -->

# GEO 竞品对标

1. 从 user goal 提取品牌 + 2–5 竞品（未给则选行业常见竞品并说明）。
2. `web_search` 对比各品牌在 AI 回答中的提及与引用源。
3. `write_file` 对标矩阵 MD（优势/缺口/建议动作）。
4. 同步 HTML（geo-dual-report）。

禁止 CLI、Perplexity、Task 委派。
