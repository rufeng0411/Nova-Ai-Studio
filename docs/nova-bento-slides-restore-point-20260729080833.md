# Nova Bento 幻灯集成 — 代码还原点 ★ Bento

> `nova-bento-slides` skill、SuperPreview Bento 编辑器、Hub PPT 区置顶与写盘门控；**Bento 演示/交付推荐从此还原点起步**。

## 标记

| 项 | 值 |
|----|-----|
| **Star** | ★ **Bento** |
| **标签** | `restore-point/post-nova-bento-slides-20260729080833` |
| **Star 别名** | `star/bento` |
| **提交** | `b5832404` |
| **时间** | 2026-07-29 08:08:33 +0800 |
| **说明** | Nova Bento 幻灯集成 — SuperPreview 编辑器、Hub 与写盘门控 |

```bash
git show restore-point/post-nova-bento-slides-20260729080833 --no-patch --format="%H %s %ci"
git show star/bento --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

### Nova Bento Skill

- `skills/nova-bento-slides/` — SKILL、outline schema、模板 deck、repair/splice/validate 脚本
- `docs/bento-deck-integration-notes.md`、`docs/bento-slides-acceptance-20260729.md`

### SuperPreview / UI

- `ui/src/components/super-preview/adapters/bentoDeck/BentoDeckAdapter.tsx`
- `bentoStudioSupport.ts`、`bentoStudioGate.ts`、`bentoStudioDock.ts`、`bentoDocSplice.ts`
- `SuperPreviewRoot.tsx`、`resolveEditAdapter.ts`、`artifactContract.ts` Bento 识别与默认编辑打开
- `ui/public/vendor/bento/` 壳 HTML 资产

### Bridge / 写盘门控

- `bentoWritePolicy.js` / `.test.js`、`bentoDeckWriteGuard.ts`
- `writeFile.ts` 引擎侧 Bento 写盘校验

### SDM / Hub / 能力

- `deliverableCapabilityProfiles.ts` — `bento-deck` profile
- `sessionDeliverableManifest.ts`、`sdmSlotMatching.ts` — Bento deck 槽位
- Hub catalog/i18n、PPT 区置顶、`capabilityBindingPrompt.ts`

### 验收

- `scripts/smoke-nova-bento.mjs`、`run-bento-slides-acceptance.mjs`、`ui-bento-deck-auto-open-check.mjs`
- `npm run smoke:nova-bento`（package.json）

### AGENTS.md

- continual-learning：Bento 默认编辑器、Hub 首位、SDM 大小写匹配、权限静默等

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`（vendor 临时克隆目录）

## 如何还原

```bash
git reset --hard restore-point/post-nova-bento-slides-20260729080833

# 或使用 Star 别名
git reset --hard star/bento
```

## 前置里程碑

- 对话 Surface：`restore-point/post-chat-surface-sidebar-sdm-20260728225739`
- ★ 智谱演示：`star/zhipu-demo-stable`
