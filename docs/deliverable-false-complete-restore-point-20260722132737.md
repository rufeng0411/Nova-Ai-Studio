# 成果假完成生产加固 — 代码还原点

> ES9 五案回放/实机、SDM 槽位匹配加固、助手完成门控与四线 validate 管线收敛。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-deliverable-false-complete-20260722132737` |
| **提交** | `b17df418` |
| **时间** | 2026-07-22 13:27:37 +0800 |
| **说明** | 成果假完成生产加固 — ES9 五案回放、SDM 槽位匹配与助手完成门控 |

```bash
git show restore-point/post-deliverable-false-complete-20260722132737 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **助手完成门控**：`assistantCompletionGate.ts` 禁止仅凭进度叙事标 passed
- **SDM/槽位**：`sdmSlotMatching.ts`、`deliverableChecklistAuthority.ts`、`mergeNumberedSlotsWithProfile.ts`
- **Ground Truth**：`deliverableGroundTruth.ts`、`validateDeliverablesEngine.ts` progress-alone 单测
- **四线 UI**：`buildUnifiedDeliverableView.ts`、`resolvePipelineValidationSettled.ts`、`useValidatedDeliverables.ts`
- **工具路径槽位**：`resolveDeliverableSlotFromToolPath.ts` transcript 路径回写 slot
- **ES9 验收**：`run-es9-five-case-replay.mjs`、`run-es9-five-case-live.mjs`、五案 fixtures
- **VAP/质量链**：`vapManifestRewrite.ts`、`deliverableQualityPipeline.ts`、`enrichIrFromVisualManifest.ts`
- **文档**：`deliverable-false-complete-production-hardening-20260722.zh-CN.md`

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-deliverable-false-complete-20260722132737
```

### 从还原点开实验分支

```bash
git checkout -b experiment/false-complete restore-point/post-deliverable-false-complete-20260722132737
```

### 只还原某个文件

```bash
git checkout restore-point/post-deliverable-false-complete-20260722132737 -- path/to/file
```

## 关联文档

- [`deliverable-false-complete-production-hardening-20260722.zh-CN.md`](./deliverable-false-complete-production-hardening-20260722.zh-CN.md)
- [`pre-production-acceptance-20260722.zh-CN.md`](./pre-production-acceptance-20260722.zh-CN.md)
- [`task-stall-unpause-restore-point-20260722094150.md`](./task-stall-unpause-restore-point-20260722094150.md)（上一还原点）
