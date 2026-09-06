# SDM 成果清单冻结 + 管线门控 — 代码还原点

> SDM baseline 冻结槽位加固、编号清单 pathHints 槽位匹配、Ground Truth 自动开启、侧栏切换成果管线延迟门控。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-sdm-baseline-pipeline-gate-20260712123526` |
| **提交** | `e5f3e94e` |
| **时间** | 2026-07-12 12:35:26 +0800 |
| **说明** | SDM 冻结、sdmSlotMatching、pipeline gate、汇总表 |

```bash
git show restore-point/post-sdm-baseline-pipeline-gate-20260712123526 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **SDM 冻结**：`sessionDeliverableManifest` baseline 锁定；`deliverableChecklistAuthority` 编号清单 pathHints 解析
- **槽位匹配**：`sdmSlotMatching` 长文 count≥2、`deliverableGroundTruth` 自动 strict GT
- **汇总表**：`buildDeliverableSummaryRows` / `selectLatestDeliverableSummaryTurn` 读冻结 manifest
- **性能门控**：`sessionDeliverablesPipelineGate` 侧栏切换后 idle 再扫成果，防主线程卡顿
- **诊断**：`scripts/diag/session-switch-profile.mjs` 切换剖面脚本

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-sdm-baseline-pipeline-gate-20260712123526
```

### 从还原点开实验分支

```bash
git checkout -b experiment/sdm-pipeline restore-point/post-sdm-baseline-pipeline-gate-20260712123526
```

### 只还原某个文件

```bash
git checkout restore-point/post-sdm-baseline-pipeline-gate-20260712123526 -- path/to/file
```

## 关联文档

- [`prompt-v2-checklist-tombstone-restore-point-20260712003107.md`](./prompt-v2-checklist-tombstone-restore-point-20260712003107.md)（上一还原点）
