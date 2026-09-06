---
name: nova-research-general
description: Use when a request needs a balanced research report with market and sentiment evidence, but does not require a strict user-research-only structure, competitor-only benchmark structure, or academic/government writing style.
---

<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 调研报告写入 **`<task-artifact-dir>/`**；编号文件 `01-sources-and-synthesis.md` 等可中文主名（alias 保留英文编号）。
- **禁止**首 turn `ask_user_question` 偏好问卷；缺信息从 goal 推断并正文说明。
- 用户仅要 md 时勿强行 export docx；用户要 Word 时走 export_document。
<!-- NOVA-EXEC-END -->

# 通用调研报告 Skill

## Overview
适用于“通用调研报告（general_research）”场景：以舆情与市场并重的经典结构完成成稿，作为默认兜底类型。

## When to Use
- 需求是综合调研，而非单一“用户研究 / 竞品对标 / 学术公文”。
- 需要标准的“研究概述 → 数据采集 → 核心发现 → 舆论分析 → 建议”主干。
- 主题没有明确触发行业专属、竞品专属、学术专属模板。

## When NOT to Use
- 明确要求“八段式用研”或终端受众专向叙述（改用 `nova-research-user-general`）。
- 明确要求 C1..CN 竞品清单与全量竞品覆盖（改用 `nova-research-competitor`）。
- 明确要求学术/公文规范交付（改用 `nova-research-academic-professional`）。
- 明确要求行业市场 12 章骨架（改用 `nova-research-industry-market`）。
- 明确要求产品用户固定八章（改用 `nova-research-product-user`）。

## Depth Tiers
| Tier | 字数门槛 | 适用场景 |
|---|---:|---|
| quick | 2500-4000 | 快速决策、速览版汇报 |
| standard | 5500-8000 | 常规项目交付、运营复盘 |
| deep | 11000-16000 | 深度研究、策略讨论 |

## Required Structure
按 `quick / standard / deep` 三套经典骨架写作，核心顺序保持：
1. 研究背景与问题定义
2. 数据采集与口径说明
3. 核心发现（主题化展开）
4. 情感与舆论分析
5. （按数据注入）用户画像 / 竞品 / 趋势 / 行业等章节
6. 综合建议
7. 数据来源与参考文献

## Writing Rules
- 结论必须有数据支撑，避免空泛判断。
- 引用采用 `[n]`，并与参考文献编号一一对应。
- 图表类型应匹配叙事目标（占比、趋势、对比、阶段等）。
- 先给结构化证据，再做解释与建议。
- 保留“研究局限与展望”语义，不夸大确定性。

## Auto-selection Hints
当模板自动识别时，以下语义更倾向通用调研：
- “帮我做一个完整调研报告”
- “需要市场+舆情综合分析”
- “先给标准版研究稿”

若命中更强信号，应让位给专用模板：
- 公文/学术关键词 -> academic_professional
- 用研白皮书/用户洞察 -> general_user_research
- 竞品/对标/差距 -> competitor_research
- 行业规模/产业链/PEST/SWOT -> industry_market
- 产品用户/画像/旅程 -> product_user_research

## Implementation Mapping (NovaPage)
- visible id: `general_research`
- variant: 无固定 variant（走经典 builder）
- template constants: `backend/constants/research_report_templates.py`
- prompt builders: `backend/services/research_service.py`

## Related Skills
- `nova-research-user-general`
- `nova-research-industry-market`
- `nova-research-product-user`
- `nova-research-competitor`
- `nova-research-academic-professional`
