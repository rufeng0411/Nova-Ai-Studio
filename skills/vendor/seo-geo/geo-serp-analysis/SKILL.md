---
name: geo-serp-analysis
description: AI 搜索/SERP 可见度快照分析。用户要 SERP 分析、AI 回答摘录、可见度对比、serp 报告时使用。
---

<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 交付写入 **`<task-artifact-dir>/`**；主文件 `serp-analysis.md`（中文 UI 可用 `《{品牌}》SERP分析.md`，alias 保留英文）。
- **禁止** ask_user_question 挡首文件；`web_search` → 博查 fallback。
- 报告类 MD 完成后 `read_skill geo-dual-report` 同步同名 `.html`。
<!-- NOVA-EXEC-END -->

# SERP / AI 可见度分析

1. 对 goal 中品牌/品类执行 3–5 条验证问句 `web_search`。
2. 汇总 AI 回答中的品牌提及、引用源、竞品共现 → `write_file` 分析报告 MD。
3. 同步 HTML（geo-dual-report）。

禁止 CLI、Perplexity、Task 委派。
