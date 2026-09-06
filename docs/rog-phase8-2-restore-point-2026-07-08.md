# ROG Phase 8-2 — 代码还原点

> 0707-2 小罐茶批次：交付 Dock/右栏清单、视频 env 统一、首回合续跑与 Gateway 构建修复验收通过后创建。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-rog-phase8-2-2026-07-08` |
| **提交** | `db915cb1`（功能 `a5cd06d2` + AGENTS/还原点文档） |
| **说明** | DeliverableSessionDock、RightWorkspaceRail、applyGatewayMediaEnv、Phase 8-2 门禁全绿 |

```bash
git show restore-point/post-rog-phase8-2-2026-07-08 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **UI**：`DeliverableSessionDock`、`deriveDeliverablesDockState`、`ComposerV2` 双 icon、`RightWorkspaceRail`
- **Dock 数据**：`buildDeliverableDockRows`、`mergeFolderItemsIntoDockRows`、`accumulateDockExpectedManifest`
- **引擎**：`applyGatewayMediaEnv`、视频路由对齐、模板首回合 auto_continue、`reconcileDeliverableFacts` 加固
- **构建**：Gateway 类型导出、`copy-dist-runtime`、打包链路修复
- **验收**：`test:rog-phase8-2:*`、`test:deliverable-dock:acceptance`、Phase 6/7/8 回归

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-rog-phase8-2-2026-07-08
```

### 从还原点开实验分支

```bash
git checkout -b experiment/rog-p8-2 restore-point/post-rog-phase8-2-2026-07-08
```

### 只还原某个文件

```bash
git checkout restore-point/post-rog-phase8-2-2026-07-08 -- path/to/file
```

## 关联文档

- [`rog-phase8-2-acceptance-report-20260707.zh-CN.md`](./rog-phase8-2-acceptance-report-20260707.zh-CN.md)
- [`rog-phase8-restore-point-2026-07-07.md`](./rog-phase8-restore-point-2026-07-07.md)（上一还原点）
