# Goal Loop Phase 2 v2 — 本地执行摘要

**日期**：2026-07-02  
**范围**：本仓库 Phase 0–L + Phase 5 终验骨架（不含外部仓库操作）

## 阶段状态

| Phase | 内容 | 状态 |
|-------|------|------|
| 0+0b | acceptance 补 fallback、H0 文档、空 assistant 历史注入、Playwright 7990/8081 | 已落地 |
| 1 H | task-resume 过滤、user_action 互斥、cold resume 阻断、空表 reject、墙钟 | 已落地 |
| 2 I | detectGoalPivot、4 profiles、chart phantom 过滤 | 已落地 |
| 3 J/K | mediaStrategyResolver（flag） | 已落地 |
| 4 L | run-goal-loop-phase2-acceptance、replay fixture | 已落地 |
| 5 | final-load、live-matrix spec（15 case）、cases.json | 骨架已落地；实机需 `GOAL_LOOP_LIVE_MATRIX=1` |

## 验收命令

```bash
npm run test:goal-loop:acceptance
npm run test:goal-loop:phase2
npm run test:goal-loop:acceptance:full
node scripts/run-goal-loop-final-load.mjs   # 需 dev:saas
GOAL_LOOP_LIVE_MATRIX=1 npx playwright test ui/e2e/saas/goal-loop-final-live-matrix.spec.ts --workers=1
```

## 终验项目

- admin 项目 **「终验0702」**
- 环境变量：`SAAS_E2E_PROJECT=终验0702`、`FINAL_MATRIX_PROJECT=终验0702`
- **禁止** teardown 删除项目/会话/成果

权威细节见 Cursor 计划 rev.5.1 与 v1 文档 §10–13。
