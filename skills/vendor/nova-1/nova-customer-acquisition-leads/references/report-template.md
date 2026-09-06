# 智能获客报告模板（`leads-report.md`）

Phase G **必须**用 `write_file` 生成本文件，路径：

`artifacts/acquisition-{run_slug}/leads-report.md`

`run_slug` 为英文短 slug（如 `beijing-ai-outsourcing`）。

---

## 文件结构（照抄标题层级，替换占位符）

```markdown
# 智能获客分析报告

> **检索主题**：{keyword}  
> **生成时间**：{YYYY-MM-DD HH:mm}  
> **数据来源**：{data_sources 中文简述}  
> **发现页面**：{pages_discovered} 条 · **保留页面**：{pages_classified_kept} 条 · **有效线索**：{leads_count} 条

---

## 一、执行摘要

{2–4 句：本轮检索覆盖哪些渠道、高优线索集中在什么类型、下一步建议。禁止粘贴 JSON 或 HTML。}

---

## 二、高优线索（建议优先跟进）

| 优先级 | 单位/采购方 | 需求标题 | 需求类型 | 地域 | 联系方式 | 匹配度 | 来源 |
|:------:|------------|----------|----------|------|----------|:------:|------|
| High | {company} | {title} | {need_type} | {region} | {contact_info} | {match_score} | [链接]({source_url}) |
| … | … | … | … | … | … | … | … |

*说明：匹配度为 0–1；联系方式若仅来自搜索摘要，须在备注标「待全文核实」。*

---

## 三、全部线索清单

| # | 跟进等级 | 单位/采购方 | 需求摘要 | 类型 | 截止/金额 | 联系方式 | 置信度 | 来源 |
|---|:--------:|------------|----------|------|-----------|----------|:------:|------|
| 1 | {track_level} | {company_name} | {description 一句} | {intent_label 中文} | {bid_deadline / amount} | {contact_info} | {extraction_confidence} | [查看]({source_url}) |
| 2 | … | … | … | … | … | … | … | … |

**去重规则**：同一 `source_url` 或同一单位+同一标题只保留一条。

---

## 四、检索与筛选说明

| 项目 | 内容 |
|------|------|
| 主检索词 | {main_query} |
| 扩展检索 | {alternate_queries 用顿号连接，不超过 8 个} |
| 排除词 | {negative_terms} |
| 使用工具 | {discovery_tools} |
| 剔除说明 | {简述丢弃供应广告、已定标无联系等数量} |

---

## 五、跟进建议（按优先级）

### 高优（High）

1. **{单位}** — {track_reason}

### 中优（Medium）

1. …

### 低优（Low）

1. …

---

## 六、数据文件

| 文件 | 说明 |
|------|------|
| `acquisition-manifest.json` | 机器可读完整线索（含 field_provenance） |
| `query-expansion.json` | 检索规划 |
| `leads-report.md` | 本报告（人类阅读） |

---

*报告由 Nova 智能获客 Skill 生成；摘要层线索请回源 URL 核实后跟进。*
```

---

## intent_label 中文映射（表格「类型」列）

| 值 | 中文 |
|----|------|
| procurement_tender | 招标采购 |
| purchase_inquiry | 求购询价 |
| outsourcing | 外包发包 |
| b2b_lead | B2B 需求 |
| social_c_end | 社媒需求 |
| noise_irrelevant | （不写入报告） |

---

## 排版要求

- 全文使用 **Markdown 表格**，不用 JSON 代码块、不用 HTML 片段。
- 表头对齐、列宽适中；长描述在「需求摘要」列用一句话。
- 链接列统一 `[查看](url)` 或 `[来源](url)`。
