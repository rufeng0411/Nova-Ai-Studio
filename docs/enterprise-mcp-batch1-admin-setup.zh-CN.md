# 企业 MCP 首批 — 管理员接入说明

仿照企业合规政策 MCP 接入节奏。本批六服务默认 **关闭**，须显式开启后才会出现在 Hub 并被 Gateway 加载。

## 前置

1. 代码已含 `mcpFeatures` 内核（后台 → **平台 → 插件系统** →「企业 MCP 插件」）。
2. 示例配置：`products/_example/config/mcp.json.example`（键：`erp` / `kingdee` / `yonyou-fin` / `tax-invoice` / `notion-collab` / `postgres`）。
3. 能力说明（工具级）：[enterprise-mcp-batch1-capabilities.zh-CN.md](./enterprise-mcp-batch1-capabilities.zh-CN.md)（锚点与各 Hub slug 同名）。

## 启用步骤（单服务）

1. 后台将对应开关设为 **灰度** 或 **正式启用** 并保存（保存后尝试 `reloadExtensions`）。
2. 将 example 中对应段写入平台 `mcp.json`（密钥勿提交仓库）。
3. 刷新前台；Hub「发现 / 能力」出现该卡（企业 Tab 另受 `VITE_HUB_ENTERPRISE_COMPLIANCE_TAB` 约束，与本批 flag **独立与运算**）。
4. 用只读样例对话验证（见 [live checklist](./enterprise-mcp-batch1-live-checklist.zh-CN.md)）。

## 环境变量覆盖（优先于 JSON）

| 键 | 对应 |
|----|------|
| `PILOTDECK_MCP_CN_ERP` | cnErp |
| `PILOTDECK_MCP_KINGDEE` | kingdee |
| `PILOTDECK_MCP_YONYOU_FIN` | yonyouFin |
| `PILOTDECK_MCP_TAX_INVOICE` | taxInvoice |
| `PILOTDECK_MCP_NOTION` | notionCollab |
| `PILOTDECK_MCP_POSTGRES` | postgresReadonly |

取值：`off` | `shadow` | `enforce`（`0`/`1` 映射 off/enforce）。

## 互斥

「企业 ERP 查询」与「金蝶云星空」不可同时为 shadow/enforce；保存时自动关闭金蝶并返回中文 warning。

## 回滚

- 单键：后台设 off 并保存  
- 全批：六键 off，或六 env=`off` 后 recreate nova  
- 代码：`git checkout restore-point/pre-enterprise-mcp-batch1-*`

## Postgres 硬禁

业务库连接串不得与 `SAAS_DATABASE_URL` 同 host+port+dbname；违规时 Gateway 丢弃 postgres 服务。

## 写工具

默认隐藏审批/开票/删凭证等写工具。紧急放开：`PILOTDECK_MCP_WRITE_TOOL_ALLOW=*`（生产慎用）。
