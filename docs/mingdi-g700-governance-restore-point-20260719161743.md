# 鸣镝 G700 生产加固 — 代码还原点

> 四线成果治理、官方素材链、交付质量验收链、Binary Intent Gate 与全栈性能 flag 加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-mingdi-g700-governance-20260719161743` |
| **提交** | `6e829ab2` |
| **时间** | 2026-07-19 16:17:43 +0800 |
| **说明** | 鸣镝 G700 四线成果治理、官方素材链与质量验收链 |

```bash
git show restore-point/post-mingdi-g700-governance-20260719161743 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **鸣镝 G700 验收链**：`run-mingdi-g700-*.mjs`、`mingdiG700LiveScenarios.mjs`、fixtures 与导出 HTML 四线解析
- **四线成果治理**：`exportSessionHtml.ts`、`buildUnifiedDeliverableView.ts`、`turnAcceptanceMeta.ts`、`deliverableTaskFolder.js` 对齐
- **交付质量/验收证书**：`deliverableAcceptanceCertificate.ts`、`deliverableQualityPipeline.ts`、`finalizeDeliverableAcceptance.ts`
- **官方素材链**：`config/official-source-roots.json`、`fetchMediaAsset.ts`、`officialMediaFallbackStateMachine.ts`、`assetProvenanceLedger.ts`
- **Capability Scope v2**：`src/saas/constraints/`、`audit-capability-scope.mjs`、`goalQualityContract.ts`
- **Binary Intent Gate**：`src/saas/intent/`（`turnInteractionMode`、`resolveCurrentIntent`、`turnInteractionUiPolicy`）
- **Turn Queue 加固**：`turnQueueIdempotency.js`、`turnQueueSessionLock.js`、`acceptedInputDedup.ts`
- **性能 flag**：`perfFeatureFlags.ts`、`runtimeFeatureFlags.js`、`bridgeSessionStateLru.js`；`pack.mjs` / `apply-cloud-perf-env.sh`
- **fork manifest**：`config/pilotdeck-core-fork.manifest.json` 增量登记

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-mingdi-g700-governance-20260719161743
```

### 从还原点开实验分支

```bash
git checkout -b experiment/mingdi-g700 restore-point/post-mingdi-g700-governance-20260719161743
```

### 只还原某个文件

```bash
git checkout restore-point/post-mingdi-g700-governance-20260719161743 -- path/to/file
```

## 关联文档

- [`mingdi-g700-production-hardening-evaluation-20260719.zh-CN.md`](./mingdi-g700-production-hardening-evaluation-20260719.zh-CN.md)
- [`mingdi-g700-production-hardening-acceptance-20260719.zh-CN.md`](./mingdi-g700-production-hardening-acceptance-20260719.zh-CN.md)
- [`deliverable-four-line-production-acceptance-20260717.zh-CN.md`](./deliverable-four-line-production-acceptance-20260717.zh-CN.md)
- [`compute-steady-state-train0-restore-point-20260714082139.md`](./compute-steady-state-train0-restore-point-20260714082139.md)（上一里程碑还原点）
