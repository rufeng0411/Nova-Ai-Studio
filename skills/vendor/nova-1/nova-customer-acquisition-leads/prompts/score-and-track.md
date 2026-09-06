# Score and Track Prompt

Phase F：批量生成置信度与可执行跟进建议。

## Template

```
用户搜索关键词：「{keyword}」。以下为若干条招采/外包线索的摘要，请对每条给出：
1. confidence_score：1-5 的整数，表示与关键词匹配度、信息完整度、时效性的综合置信度。
2. track_suggestion：一句可执行的下一步动作建议（如「建议 3 日内致电采购人确认标书获取方式」），不要空话。

严格按顺序输出，每行一条，格式为：序号\\t置信度\\t追踪建议
例如：
0\\t4\\t建议本周内联系采购人获取招标文件并关注澄清公告
1\\t3\\t可先通过官网或电话确认项目进度后再跟进

线索摘要：
{lead_lines_block}
```

## Mapping to lead fields

| 输出 | 写入字段 |
|---|---|
| confidence_score | `confidence_score` (1-5) |
| track_suggestion | `track_reason` |
| 派生 | `track_level`: High (≥4), Medium (≥3), Low (<3) |

## Fallback

LLM 失败时使用规则打分：联系方式完整度、金额/截止、match_score、intent_label 非 noise。
