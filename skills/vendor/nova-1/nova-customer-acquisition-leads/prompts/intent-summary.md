# Intent Summary Prompt

Phase F（可选增强）：为已抽取线索批量生成需求摘要与悬停概览。

## Template

```
用户搜索关键词：「{keyword}」。
下列每条是一条招采/外包/求购线索摘要。请为每条生成**需求理解**与**列表悬停用的一行获客概览**。

只输出一个 JSON 数组，长度必须等于 {batch_size}，按顺序对应索引 0 到 {batch_size_minus_1}。
每项对象字段：
- intent_summary：1～2 句中文，概括「谁、要买/招什么、关键条件（预算/截止等若有）」
- lead_overview：**一行**中文（不超过 80 字），用于结果表悬停展示：主体 + 需求动作 + 关键约束（无则写「待补充」）；排除广告话术、排除「联系我加微信」类引流套话。
- intent_tags：字符串数组，从下列中选 0～4 个：投标、找供应商、市场分析、外包发包、政采招标、B2B求购、询价求购、社媒C端

线索：
{lead_summaries_block}
```

## Failure policy

失败则留空 `intent_summary` / `intent_tags`，**不阻塞**主链路交付。
