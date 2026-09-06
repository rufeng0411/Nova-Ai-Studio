# UDC 交付三端统一 — 代码还原点

> Dock / 汇总表 / 任务文件夹 / HTML 导出四线契约统一（UDC R11）与 0709 实机验收通过后创建。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-deliverable-triple-unify-2026-07-09` |
| **提交** | `1db5e094`（功能 `d1179a95` + 还原点文档） |
| **说明** | buildUnifiedDeliverableView、任务文件夹 API、SDM profile merge、0709-live 全绿 |

```bash
git show restore-point/post-deliverable-triple-unify-2026-07-09 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **统一视图**：`buildUnifiedDeliverableView`、`resolveSessionDeliverableContract` 四线同源
- **任务文件夹**：`deliverableTaskFolder.js`、`fetchTaskFolderSnapshot`、`TaskFolderRailPanel`
- **SDM**：`mergeNumberedSlotsWithProfile`、`sdm-slot-profile-merge.json`、`filterVerifiedForContractBinding`
- **Ground Truth**：`deliverableGroundTruth` GT-10 strict、`normalizeDeliverableBasename`
- **验收**：`test:deliverable-triple-unify`、`test:goal-loop:0709-live`、四线 audit gate

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-deliverable-triple-unify-2026-07-09
```

### 从还原点开实验分支

```bash
git checkout -b experiment/udc-triple restore-point/post-deliverable-triple-unify-2026-07-09
```

### 只还原某个文件

```bash
git checkout restore-point/post-deliverable-triple-unify-2026-07-09 -- path/to/file
```

## 关联文档

- [`deliverable-triple-unify-spec.zh-CN.md`](./deliverable-triple-unify-spec.zh-CN.md)
- [`deliverable-triple-unify-acceptance-20260709.zh-CN.md`](./deliverable-triple-unify-acceptance-20260709.zh-CN.md)
- [`rog-phase8-2-restore-point-2026-07-08.md`](./rog-phase8-2-restore-point-2026-07-08.md)（上一还原点）
