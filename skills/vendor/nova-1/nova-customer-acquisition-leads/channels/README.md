# Data Source Channels

21 类获客渠道，对应 Nova `customer_acquisition_sources.CHANNEL_CATEGORIES`。完整列表与默认权重见 [catalog.json](catalog.json)。

## Weight semantics (1–5)

| 权重 | 含义 | 示例 |
|---:|---|---|
| 5 | 强需求/强商机 | 政采、国企招标、招聘 |
| 4 | 明确商业意图 | 外包众包、B2B、跨境供应链 |
| 3 | 中等意图 | 同城分类、地方论坛 |
| 2 | 弱意图/讨论为主 | 社交媒体、论坛 BBS |
| 1 | 参考/背景 | 技术社区 |

`min_weight` 过滤：仅使用权重 ≥ N 的渠道（Nova 可选参数；Portable 默认不过滤）。

## Selection decision tree

用户未指定渠道时，按关键词推断（对齐 `acquisition_inferDataSources`）：

| 关键词信号 | 推荐 channel_id |
|---|---|
| 政府、政采、公共资源、国企、央企、投标 | `gov_bidding`, `gov_ggzy`, `state_owned`, `supply_chain` |
| 外包、众包、猪八戒、威客 | `outsourcing`, `gov_bidding`, `supply_chain` |
| 小红书、C 端、消费者、同城店、种草 | `social`, `local_life`, `forum_bbs` |
| B2B、供应链、1688、企业购 | `supply_chain`, `private_bidding`, `overseas_b2b` |
| 海外、RFQ、SAM、TED | `gov_overseas`, `overseas_b2b`, `overseas_freelance` |
| 无明确信号 | `gov_bidding`, `supply_chain`, `outsourcing` |

## Default portable bundle

无 API 全自动抓取时，Agent 应至少覆盖：

1. **政采/招标**语义 query
2. **外包/众包**语义 query
3. **B2B 求购**语义 query

并**轮询**各 query 取 URL，避免单一「招标」占满结果。

## Seed URLs

`catalog.json` 仅含渠道元数据。各渠道种子 URL 清单在源码 `PLATFORM_SEEDS`（数百条）；Portable Agent 通常依赖**全网搜索 + 用户给定 URL**，不必复制全部种子。

## Related docs

- 扩展清单：`docs/customer-acquisition-sources-extended.md`
- 流水线边界：`docs/customer-acquisition-pipeline.md`
