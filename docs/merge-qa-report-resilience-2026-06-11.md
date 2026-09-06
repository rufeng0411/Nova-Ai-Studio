# 联网稳定性升级 — Fork / 合并 QA

**日期**：2026-06-11  
**基线**：`2ad551b5` + resilience 全 Phase  
**fork manifest**：187 条（新增 10 条 resilience 相关）

## 新增登记

| 模块 | 路径 |
|------|------|
| RecoveryBudget | `src/saas/resilience/recoveryBudget.ts` |
| OutboundGate | `src/saas/resilience/outboundGate.ts` |
| SafeConcurrentScheduler | `src/saas/resilience/safeConcurrentScheduler.ts` |
| resolveResilienceConfig | `src/pilot/config/resolveResilienceConfig.ts` |
| AgentLoop 预算挂钩 | `src/agent/loop/AgentLoop.ts` |
| urlFetcher 退避 | `src/tool/builtin/web/urlFetcher.ts` |
| WS 指数退避 | `ui/src/contexts/WebSocketContext.tsx` |
| UI auto-continue 守卫 | `ui/src/components/chat-v2/hooks/useAutoRecoveryContinue.ts` |
| 重连 debounce | `ui/src/components/chat-v2/ChatInterfaceV2.tsx` |
| bridge budget 字段 | `ui/server/pilotdeck-bridge.js` |
| Gateway 语言链 | `src/gateway/client/InProcessGateway.ts` |

## 校验

- `npm run check:saas-fork`：**PASS**（187/187）
- `npm run brand:check`：**PASS**

## 合并注意

- 上游 `AgentLoop` / `ConcurrentToolScheduler` / `WebSocketContext` 合并时以 **RecoveryBudget 钩子 + PD-SAAS-FORK 块** 为准，勿覆盖。
- 新配置键 `tools.resilience` 无键时走默认（enabled=true, budget=8）。
