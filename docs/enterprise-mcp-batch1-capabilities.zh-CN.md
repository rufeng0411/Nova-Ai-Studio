# 企业 MCP 首批 — 工具级能力清洗（权威）

> 与 Hub 卡、后台「平台 → 插件系统」、`capabilityBindingPrompt` 同源。本批六键默认 **off**。

## 总览

| Hub slug | 一句话能做什么 | 不能做什么 | Nova 默认姿态 |
|----------|----------------|------------|---------------|
| mcp-cn-erp | 自然语言查金蝶/用友订单、库存、应收应付、经营看板 | 不能替代完整总账；无确认不改单据 | 只读为主 |
| mcp-kingdee-k3 | 按单据类型查/导出金蝶单据 | 不能绕过金蝶权限；只读模式不能写 | `MCP_MODE=readonly`；写工具关 |
| mcp-yonyou-fin | 查凭证、科目、账簿 | 不是进销存全模块 | 查询开；save/delete 关 |
| mcp-tax-invoice | 查发票、查验真伪 | 不是电子税务局申报 | 仅查询/查验；开票关 |
| mcp-notion-collab | 读写 Notion 页面与数据库 | 不替代任务成果目录 | 读开；批量删关 |
| mcp-postgres-readonly | 业务库只读 SQL / 表结构 | 绝不连控制面库 | 只读连接串 |

场景例句：「查上月应收」「验这张发票」「把会议纪要写进 Notion」「看业务库有哪些订单表」。

---

## mcp-cn-erp

**能做到**：同一套工具对接金蝶云星空或用友 YonSuite（`ERP_TYPE`）；经营问答、订单/库存/应收应付、待审列表、表单元数据。

| 工具（代表性） | 功能 | 读/写 | Nova 默认 |
|----------------|------|-------|-----------|
| `erp_query_sales_orders` 等查询族 | 订单/库存/客户/应收应付/生产 | 读 | 开 |
| `erp_business_dashboard` | 经营看板 | 读 | 开 |
| `erp_query_pending_approvals` | 待审列表 | 读 | 开 |
| `erp_approve_document` | 审批 | 写 | **关** |
| `erp_self_update` | 自助升级包 | 写 | **生产关** |

**不能**：无凭据假装已查；把查询写成「已过账」；批量乱审。

---

## mcp-kingdee-k3

与 erp-mcp **互斥启用**。

| 工具 | 功能 | 读/写 | Nova 默认 |
|------|------|-------|-----------|
| `query_bill` / `query_bill_all` / `query_bill_to_file` 等 | 查/导出 | 读 | 开 |
| `save_bill` / `submit_bill` / `audit_bill` / `delete_bill` / `push_bill` | 写链路 | 写 | **关** |

配置强制 `MCP_MODE=readonly`。

---

## mcp-yonyou-fin

| 分组 | 默认 |
|------|------|
| 凭证/科目/账簿查询 | 开 |
| `save_voucher` / `delete_voucher` / 科目创建更新 | **关** |

---

## mcp-tax-invoice

第三方商用 Streamable HTTP。查询/查验开；开票/红冲 **关** + UserActionRequired。

---

## mcp-notion-collab

搜索/读取开；单次创建更新开；批量删除默认关。不替代 `artifacts/task-*`。

---

## mcp-postgres-readonly

列出 schema/表与只读 SELECT 开；写 SQL **永不暴露**。硬禁控制面 `SAAS_DATABASE_URL`。

---

## 用户场景例句

- 查上月应收并写一份摘要
- 验这张发票真伪（不开票）
- 把调研结论写进 Notion 数据库
- 看业务库 `orders` 表最近 7 天行数（只读）
