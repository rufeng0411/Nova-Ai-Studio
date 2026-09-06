---
name: nova-research-competitor
description: Use when the report must benchmark competitors with explicit C1..CN roster coverage, capped competitor counts, and full cross-chapter comparison against a target product or brand.
---

# 竞品调研报告 Skill

## Overview
适用于“竞品调研报告（competitor_research）”。核心是“围绕竞品清单做全量对照”，而不是写标的公司介绍。

## When to Use
- 用户问题聚焦“竞品、对标、差距、突围”。
- 需要输出竞品池并给出可执行竞争策略。
- 需要定价、渠道、内容打法、用户画像等多维对比。

## When NOT to Use
- 只做行业机会与产业链（改用 `nova-research-industry-market`）。
- 只做用户行为洞察（改用 `nova-research-user-general` 或 `nova-research-product-user`）。
- 目标是学术/公文规范（改用 `nova-research-academic-professional`）。

## Depth Tiers
| Tier | 字数门槛 | 结构特点 |
|---|---:|---|
| quick | 2500-4000 | 压缩版，但仍需竞品清单与对照主线 |
| standard | 5500-8000 | 10+1 节完整竞品分析 |
| deep | 11000-16000 | 深度补充投放、迭代、供应链线索 |

## Mandatory Roster Rules
1. 必须输出竞品清单编号 `C1..CN`。  
2. 数量上限：直接<=4、间接<=2、潜在<=2、合计<=8。  
3. 第 3-9 章需全量覆盖每个 `Cn`，不得只分析 1-2 家。  
4. 若信息不足，也要保留该竞品并注明“公开信息不足”。  

## Required Structure
### Standard (10+1)
1. 研究背景、范围与方法
2. 竞品层级分类与清单（C1..CN）
3. 竞品基础信息
4. 产品/服务对比
5. 定价与商业模式
6. 渠道与营销策略
7. 内容打法
8. 用户画像对比
9. SWOT 与软肋分析
10. 标的差异化突围策略
11. 数据来源与参考文献

## Writing Rules
- 正文不得设置独立“执行摘要”章节。
- 标的仅作对标参照，不属于调研对象主体。
- 禁止把主体篇幅写成标的公司传记、财报叙事。
- 每个对比结论都应可映射到具体竞品与证据。
- 渠道、内容、口碑章节均需体现“标的 vs C1..CN”。

## Auto-selection Hints
高置信触发词：
- 竞品
- 竞争对手
- 对标
- 差距分析
- 和谁比
- benchmarking

## Implementation Mapping (NovaPage)
- visible id: `competitor_research`
- variant: `competitor_research_{quick|standard|deep}`
- builder: `backend/services/research_template_reports.py`
- global constraints: C1..CN 全量覆盖规则已内置
- selector: `backend/constants/research_report_templates.py`

## Related Skills
- `nova-research-industry-market`
- `nova-research-product-user`
- `nova-research-general`
