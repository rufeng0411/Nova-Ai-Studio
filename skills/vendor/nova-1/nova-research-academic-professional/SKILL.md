---
name: nova-research-academic-professional
description: Use when the report must follow academic, public-sector, or professional delivery norms, prioritizing authoritative sources, rigorous structure, and upload-friendly evidence integration.
---

# 学术 / 公文 / 专业报告 Skill

## Overview
适用于“学术 / 公文 / 专业报告（academic_professional）”。该类型强调规范表达、权威信源与可上报质量。

## When to Use
- 需求包含论文、作业、上报、公文、文献综述、开题、答辩等。
- 需要严谨结构与参考文献可追溯。
- 需要支持用户上传数据并融入分析结论。

## When NOT to Use
- 目标是竞品对标主线（改用 `nova-research-competitor`）。
- 目标是行业商业决策主线（改用 `nova-research-industry-market`）。
- 目标是用户体验与消费决策主线（改用 `nova-research-user-general` 或 `nova-research-product-user`）。

## Depth Tiers
| Tier | 字数门槛 | 结构强度 |
|---|---:|---|
| quick | 2500-4000 | 摘要关键词 + 核心数据 + 问题与建议 |
| standard | 5500-8000 | 10 章规范结构 |
| deep | 11000-16000 | 深度研究结构 + 附录统计 |

## Required Structure
### Standard
1. 摘要与关键词
2. 调研背景与意义
3. 国内外研究现状
4. 调研思路与方法
5. 数据来源、样本与资料说明
6. 数据整理与分析
7. 存在问题、成因与挑战
8. 对策与实施方案
9. 风险与保障措施
10. 总结与展望（附参考文献）

## Writing Rules
- 强制使用可核验来源，优先权威数据与公开机构资料。
- 论点、证据、结论保持闭环，避免口号化建议。
- 引用 `[n]` 与文末参考文献编号严格对应。
- 对“数据局限、方法局限”做显式说明。
- 若有上传资料，需说明资料用途与边界。

## Source Policy
默认采用 `authority_first` 原则：
- 政府公开信息
- 权威机构报告
- 学术论文与专业数据库
- 可追溯行业白皮书

## Auto-selection Hints
高置信触发词：
- 论文
- 作业
- 上报
- 公文
- 文献综述
- 开题
- 答辩

## Implementation Mapping (NovaPage)
- visible id: `academic_professional`
- variant: `academic_professional_{quick|standard|deep}`
- internal params: perspective=`policy`, source_policy=`authority_first`
- builder: `backend/services/research_template_reports.py`
- selector: `backend/constants/research_report_templates.py`

## Related Skills
- `nova-research-industry-market`
- `nova-research-general`
