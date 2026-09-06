---
name: nova-research-product-user
description: Use when the request needs a product-focused user research report with fixed chapter skeletons per depth tier, emphasizing user evidence and actionable product or operations recommendations.
---

# 产品用户研究报告 Skill

## Overview
适用于“产品用户研究报告（product_user_research）”。与通用用研不同：本类型是固定章节骨架，围绕产品与用户关系进行结构化落稿。

## When to Use
- 用户要求“产品用户研究”“产品侧用户洞察”“画像+痛点+动机+优化建议”。
- 需要面向产品团队可执行的结论，而不是行业级战略稿。
- 需要固定章节、稳定模板，便于复用与评审。

## When NOT to Use
- 需要“八段式标题自拟”自由体例（改用 `nova-research-user-general`）。
- 需求主轴是行业格局（改用 `nova-research-industry-market`）。
- 需求主轴是竞品池与全量对比（改用 `nova-research-competitor`）。
- 需求主轴是学术/公文规范写作（改用 `nova-research-academic-professional`）。

## Depth Tiers
| Tier | 建议字数 | 核心结构 |
|---|---:|---|
| quick | 3500-5000 | 8 章简版，聚焦画像/痛点/建议 |
| standard | 5500-12000 | 8 章标准版 |
| deep | 9000-14000 | 扩展到 10 章 + 附录 |

## Required Structure
### Standard (fixed 8 chapters)
1. 调研背景、目的与对象界定
2. 调研方法、样本与数据边界
3. 用户基础画像
4. 用户行为习惯与决策路径
5. 核心需求、痛点、痒点与爽点
6. 消费动机、偏好与阻碍因素
7. 用户细分圈层与用户旅程
8. 口碑舆情、产品优化与运营建议

### Deep extension
可扩展到 10 章，增加：
- 输入侧约定
- 渠道触达与内容话术
- 风险与优先级建议
- 附录 A 数据来源统计

## Writing Rules
- 先用户证据，后产品建议；避免“拍脑袋”优化方案。
- 首购动机与复购驱动要分开叙述。
- 痛点/痒点/爽点必须有证据映射。
- 渠道建议需包含用户状态与话术策略。
- 引用 `[n]` 与参考文献严格对齐。

## Auto-selection Hints
高置信触发词：
- 产品用户
- 人群画像
- 用户需求
- 痛点挖掘
- 用户旅程
- 圈层

## Implementation Mapping (NovaPage)
- visible id: `product_user_research`
- variant: `product_user_research_{quick|standard|deep}`
- pipeline: user_research 管线（固定骨架分支）
- module: `backend/services/research_user_research.py`
- selector: `backend/constants/research_report_templates.py`

## Related Skills
- `nova-research-user-general`
- `nova-research-general`
- `nova-research-competitor`
