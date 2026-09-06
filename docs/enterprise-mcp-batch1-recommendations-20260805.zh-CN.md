# 企业 MCP 首批选型建议（2026-08-05）

## 定稿六项

| 级 | 包 | Hub | flag |
|----|-----|-----|------|
| P0 | erp-mcp | mcp-cn-erp | cnErp |
| P0 备选 | kingdee-k3cloud-mcp | mcp-kingdee-k3 | kingdee（与 cnErp 互斥） |
| P1 | @archiesun/yonsuit-fin-mcp | mcp-yonyou-fin | yonyouFin |
| P1 | tax-invoice-mcp（HTTP） | mcp-tax-invoice | taxInvoice |
| P0 | @notionhq/notion-mcp-server | mcp-notion-collab | notionCollab |
| P0 | @modelcontextprotocol/server-postgres | mcp-postgres-readonly | postgresReadonly |

## 不做（本批）

HubSpot、向量库、IM、SSO、SAP、Firecrawl 还债、Postgres MCP Pro、其余七类调研项。

## 兼容

存量 MCP（firecrawl/figma/政策等）默认 **shadow**；本批六键默认 **off**。

## 能力清洗权威

见 [enterprise-mcp-batch1-capabilities.zh-CN.md](./enterprise-mcp-batch1-capabilities.zh-CN.md)。
