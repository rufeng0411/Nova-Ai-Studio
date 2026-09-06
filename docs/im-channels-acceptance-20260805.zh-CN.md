# 消息通道验收报告（2026-08-05）

## 范围

- 出站通知 MCP：企微 / 钉钉 / WhatsApp（无 LINE）
- App 对话：复用 ChannelAdapter，默认关，后台可配
- 统一后台页「消息通道」

## 验收分级

| 级 | 命令 | 结果 |
|----|------|------|
| L0 notify | `npm run test:im-notify:unit` | **PASS**（8） |
| L0 channels | `npm run test:im-channels:unit` | **PASS**（gate + vitest） |
| L0 intent | vitest `src/saas/imNotify` / `imChannels` | **PASS**（8） |
| L1 | `npm run smoke:im-channels` | **PASS** |
| L1 fork | `npm run check:saas-fork` | **PASS**（838） |
| L2/L3 | Bridge/Gateway 实机 | 待运维填凭证后验 |
| L4 实发 | 企微+钉钉 webhook 实发 | 缺 Key → skipped，不得假 passed |

## KPI（回填）

| 指标 | 值 |
|------|-----|
| 默认零连接（IM_CHANNELS=off） | 门控单测 PASS |
| Dockerfile / pack 含 mcp-servers | smoke PASS |
| flag 三处同步 | smoke PASS |
| Hub `mcp-im-notify` | catalog needs_config + try-prompt OK |

## 回滚

`PILOTDECK_IM_NOTIFY_MCP=off` + `PILOTDECK_IM_CHANNELS=off`；删除 `mcpServers.im-notify`；三通道 `enabled:false`。
