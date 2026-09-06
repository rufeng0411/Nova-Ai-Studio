# 企业 MCP 首批 — L3 实机只读清单

每个启用项勾选后再宣称 Production Enable GO。

## 通用

- [ ] 开关为 shadow 或 enforce（非 off）
- [ ] mcp.json 已配且无密钥入库
- [ ] Hub 可见对应卡；off 时不可见
- [ ] 助手未配置时说「未启用」，不假装已查到数据

## mcp-cn-erp

- [ ] 只读查询销售订单或库存成功
- [ ] 未出现审批写工具（或调用被拒）

## mcp-kingdee-k3

- [ ] `MCP_MODE=readonly`；query_bill 成功
- [ ] 与 cnErp 未同时开启

## mcp-yonyou-fin

- [ ] 凭证或科目查询成功
- [ ] 未擅自 delete_voucher

## mcp-tax-invoice

- [ ] 查询或查验成功
- [ ] 未执行开票/红冲

## mcp-notion-collab

- [ ] 读取或写入单页成功
- [ ] 成果仍落在任务目录（若需留存）

## mcp-postgres-readonly

- [ ] 业务库 SELECT 或 list tables 成功
- [ ] 控制面 URL 被拒（可负向测）
