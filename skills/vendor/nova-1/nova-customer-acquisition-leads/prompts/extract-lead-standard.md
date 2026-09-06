# Extract Lead — Standard (Procurement / B2B)

Phase E：从招采/外包类页面正文抽取结构化线索 JSON 数组。

## Template

```
你是招采/外包线索分析助手。用户搜索关键词：「{keyword}」——要找与**采购/招标/求购/外包发包/定制需求**相关的可跟进线索。

请先在脑中按步骤推理（不必输出推理过程），再输出**唯一**一个 JSON 数组。

**步骤 1**：判断页面类型。以下应输出 [] 或极低质量：供应广告、百科、人机验证、种草带货、加盟招商、纯品牌宣传、教程测评无采购意图。
**步骤 2**：定位联系方式（联系人/电话/邮箱/采购人/代理机构/项目联系方式及表格、页脚）。
**步骤 3**：收集候选电话/邮箱到 contact_candidates；400/95 客服弱化，优先项目直拨号。
**步骤 4**：若存在「弱结构化摘要」与「页面正文」，正文优先；摘要须在 field_provenance 标明 bocha_snippet 或 search_snippet。

{weak_block}
【页面正文】
{content}

**每条对象必须包含键**：
company_name, need_type, title, description, procurement_unit, contact_info, project_unit, supervision_unit, amount, budget, bid_deadline, deadline, source_url（填 "{url}"）,
project_id（无则 ""）,
contact_candidates（字符串数组）,
extraction_confidence（0-1）,
field_provenance（至少 contact_info、description）,
intent_label（以下之一：procurement_tender|purchase_inquiry|outsourcing|b2b_lead|social_c_end|noise_irrelevant）,
intent_reason（一句中文说明判定理由）,
noise_flags（字符串数组，如：种草推广|供应广告|软文|无联系方式|与用户主题弱相关，无则 []）,
match_score（0-1，与用户关键词的匹配度）,
audience_type（b2b|b2g|c_end|unknown）,
content_evidence（≤120字，摘录证明「需求方意图」的正文片段）

**抽取规则**：
- 供应广告、无效页、已中标且无联系方式 → []。
- 否则输出 1～15 条；每条须：与关键词主题相关 + 有需求描述 + 有主体 + 有电话/邮箱/明确联系人段落。

只输出 JSON 数组，不要 markdown。
```

## weak_block

当仅有搜索摘要无全文时，注入 [weak-context-block.md](weak-context-block.md)。
