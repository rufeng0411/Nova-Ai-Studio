---
name: geo-keyword-research
description: GEO/AEO 关键词与验证问句研究。用户要关键词矩阵、AI 搜索问句、长尾词、对比型 query、keywords.md 时使用。禁止依赖 upstream CLI 或 Perplexity。
---

<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 所有交付物写入 **`<task-artifact-dir>/`**（STDA；勿自建语义目录 geo/）。
- **禁止**首 turn `ask_user_question`；品牌/竞品未给时用 goal 占位并正文说明。
- 中文 UI 主交付：
  - `《{品牌}》GEO关键词研究.md`（alias: `keywords.md`, `keywords-research.md`）
  - 同名 `.html` 经 `read_skill geo-dual-report` 同步（alias: `keywords.html`）
- **禁止** CLI、Perplexity API、Task/subagent；检索顺序 `web_search` → 博查 fallback。
<!-- NOVA-EXEC-END -->

# GEO 关键词研究

## 执行路径

1. `web_search` 2–4 次（主检索失败自动试博查；勿要求 Perplexity Key）。
2. `write_file` 关键词 MD：≥20 条口语化长尾 + ≥10 条 AI 验证问句（结构见 `references/nova-keyword-template.md`）。
3. `read_skill geo-dual-report` 生成同名 `.html`。
4. 可选：`verification-plan.md`（验证计划，非阻塞）。

## 模板结构

- 品牌/品类/竞品假设
- 关键词表（意图、难度、优先级）
- 验证问句表（用于 web_search/geo_api verify）
- 数据缺口与 caveat

## 禁止

- redirect/CLI `npx skills add`
- 无 write_file 的空转规划 turn
- `read_file skills/` 代替 read_skill
- **8 阶段 SEO workflow / CONNECTORS / 外部 CLI**（仅走上方 4 步 Nova 路径）
- Task/subagent 委派
