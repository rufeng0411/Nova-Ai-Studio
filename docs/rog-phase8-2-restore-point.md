# ROG Phase 8-2 — 0707-2 小罐茶批次还原点

> Wave0 归档 + Wave1 引擎止血（视频 env / 首回合续跑 / 路由对齐）起点。

## 标记

| 项 | 值 |
|----|-----|
| **标签（计划）** | `restore-point/pre-rog-phase8-0707-2` |
| **批次归档** | `artifacts/0707-2小罐茶批次/` |
| **KPI 基线** | `artifacts/0707-2小罐茶批次/logs/kpi-baseline-0707-2.jsonl` |

## 本阶段主要变更

- **Wave0**：九会话 KPI 基线、P0 prompt README、归档结构门禁 `run-rog-phase8-2-archive.mjs`
- **Wave1 PR-V-ENV**：Gateway `applyGatewayMediaEnv` 与 Bridge 视频 env 对齐
- **Wave1 PR-V-ROUTE**：`VIDEO_MP4_GOAL_PATTERN` 与 `wantsRenderedVideo` 对齐；Win/SaaS 禁 Linux df-video bash
- **Wave1 PR-F-CONTINUE**：模板 planning 强制 auto_continue、首 turn 预算 +2、needs_repair UI 兜底

## 验收

```bash
node scripts/run-rog-phase8-2-archive.mjs --gate
npm run test -- src/saas/media/applyGatewayMediaEnv.test.ts
npm run test -- tests/saas/task-continuation-policy.test.ts
```

## 关联

- 终版计划：`0707-2长任务引擎与交付可见性-终版.plan.md`
- 上一还原点：[`rog-phase8-restore-point-2026-07-07.md`](./rog-phase8-restore-point-2026-07-07.md)
