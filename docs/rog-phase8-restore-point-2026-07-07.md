# ROG Phase 8 — 代码还原点

> ROG Phase 5–8 交付修复闭环（0707 吴裕泰批次）验收全绿后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-rog-phase8-2026-07-07` |
| **提交** | `99adc1ff` |
| **说明** | 用户确认停 repair、视频回退链、ground-truth reconcile、Phase 8 门禁全绿 |

```bash
git show restore-point/post-rog-phase8-2026-07-07 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **确认完成**：`userDeliverableAcknowledgment` 用户确认 → passed，停 repair/UI 续跑
- **路径治理**：`sanitizeMalformedRepairPaths`、`filterPptIntermediateBroken`、`repairEligiblePath`
- **视频**：`video-model-registry.json`、`videoModelRegistry` 回退链、`video-mp4` profile
- **Reconcile**：`deliverableGroundTruth`、`reconcileDeliverableFacts`、`campaignPhaseCompletePass`
- **熔断**：`sessionRepairCircuitBreaker`、`repairStreakTracker`
- **验收**：`test:rog-phase5~8:*`、0707 错误簇 6/6 矩阵、吴裕泰 fixture 库

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-rog-phase8-2026-07-07
```

### 从还原点开实验分支

```bash
git checkout -b experiment/rog-p8 restore-point/post-rog-phase8-2026-07-07
```

### 只还原某个文件

```bash
git checkout restore-point/post-rog-phase8-2026-07-07 -- path/to/file
```

## 关联文档

- [`rog-phase8-acceptance-report-20260707.zh-CN.md`](./rog-phase8-acceptance-report-20260707.zh-CN.md)
- [`rog-phase7-acceptance-report-20260706.zh-CN.md`](./rog-phase7-acceptance-report-20260706.zh-CN.md)
- [`rog-phase5-acceptance-report-20260705.zh-CN.md`](./rog-phase5-acceptance-report-20260705.zh-CN.md)
