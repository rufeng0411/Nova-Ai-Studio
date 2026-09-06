# 研发视角 Memo：代码路径与测试盲区

**角色**：资深研发 | **日期**：2026-06-21

---

## 问题-文件索引（高信号）

| 问题 | 文件 | 行/模块 |
|------|------|---------|
| turn success 过早 | `src/agent/loop/AgentLoop.ts` | ~815–903 premature stop |
| incomplete deliverable | `src/agent/errors/userFacingErrors.ts` | `shouldAutoContinueAfterIncompleteDeliverableStop` |
| UI 兜底续跑 | `ui/.../useIncompleteDeliverableAutoContinue.ts` | turnCompleteSignal |
| 每 boundary 一次续跑 | `taskResumeCoordinator.ts` | `tryTaskResumeSchedule` |
| binding 仅首 turn | `ui/src/shared/capabilityBinding.ts` | L1 注释 |
| recovery 文案泛化 | `src/agent/loop/toolFailureRecovery.ts` | TOOL_RECOVERY_* |
| repeat guard 同 turn | `toolFailureRepeatTracker.ts` | ≥2 同 input |
| 编排 slim 掉 binding | `applyOrchestration.ts` | SLIM_HEADER |
| JSONL 进度 | `src/session/resume/buildTaskResumeContext.ts` | 仅单测引用 |

## 测试盲区

| 已有 | 未覆盖 |
|------|--------|
| `test:task-resilience:acceptance` 离线 | PPT 端到端 replay |
| `auto-continue-policy.test.ts` | slug 分支 recovery |
| prelaunch 18/18 链路 | agent 理解质量 |
| `smoke:document-export` | anth-pptx 对话实跑 |
| binding 单测 | 多轮 binding 持久 |

## Replay 脚本需求

1. `scripts/replay-transcript-turn-stop.mjs`：输入 jsonl → 模拟 premature stop 判定
2. 扩展 `analyze-task-completion.mjs`：磁盘 validate + recovery 事件行
3. `npm run analyze:task-completion -- --validate`（Phase 2）

## 改进杠杆

| P | 工程项 |
|---|--------|
| P0 | 接线 buildTaskResumeContext 到 UI/引擎续跑消息 |
| P0 | tool_recovery 按 capabilityContext.slug 分支 |
| P1 | 跨 turn ToolFailureRepeatTracker（同类 read_skill） |
| P1 | prelaunch 增加 3 条 skill 实跑门禁 |
| P2 | AgentLoop turn 结束前 hook validateDeliverables |

## 验收命令（建议常驻）

```bash
npm run analyze:task-completion
node --import tsx tests/agent/auto-continue-policy.test.ts
npm run test:task-resilience:acceptance
```
