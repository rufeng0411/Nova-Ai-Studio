# 终态会话冷续跑门控 — 代码还原点

> 已完成会话禁止 cold-resume/auto-continue、侧栏执行态对齐与切换时成果管线同步。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-terminal-cold-resume-20260723050510` |
| **提交** | `e39c9259` |
| **时间** | 2026-07-23 05:05:10 +0800 |
| **说明** | 终态会话冷续跑门控、侧栏执行态与切换成果同步加固 |

```bash
git show restore-point/post-terminal-cold-resume-20260723050510 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **终态门控**：`sessionTerminalComplete.ts` 强化 passed/complete 判定；`useColdResumeInitiator.ts` 终态短路
- **手动续跑**：`manualContinuePolicy.ts` 与 `useIncompleteDeliverableAutoContinue.ts` 收敛
- **恢复面**：`recoverySurfaceState.ts` 终态/已完成会话弱提示
- **侧栏执行态**：`sidebarSessionExecutionStatus.ts` running/queued/paused 与 WS 对齐
- **切换成果同步**：`sessionSwitchDeliverablesSync.ts` 切会话时 defer validate 与 Dock 对齐
- **权限/Bridge**：`permissionSettings.js`、`pilotdeck-bridge.js` 冷续跑相关 flag
- **E2E**：`terminal-session-no-autocontinue.spec.ts` 终态不续跑回归

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-terminal-cold-resume-20260723050510
```

### 从还原点开实验分支

```bash
git checkout -b experiment/terminal-cold-resume restore-point/post-terminal-cold-resume-20260723050510
```

### 只还原某个文件

```bash
git checkout restore-point/post-terminal-cold-resume-20260723050510 -- path/to/file
```

## 关联文档

- [`deliverable-false-complete-restore-point-20260722132737.md`](./deliverable-false-complete-restore-point-20260722132737.md)（上一还原点）
- [`task-stall-unpause-restore-point-20260722094150.md`](./task-stall-unpause-restore-point-20260722094150.md)
