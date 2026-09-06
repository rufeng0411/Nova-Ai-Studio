# Weak Search Context Block

当 Agent 仅有搜索引擎摘要（无 Firecrawl 全文）时，在抽取 Prompt 前注入：

```
【博查搜索摘要（弱结构化，非独立标讯数据库字段） · 来源标签 bocha_snippet】
{snippet_text}
```

或：

```
【搜索引擎摘要（弱结构化） · 来源标签 search_snippet】
{snippet_text}
```

## Rules

- **正文优先**：若后续获得完整页面 Markdown，以正文为准重新抽取。
- `field_provenance.contact_info.source` / `description.source` 须标注 `bocha_snippet` 或 `page_body`。
- 仅摘要时 `extraction_confidence` 上限建议 ≤0.65（见校验规则）。

## Transparency

勿向用户声称「已接入政采数据库字段」——弱摘要仅为 Web 搜索 snippet。
