# 稳定性信任栈 M7 — 终态不续跑（P0-D 验收）

**日期**：2026-07-20  
**范围**：P0-D1–D5（任务终态收口）

## 结论

**M7 离线门禁：GO**（单元 + Playwright 离线用例）。实机 3 案须在 `dev:saas` 下人工点进 passed/ACK 历史会话复验。

## 门禁结果

| 门禁 | 命令 | 结果 |
|------|------|------|
| D1 终态判定 | `npx vitest run ui/src/shared/sessionTerminalComplete.test.ts` | **PASS**（10） |
| D2 前端门控 | `npx vitest run ui/src/shared/sessionTaskLifecycle.test.ts ui/src/shared/recoverySurfaceState.test.ts ui/src/components/chat-v2/hooks/useColdResumeInitiator.test.ts` | **PASS** |
| D3 服务端 | `npx vitest run src/session/resume/sessionTerminalFromTranscript.test.ts` | **PASS**（4） |
| M7 E2E 离线 | `npx playwright test ui/e2e/saas/terminal-session-no-autocontinue.spec.ts` | 见下 |
| 回归 | `npm run test:turn-queue:unit` | 15/15 核心 + 2 集成用例失败（**与 P0-D 无关**，acceptedInputDedup 既有问题） |

## 落地摘要

- **`sessionTerminalComplete.ts`**：envelope 优先终态 OR（passed / ACK / sidebar / circuit / certificate）
- **前端全链路**：cold-resume、auto-recovery、incomplete-deliverable、lifecycle、recovery surface、重连 refire 跳过、stop effect
- **服务端**：`POST …/cold-resume` 读 transcript → `terminal_complete` 拒绝
- **D4**：`VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS` + 点进 terminal 清 processing；pack/dev 默认 ON
- **Flag**：`VITE_SESSION_TERMINAL_GATE`（默认 ON，可回滚）

## 实机复验清单（admin / dev:saas）

1. 选一条 **turn_acceptance_meta=passed** 的历史会话 → 点进 → 等待 3s → 无新 turn、Composer 可输入  
2. 用户末条 **「已完成」** 会话 → 同上  
3. **repair 熔断** 会话 → 点进不续跑；新发 user 消息仍可续做  

## 已知未覆盖（第二阶段 P0-B3 / M6）

引擎仍 **`needs_repair` 且未 passed/ACK/熔断** 的「假 incomplete」桶，须 B3 + goal-loop 收口。
