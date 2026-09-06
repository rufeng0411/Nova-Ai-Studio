# 成果 Trust UX — 代码还原点

> 成果用户态文案统一、验收路径 scope 过滤、ES9 repair 四案门禁与过程时间线 Trust 加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-deliverable-trust-ux-20260723162129` |
| **提交** | `18d07142` |
| **时间** | 2026-07-23 16:21:29 +0800 |
| **说明** | 成果 Trust UX、验收路径 scope 过滤与 ES9 repair 四案门禁 |

```bash
git show restore-point/post-deliverable-trust-ux-20260723162129 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **用户态文案**：`deliverableUserStatusCopy.ts`、`deliverableForbiddenUserTerms.ts` 禁止「交付物」等残留英文/旧词
- **验收 scope**：`filterAcceptancePathsForScope.ts` 跨 hub 路径过滤；`filterVerifiedForContractBinding` 对齐
- **助手完成门控**：`assistantCompletionGate.ts` 与 `taskContinuationPolicy.ts` repair 收敛
- **Dock/四线**：`buildUnifiedDeliverableView.ts`、`buildDeliverableDockRows.ts`、`DeliverableQualityStatus.tsx`
- **过程 UX**：`processTimelineBuilder.ts`、`resolveThinkingStepPresentation.ts` 思考步中文优先
- **ES9 repair 门禁**：`es9-repair-loop-four-case.test.ts` 四案 fixture
- **侧栏/生命周期**：`sidebarSessionExecutionStatus.ts`、`sessionTaskLifecycle.ts`、`recoverySurfaceState.ts`
- **Catalog**：`orphanCatalogSessions.js`、`catalogReadPath.js` orphan 会话可见性

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-deliverable-trust-ux-20260723162129
```

### 从还原点开实验分支

```bash
git checkout -b experiment/deliverable-trust-ux restore-point/post-deliverable-trust-ux-20260723162129
```

### 只还原某个文件

```bash
git checkout restore-point/post-deliverable-trust-ux-20260723162129 -- path/to/file
```

## 关联文档

- [`deliverable-false-complete-production-hardening-20260722.zh-CN.md`](./deliverable-false-complete-production-hardening-20260722.zh-CN.md)
- [`terminal-cold-resume-restore-point-20260723050510.md`](./terminal-cold-resume-restore-point-20260723050510.md)（上一还原点）
