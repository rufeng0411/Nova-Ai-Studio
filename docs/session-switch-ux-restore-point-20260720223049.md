# 侧栏会话切换 UX — 代码还原点

> 侧栏点切会话加速、滚动位置恢复、尾页预取门控与 SuperPreview 兄弟页缓存加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-session-switch-ux-20260720223049` |
| **提交** | `c0e69fa9` |
| **时间** | 2026-07-20 22:30:49 +0800 |
| **说明** | 侧栏会话切换加速、滚动恢复与预取门控加固 |

```bash
git show restore-point/post-session-switch-ux-20260720223049 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **统一点选路径**：`applySelectProjectAndSession.ts` 侧栏/路由共用项目+会话选择逻辑
- **滚动恢复**：`sessionScrollRestorePolicy.ts` 切换后恢复消息列表滚动位置
- **加载占位**：`SessionMessagesLoadingPlaceholder.tsx` 弱提示切换中，减少空白闪烁
- **预取门控**：`sessionMessagePrefetchGate.ts`、`sessionMessageTailPrefetch.ts` 主会话加载时暂停悬停预取
- **SuperPreview 缓存**：`superPreviewSiblingCache.ts` 兄弟页 PNG 缓存减少重复 resolve
- **成果管线门控**：`sessionDeliverablesPipelineGate.ts` 切换时 defer validate
- **E2E/验收**：`session-switch-clickthrough.spec.ts`、`session-switch-perf.spec.ts`、`run-session-switch-validation.mjs`
- **perf flag**：`perfFeatureFlags.ts` 会话切换相关开关

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-session-switch-ux-20260720223049
```

### 从还原点开实验分支

```bash
git checkout -b experiment/session-switch restore-point/post-session-switch-ux-20260720223049
```

### 只还原某个文件

```bash
git checkout restore-point/post-session-switch-ux-20260720223049 -- path/to/file
```

## 关联文档

- [`dialogue-stability-full-chain-acceptance-2026-07-20.md`](./dialogue-stability-full-chain-acceptance-2026-07-20.md)
- [`conversation-catalog-backfill-2026-07-20.md`](./conversation-catalog-backfill-2026-07-20.md)
- [`trust-stack-four-line-restore-point-20260720210106.md`](./trust-stack-four-line-restore-point-20260720210106.md)（上一还原点）
