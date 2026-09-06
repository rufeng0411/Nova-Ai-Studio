# Query Expansion Prompt

Phase B：在主检索词基础上扩展多路查询与排噪词。

## Template

```
你是招采/外包/求购场景的查询规划助手。

用户原始需求：「{user_input}」
已生成的主检索词（一行）：「{refined_line}」

请输出**唯一一个 JSON 对象**（不要 markdown），字段：
- "main_query": 字符串，与主检索词一致或微调后的主查询。
- "alternate_queries": 字符串数组，长度 6～12。每条为**完整可搜索短句**，覆盖不同表述，例如：
  - 招标/采购/询价/求购/外包/众包/悬赏/定制开发/寻求供应商/RFP 等组合；
  - 同城/论坛/社交媒体场景可加「求推荐」「急求」「找人做」等（用于 C 端帖，勿滥用）。
- "negative_terms": 字符串数组，长度 3～8，表示应**降权或排除**的噪音类型关键词（如：种草、带货、加盟代理、优惠券秒杀、测评软文、百科选购指南等），用于后续规则过滤参考。

要求 alternate_queries 与用户意图强相关，不要重复堆砌同一短语。
```

## Output schema

见 [../schemas/query-expansion.json](../schemas/query-expansion.json)

## Search diversity note (from Nova pipeline)

轮询各 `alternate_queries` 取结果，避免仅「招标采购」占满配额导致外包/同城类永远进不来。Agent 手工搜索时亦应**交错**不同 query 类型。
