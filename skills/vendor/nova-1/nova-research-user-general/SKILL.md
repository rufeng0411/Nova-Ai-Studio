---
name: nova-research-user-general
description: Use when the report must follow a user-research-first narrative with the eight-substance sequence, audience-centered language, and strict limits against investor/policy-style framing.
---

# 通用用户研究报告 Skill

## Overview
适用于“通用用户研究报告（general_user_research）”。该类型强调“终端受众”视角，采用八段式实质顺序，章节名可自拟但顺序不可打乱。

## When to Use
- 用户明确要求“用研报告 / 用户洞察报告 / 用户白皮书”。
- 目标是解释用户为什么看、为什么买、为什么流失、如何触达。
- 需要“执行摘要纯文字 + 8 个实质章节”结构。

## When NOT to Use
- 需求是行业规模、产业链和 PEST/SWOT 主导（改用 `nova-research-industry-market`）。
- 需求是竞品 C1..CN 全量对比（改用 `nova-research-competitor`）。
- 需求是学术/公文语体和上报规范（改用 `nova-research-academic-professional`）。
- 需求是产品团队固定八章模板（改用 `nova-research-product-user`）。

## Depth Tiers
| Tier | 建议字数 | 说明 |
|---|---:|---|
| quick | 3500-5000 | 轻量用户洞察，保证链路完整 |
| standard | 5500-12000 | 默认交付，覆盖八段主结构 |
| deep | 9000-14000 | 深度洞察、证据更密集 |

## Required Structure
固定主干：
1. `# 报告标题`
2. `## 执行摘要`（仅文字，禁图表）
3. `## 目录`（列出后续 8 个 `##` 章节）
4. 八段式实质章节（标题可自拟，顺序必须保留）  
   输入 -> 抓取 -> 解析 -> 画像 -> 匹配 -> 渠道 -> 交付

## Writing Rules
- 叙述主体是终端受众，不是企业管理层或投资方。
- 禁止“企业应、投资者应、政策应”并列主建议写法。
- 采集章节需说明公开检索口径、样本边界与不可外推点。
- 图表只放在实质章节，不放在执行摘要。
- 每个关键结论配 `[n]` 引用，编号必须可追溯。
- 数据总量与平台条数前后必须一致，不得出现冲突数字。

## Deliverable Basename（硬约束）
- 主交付唯一 basename：`user-research-report.md`（若用户「须交付：」点名了其它 `.md`，以用户点名为准）。
- **禁止**擅自拆成 `01-sources-and-synthesis.md` / `03-report-body.md` / `report.docx` 三件套，除非用户明确要求 Word/正式调研三步包。
- 写入系统分配任务目录；勿另起并行清单。

## Auto-selection Hints
高置信触发词：
- 用研报告
- 用户研究报告
- 用户洞察报告
- 用研白皮书
- 商业优化白皮书

若同题同时出现“竞品 / 行业 / 学术”信号，优先根据用户最终交付目标判定：
- 目标是“用户行为与动机” -> 本 Skill
- 目标是“对手对比” -> `nova-research-competitor`
- 目标是“行业格局与进入判断” -> `nova-research-industry-market`

## Implementation Mapping (NovaPage)
- visible id: `general_user_research`
- internal pipeline: `user_research` 独占维度
- core module: `backend/services/research_user_research.py`
- constants: `backend/constants/research_report_templates.py`

## Related Skills
- `nova-research-general`
- `nova-research-product-user`
- `nova-research-competitor`
