# 稳定性 Trust 终态门控 — 代码还原点

> 终态会话禁止自动续跑、续跑/恢复面收敛、交付预览快路径与网络断连注册表加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-stability-trust-terminal-20260721230151` |
| **提交** | `822906e8` |
| **时间** | 2026-07-21 23:01:51 +0800 |
| **说明** | 稳定性 Trust 加固 — 终态会话门控、续跑收敛与交付预览快路径 |

```bash
git show restore-point/post-stability-trust-terminal-20260721230151 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **终态会话门控（M7）**：`sessionTerminalComplete.ts`、`sessionTerminalFromTranscript.ts`；终态禁止 auto-continue
- **续跑策略收敛**：`manualContinuePolicy.ts`、`evaluateIncompleteDeliverableContinue.ts`、`taskResumeCoordinator.ts`
- **恢复面**：`recoverySurfaceState.ts`、`useAutoRecoveryContinue.ts`、`useColdResumeInitiator.ts` 终态/断连分支
- **网络断连**：`networkDisconnect.ts`、`networkFetchRegistry.ts` 统一 fetch 注册与断连提示
- **交付预览快路径**：`deliverablePreviewFastPath.ts`、`LazyVisibleProjectImage.tsx`、`buildSuperPreviewContextSync.ts`
- **校验管线**：`resolvePipelineValidationSettled.ts`、`DeliverableValidationSessionContext.tsx`
- **数据源交付物**：`dataSourcesDeliverable.ts` SDM 槽位扩展
- **E2E**：`terminal-session-no-autocontinue.spec.ts`、`deliverable-streaming-stability.spec.ts`
- **Bridge/背压**：`requestBackpressure.js`、`turnAcceptanceService.js`、`validateDeliverables.js`

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-stability-trust-terminal-20260721230151
```

### 从还原点开实验分支

```bash
git checkout -b experiment/stability-trust restore-point/post-stability-trust-terminal-20260721230151
```

### 只还原某个文件

```bash
git checkout restore-point/post-stability-trust-terminal-20260721230151 -- path/to/file
```

## 关联文档

- [`stability-trust-hardening-m7-terminal-gate-20260720.zh-CN.md`](./stability-trust-hardening-m7-terminal-gate-20260720.zh-CN.md)
- [`stability-trust-hardening-evaluation-20260720.zh-CN.md`](./stability-trust-hardening-evaluation-20260720.zh-CN.md)
- [`four-line-alignment-audit-2026-07-21.md`](./four-line-alignment-audit-2026-07-21.md)
- [`acceptance-report-2026-07-21.zh-CN.md`](./acceptance-report-2026-07-21.zh-CN.md)
- [`session-switch-ux-restore-point-20260720223049.md`](./session-switch-ux-restore-point-20260720223049.md)（上一还原点）
