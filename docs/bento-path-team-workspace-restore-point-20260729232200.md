# Bento 预览分流、成果路径解析与团队协作 Sketch — 代码还原点

> Bento view/edit 预览分流、STDA 主任务目录与成果路径解析加固；team-workspace v-final 协作 Sketch 扩展。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-bento-path-team-workspace-20260729232200` |
| **提交** | `2de7705c` |
| **时间** | 2026-07-29 23:22:00 +0800 |
| **说明** | Bento 预览分流、成果路径解析与团队协作 Sketch 扩展 |

```bash
git show restore-point/post-bento-path-team-workspace-20260729232200 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### Bento 预览与 repair

- `BentoDeckAdapter.tsx` — view 网页预览 / edit Bento 编辑器分流
- `scripts/lib/repairStaticHtmlToBento.mjs` 共享内核 + Bridge `repairStaticHtmlToBento.js`
- `skills/nova-bento-slides/` repair/validate 脚本瘦身与 quality-gates 更新

### 成果路径 / STDA

- `resolvePrimaryTaskArtifactDir.ts`（引擎 + UI）主任务目录解析加固
- `deliverablePathResolve.mjs`、`resolveDeliverablePath.ts`、`openDeliverableDockRow.ts`
- `validateDeliverablesEngine.ts`、`sdmSlotMatching.ts`、`reconcileDeliverableFacts.ts`
- `DeliverableSessionSheet.tsx`、`SessionDeliverableSummaryBar.tsx` 预览快路径

### 团队协作 Sketch

- `artifacts/saas-design/team-workspace/v-final/` — 侧栏优先 14 屏 + chosen/composite
- `DEMO-SITEMAP.md`、`DESIGN-sidebar-first.zh-CN.md`、mobile readonly

### 其他

- `deploy/Dockerfile.prod`、`verify-cloud-runtime.sh` repair 模块
- `AGENTS.md` continual-learning（Bento view/edit、Star 里程碑）

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeptest.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`

## 如何还原

```bash
git reset --hard restore-point/post-bento-path-team-workspace-20260729232200
```

## 星标里程碑（未移动）

- ★ Bento 初集成：`star/bento` @ `b5832404`
- ★ 智谱演示：`star/zhipu-demo-stable`
