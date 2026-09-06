# Trust Stack 四线对齐 — 代码还原点

> 对话成果四线同步、Trust Stack 回放/性能门禁、Bridge 会话 resolve 与 G700 生产评估加固。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-trust-stack-four-line-20260720210106` |
| **提交** | `3b6354ef` |
| **时间** | 2026-07-20 21:01:06 +0800 |
| **说明** | Trust Stack 四线对齐、对话成果同步与 G700 评估加固 |

```bash
git show restore-point/post-trust-stack-four-line-20260720210106 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **Trust Stack 门禁**：`run-trust-stack-deep.mjs`、`run-trust-stack-perf.mjs`、`run-trust-stack-replay-gate.mjs`；大会话 fixture 与 E2E `trust-stack-perf.spec.ts`
- **四线对齐审计**：`audit-four-line-alignment.mjs`、`audit-conversation-deliverable-tables.mjs`、四线 workspace/transcript fixtures
- **对话成果同步**：`presentConversationDeliverableRows.ts`、`buildTurnDeliverableView.ts`、`DeliverableSummaryTable` 会话同步单测
- **成果上下文不变量**：`deliverableContextInvariants.ts`、`dedupeDeliverableRowsByBasename.ts`、`conversationDeliverableFeatureFlags.ts`
- **Bridge 解析**：`bridgeSessionResolve.js` 会话 resolve 热路径与单测
- **Composer/会话**：`fileReferenceComposer.ts`、`userMessageDisplayDedup.ts`、`resolveAbortTargetSessionId.ts`、`useProjectsState` coalesce
- **VAP 目标过滤**：`officialRootsGoalFilter.ts` 官方素材根按 goal 过滤
- **评估文档**：G700 生产评估 20260720、Trust Stack 回滚演练、四线审计报告

## 排除项（未纳入提交）

- `general/artifacts/**`（本地交付物）
- `dev-saas-deeptest.out.txt`
- `.superpowers/`（本地 SDD 进度）

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-trust-stack-four-line-20260720210106
```

### 从还原点开实验分支

```bash
git checkout -b experiment/trust-stack restore-point/post-trust-stack-four-line-20260720210106
```

### 只还原某个文件

```bash
git checkout restore-point/post-trust-stack-four-line-20260720210106 -- path/to/file
```

## 关联文档

- [`trust-stack-rollback-drill-20260720.md`](./trust-stack-rollback-drill-20260720.md)
- [`four-line-alignment-audit-2026-07-20.md`](./four-line-alignment-audit-2026-07-20.md)
- [`mingdi-g700-production-hardening-evaluation-20260720.zh-CN.md`](./mingdi-g700-production-hardening-evaluation-20260720.zh-CN.md)
- [`visual-asset-platform-restore-point-20260720095342.md`](./visual-asset-platform-restore-point-20260720095342.md)（上一还原点）
