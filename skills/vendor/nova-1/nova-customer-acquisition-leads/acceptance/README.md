# Acceptance Runs

两个固定验收主题，验证 Skill 流水线结构与质量门禁（Phase A–G 产物形状）。

## Themes

| ID | 关键词 | 推荐 data_sources |
|---|---|---|
| `beijing-ooh-procurement` | 北京地区户外广告 招标采购 | gov_bidding, gov_ggzy, supply_chain |
| `ai-software-outsourcing` | 人工智能软件开发 外包 | outsourcing, gov_bidding, supply_chain |

## Pass criteria

- ≥5 条 `leads[]`，均非 `noise_irrelevant`
- 每条含 `source_url`、`description`、需求方意图
- 高优线索含联系方式或 `contact_candidates`
- 存在 `query_expansion` 且 alternate_queries ≥6
- 无「未跑搜索却声称已接入政采库」类表述

## Validation

```bash
python skills/customer-acquisition-leads/acceptance/validate_manifest.py
```

## Note

样例 manifest 内 URL 为 **example.com 占位**，供结构验收；实机运行须替换为真实检索结果并标注 `field_provenance`。
