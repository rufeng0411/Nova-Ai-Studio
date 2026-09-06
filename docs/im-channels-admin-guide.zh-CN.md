# 消息通道管理员指南

## 能做什么

| 能力 | 说明 | 默认 |
|------|------|------|
| **出站通知** | Agent 向企微 / 钉钉 / WhatsApp 推送一条文字 | 未配置不可用；生产 flag 默认 off |
| **App 对话** | 在企微 / 钉钉 / WhatsApp 里与 Agent 双向聊天 | **开关默认关** |

**不做 LINE。** 通知与对话分轨，互不强制。

## 后台入口

**后台 → 平台 → 消息通道**（`/admin/platform/im-channels`）

- Tab「出站通知」：填 Webhook / Cloud API 凭证 → 保存（写入 `mcp.json` 的 `im-notify`）
- Tab「App 对话」：填通道凭证 → 保存；启用需二次确认，且平台 flag 允许
- 页头「图文帮助」或各通道旁「帮助」：分步说明如何创建机器人 / 应用，以及如何与本系统字段对接（企微 / 钉钉 / WhatsApp × 出站通知 / App 对话）

保存后若工具未出现或连接未建立，请**重启 Gateway**。

## Feature flags（须三处同步）

| 环境变量 | 默认 | 含义 |
|----------|------|------|
| `PILOTDECK_IM_NOTIFY_MCP` | 生产 `off`；dev `shadow` | 出站通知 MCP |
| `PILOTDECK_IM_CHANNELS` | **`off`** | 是否允许启用 App 对话长连接 |

`PILOTDECK_IM_CHANNELS=off` 时：后台仍可保存凭证，但 **禁止** `enabled:true` 落盘/生效。

## 出站通知字段

- **企业微信**：群机器人 `WECOM_WEBHOOK_URL`
- **钉钉**：`DINGTALK_WEBHOOK_URL`，可选加签 `DINGTALK_SECRET`
- **WhatsApp Cloud API**：`WHATSAPP_ACCESS_TOKEN` + `PHONE_NUMBER_ID` + 默认 `TO`（非 bridge）

工具前缀：`mcp__im-notify__notify_channels|notify_probe|notify_send`

## App 对话字段

写入 `pilotdeck.yaml` → `adapters.wecom|dingtalk|whatsapp`：

- 企微：`token`（bot_id）+ `extra.secret`
- 钉钉：`extra.clientId` / `extra.clientSecret`
- WhatsApp：`extra.bridgePath` / `extra.bridgeUrl`（私有化 bridge；云上不建议开）

## 禁止

- 为「发通知」去打开 `adapters.*.enabled`
- 云上默认开启任何 IM 长连接
- 把 WhatsApp bridge 标成 SaaS 开箱即用
- 提交含密钥的 `mcp.json` / yaml

## 验收命令

```bash
npm run test:im-notify:unit
npm run test:im-channels:unit
npm run smoke:im-channels
```
