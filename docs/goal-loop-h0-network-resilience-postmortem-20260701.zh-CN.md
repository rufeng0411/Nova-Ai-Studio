# Goal Loop H0 — 网络韧性复盘（fetch failed 空白对话）

**日期**：2026-07-01  
**提交**：`d3d32910`（本地）

## 现象

阿根廷「测试阿根廷项目」竞品对标 / GEO 任务出现：

- 助手气泡裸 `fetch failed` 或完全空白
- 刷新后 user 消息可见但 assistant 仍空
- Bridge 假 complete 导致 UI 以为 turn 已结束

## 根因链

1. DashScope 超时返回 `retryable:false`，阻断模型回退链
2. Bridge `gw/sawTurnComplete` 在首帧错误时仍标记 complete
3. 历史 API 未对 `turn_result.error` + 空 assistant 注入占位

## H0 修复

| 层 | 改动 |
|----|------|
| Router | `normalizeModelError` + `isFallbackEligible` 允许 fetch failed 回退 |
| Bridge | 正式 recovery interrupt；turn complete 门控 |
| 历史 | `injectErrorTurnMessages`；Phase 0b `injectEmptyAssistantHistoryPlaceholders` |
| UI | `userFacingErrors` 弱提示；`useSessionStore` 防重复 user 气泡 |

## Phase 0b 补项

- Playwright 默认 **8081 / 7990**
- `dupUsers <= 1`
- acceptance 增加 `fallback-eligible`；`GOAL_LOOP_LIVE=1` 时跑 argentina live

## 运维提示

- dev:saas：**Vite 8081 / Bridge 7990 / Gateway 18789**
- 长任务勿用 Nova Launcher 重启 dev 栈
- 详见 [`conversation-resilience-spec.md`](conversation-resilience-spec.md) H0 节
