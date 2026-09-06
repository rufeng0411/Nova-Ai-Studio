# 任务卡死解暂停 — 代码还原点

> 侧栏执行态同步、解暂停 API、陈旧会话自动暂停策略与任务卡死 8 案 RCA/回归门禁。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-task-stall-unpause-20260722094150` |
| **提交** | `38e75922` |
| **时间** | 2026-07-22 09:41:50 +0800 |
| **说明** | 任务卡死 RCA 加固 — 侧栏解暂停、执行态同步与上线前验收 |

```bash
git show restore-point/post-task-stall-unpause-20260722094150 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **侧栏执行态**：`sidebarSessionExecutionStatus.ts` 统一 running/queued/paused 展示与 WS 同步
- **解暂停**：`unpauseSession.test.mjs`、`staleSessionAutoPause.js`、`staleSessionPausePolicy.ts`
- **会话意图**：`pendingSessionIntent.ts`、`applySelectProjectAndSession.ts`、`useProjectsState.ts`
- **终态/续跑门控**：`sessionTerminalComplete.ts`、`sessionAutoContinueGate.ts`、`sessionTerminalFromTranscript.ts`
- **任务卡死 RCA**：`run-task-stall-rca.mjs`、`task-stall-8-sessions.json`、`config/sessions/task-stall-8.json`
- **E2E 回归**：`task-stall-regression.spec.ts`、`terminal-session-no-autocontinue.spec.ts`
- **上线前验收**：`pre-production-acceptance-20260722.zh-CN.md`、`run-production-gate-full.mjs`
- **侧栏状态共享**：`sessionSidebarState.mjs` / `sessionSidebarState.ts` Bridge-UI 对齐

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-task-stall-unpause-20260722094150
```

### 从还原点开实验分支

```bash
git checkout -b experiment/task-stall restore-point/post-task-stall-unpause-20260722094150
```

### 只还原某个文件

```bash
git checkout restore-point/post-task-stall-unpause-20260722094150 -- path/to/file
```

## 关联文档

- [`rca-task-stall-20260721.zh-CN.md`](./rca-task-stall-20260721.zh-CN.md)
- [`task-stall-unpause-session-spike.zh-CN.md`](./task-stall-unpause-session-spike.zh-CN.md)
- [`pre-production-acceptance-20260722.zh-CN.md`](./pre-production-acceptance-20260722.zh-CN.md)
- [`stability-trust-terminal-restore-point-20260721230151.md`](./stability-trust-terminal-restore-point-20260721230151.md)（上一还原点）
