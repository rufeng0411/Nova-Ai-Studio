# 视觉素材平台 VAP — 代码还原点

> 视觉素材发现/准备/绑定闭环、Office 导出 IR 富化、G700 视觉验收矩阵与 Turn 队列诊断加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-visual-asset-platform-20260720095342` |
| **提交** | `b9af8a91` |
| **时间** | 2026-07-20 09:53:42 +0800 |
| **说明** | 视觉素材平台 VAP、成果绑定闭环与 G700 视觉验收加固 |

```bash
git show restore-point/post-visual-asset-platform-20260720095342 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **VAP 平台核心**：`src/saas/media/visualAssetPlatform/`（orchestrator、discovery/prepare pipeline、slotBinder、manifestStore）
- **内置工具**：`prepareVisualAsset.ts`、`ingestVisualAsset.ts`、`resolveSessionVisualAssets.ts`；`generateImage` 自动 ingest
- **配置**：`visual-asset-recipes.json`、`visual-*-sources.json`、`visual-asset-manifest.schema.json`
- **成果绑定审计**：`deliverableVisualBindingAudit.ts`、`vapBindBeforeWrite.ts`、`enrichIrFromVisualManifest.ts`
- **G700 视觉验收**：`run-vap-g700-full-verification.mjs`、`run-g700-canary-verification.mjs`、八案/五案 fixtures 与 RCA 文档
- **Turn 队列**：`turnQueueManager`/`turnConcurrencyGate`/`turnSlotRegistry` 加固；`diagnose-turn-queue.mjs`
- **UI/预览**：`ProjectFilePreview`、`ProgressiveProjectImage`、视觉成果 E2E `visual-deliverable-preview-assets.spec.ts`
- **对话 UX**：`recoverySurfaceState`、`sessionTaskLifecycle`、`formalRecoveryInterrupt` 续跑面收敛

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-visual-asset-platform-20260720095342
```

### 从还原点开实验分支

```bash
git checkout -b experiment/vap restore-point/post-visual-asset-platform-20260720095342
```

### 只还原某个文件

```bash
git checkout restore-point/post-visual-asset-platform-20260720095342 -- path/to/file
```

## 关联文档

- [`visual-asset-platform-spec.zh-CN.md`](./visual-asset-platform-spec.zh-CN.md)
- [`visual-deliverable-platform-spec.zh-CN.md`](./visual-deliverable-platform-spec.zh-CN.md)
- [`visual-asset-binding-closure-spec.zh-CN.md`](./visual-asset-binding-closure-spec.zh-CN.md)
- [`mingdi-g700-vap-full-verification-report-20260719.zh-CN.md`](./mingdi-g700-vap-full-verification-report-20260719.zh-CN.md)
- [`mingdi-g700-governance-restore-point-20260719161743.md`](./mingdi-g700-governance-restore-point-20260719161743.md)（上一还原点）
