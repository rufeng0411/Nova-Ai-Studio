# 智谱演示稳定版本 — 代码还原点 ★

> Skills Nova-fit 批次、Hub 可见性后台、SDM/PPT/GEO 交付加固与上线前全面评估；**智谱演示推荐从此还原点起步**。

## 标记

| 项 | 值 |
|----|-----|
| **Star** | ★ **智谱演示稳定版本** |
| **标签** | `restore-point/post-zhipu-demo-stable-20260728210731` |
| **Star 别名** | `star/zhipu-demo-stable` |
| **提交** | `2873c348` |
| **时间** | 2026-07-28 21:07:31 +0800 |
| **说明** | 智谱演示稳定版 — Skills Nova-fit、Hub 可见性与 SDM/PPT 加固 |

```bash
git show restore-point/post-zhipu-demo-stable-20260728210731 --no-patch --format="%H %s %ci"
git show star/zhipu-demo-stable --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### Skills Nova-fit 批次

- `scripts/skills-nova-fit-check.mjs`、`docs/skills-nova-fit-p0-batch-manifest.json`
- Cyber-PPT Nova 快路径与 `nova_pptx_layout.py`
- GEO keyword 模板、content-flywheel、matrix/flywheel/PPT 等 SKILL 对齐 Nova 交付口径
- `capabilityBindingPrompt.ts`、`capabilityTryPrompts.mjs` try-prompt 与 binding 同步

### Hub 可见性与分类

- `config/hub-visibility.json`、`hubVisibility.mjs`、`HubVisibilityAdminPage.tsx`
- `financeHubTaxonomy.mjs`、能力中心排序与 taxonomy 更新
- catalog / i18n / try-prompts 大规模再生成

### SDM / 成果 / 验收

- `deliverableChecklistAuthority.ts`、`sdmSlotMatching.ts`、`deliverablePathHintSanitize.ts`
- `officeExtensionStrictCore.ts`、`acceptanceArtifactKind.ts`、`detectGoalMutation.ts`
- 四线 Sticky 延续：`SessionDeliverableSummaryBar`、`presentConversationDeliverableRows.ts`

### 验收与文档

- `docs/prelaunch-comprehensive-evaluation-report-2026-07-28.zh-CN.md`
- `docs/four-line-alignment-audit-2026-07-28.md`
- `docs/html-studio-acceptance-report-2026-07-28.md`
- `scripts/run-prelaunch-comprehensive-suite.mjs`

### 设计稿

- `artifacts/saas-design/team-workspace/` 三版 Sketch HTML

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`

## 如何还原

```bash
# 硬回退（丢弃之后所有提交）
git reset --hard restore-point/post-zhipu-demo-stable-20260728210731

# 或使用 Star 别名
git reset --hard star/zhipu-demo-stable

# 从还原点开实验分支
git checkout -b experiment/zhipu-demo restore-point/post-zhipu-demo-stable-20260728210731
```

## 前置基线

- G0 基线：`restore-point/pre-skills-nova-fit-20260727233726`（Skills Nova-fit 批次开工前）
