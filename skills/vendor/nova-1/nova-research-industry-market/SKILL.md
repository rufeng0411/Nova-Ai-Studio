---
name: nova-research-industry-market
description: Use when the request focuses on industry definition, market sizing, policy context, chain structure, competition, and entry decisions with required PEST/SWOT and industry-specific model sections.
---

# 行业市场调研报告 Skill

## Overview
适用于“行业市场调研报告（industry_market）”。核心目标是回答“这个行业能不能做、怎么做、风险在哪里”。

## When to Use
- 需求包含行业规模、渗透率、产业链、竞争格局、进入策略。
- 明确需要 PEST、SWOT、行业专属分析模型。
- 目标读者偏企业决策、运营策略、项目立项。

## When NOT to Use
- 主要问题是用户画像与用户行为（改用 `nova-research-user-general` 或 `nova-research-product-user`）。
- 主要问题是竞品全量对标（改用 `nova-research-competitor`）。
- 主要问题是学术/公文规范交付（改用 `nova-research-academic-professional`）。

## Depth Tiers
| Tier | 字数门槛 | 结构强度 |
|---|---:|---|
| quick | 2500-4000 | 4 章压缩：定义、规模格局、机会风险、决策建议 |
| standard | 5500-8000 | 12 章完整结构 |
| deep | 11000-16000 | 13 章深度版，含执行摘要与更强证据链 |

## Required Structure
### Standard (12 chapters)
1. 研究概述
2. 行业定义与范畴
3. 发展历程与现状
4. 政策与监管环境
5. 市场规模与数据
6. 产业链上下游与利润环节
7. 竞争格局
8. 通用分析模型：PEST 与 SWOT
9. 行业专属分析模型
10. 趋势、细分机会与风险
11. 落地决策建议
12. 数据来源与参考文献

## Deliverable Basename（硬约束）
- 主交付唯一 basename：`industry-market-report.md`（若用户「须交付：」点名了其它 `.md`，以用户点名为准）。
- **禁止**擅自拆成 `01-sources-and-synthesis.md` / `03-report-body.md` / `report.docx` 三件套，除非用户明确要求 Word/正式调研三步包。
- 写入系统分配任务目录；勿另起并行清单。

## Writing Rules
- PEST 与 SWOT 为必写，不可省略。
- 结论必须回扣“进入判断”和执行路径。
- 数据、图表、结论三者要一一对应。
- 风险分析需包含概率、影响、应对建议。
- 对“行业专属模型”为何适用给出明确说明。

## Industry-specific Model Hints
常见行业专属模型示例（按主题匹配）：
- 养老 -> CARCC
- 餐饮 -> 门店盈利模型（选址/客单/翻台/成本）
- 美妆美业 -> 渠道/成分/人群/定价模型
- 母婴 -> 安全/决策链/复购周期模型
- 教培 -> 获客/转化/续课/口碑模型
- 新能源 -> 政策/供应链/技术迭代模型
- 跨境电商 -> 平台/物流/合规/汇率模型
- 医疗健康 -> 政策/审批/渠道/医保模型
- 本地生活 -> 流量/履约/复购/商圈模型
- SaaS 工具 -> 获客/续费/壁垒/客单价模型

## Auto-selection Hints
高置信触发词：
- 行业调研
- 市场规模
- 产业链
- 渗透率
- 行业机会
- PEST / SWOT

## Implementation Mapping (NovaPage)
- visible id: `industry_market`
- variant: `industry_market_{quick|standard|deep}`
- params: dimensions=`market/industry/trend/sentiment`, perspective=`enterprise`
- builders: `backend/services/research_template_reports.py`
- selector: `backend/constants/research_report_templates.py`

## Related Skills
- `nova-research-general`
- `nova-research-competitor`
- `nova-research-academic-professional`
