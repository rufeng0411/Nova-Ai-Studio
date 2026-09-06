# 全链路性能优化 — 深度验收报告（2026-07-16）

> 初版摘要见 [`perf-full-stack-acceptance-20260716.zh-CN.md`](./perf-full-stack-acceptance-20260716.zh-CN.md)。本报告覆盖**回归修复 + 实机 Bridge 探针**。

## 深度验收范围

| 层级 | 覆盖项 |
|------|--------|
| 离线单测 | perf flags、pipeline gate、processGrouping、validate 展示、triple-unify、history tail/sanitize、bridge unit |
| 实机 Bridge | `session-switch-profile`（messages API P95）、`bridge-stability:browse`（侧栏连点背压） |
| 回归修复 | `useValidatedDeliverables` / `validateDeliverables` 策展与引擎 trust 路径 |

## 验收期间发现的问题与修复

### P0 — validate 展示回归（已修复）

**现象**

- `useValidatedDeliverables.test.tsx`：引擎 `acceptanceStatus=passed` 时 bare `index.html` 未出现在成果区（count=0）
- `validateDeliverables.test.ts`：策展规则过宽时 display 多出 `01-research.md` / `build.py`

**根因**

1. `mapDeliverableItemsFromEngineMeta` 在 `passed` 时对**全部** item 标 `verified`，且裸名未回写 `verifiedPaths` 全路径
2. 临时放宽「verified tool 一律展示」破坏了 `shouldShowDeliverableInPanel` 策展契约

**修复**

- `turnAcceptanceMeta.ts`：新增 `resolveVerifiedPathForItem`，按 basename 匹配 `verifiedPaths` 并写回 `resolvedPath`；移除 `passed`  blanket verify
- `validateDeliverables.ts`：`pending` 校验窗口可见；display 仍走 `shouldShowDeliverableInPanel`（仅 pending  bypass）

**复测**：UI 专项 42/42 PASS；bridge-stability unit 11/11 PASS

## 验收命令结果（深度轮）

| 命令 | 结果 | 备注 |
|------|------|------|
| `npm --workspace ui test -- useValidatedDeliverables validateDeliverables perfFeatureFlags processGrouping sessionDeliverablePipeline` | **PASS** 42/42 | 含引擎 trust + 策展 display policy |
| `npm run test:bridge-stability:unit` | **PASS** | vitest 11 + node 12 |
| `npm run test:deliverable-triple-unify` | **PASS** | export / 0709-live / sdm / rog-phase8-2 / 0708-batch |
| `npm run test:history-messages:quick` | **PASS** | sanitize 10 + tail 20 + pagination 8 |
| `npm run test:recovery:breakdown` | **PASS** | 遥测只读报告 |
| `SERVER_URL=http://127.0.0.1:7990 node scripts/diag/session-switch-profile.mjs` | **PASS** | P50=52ms **P95=118ms**（门禁 800ms）；wedged=false |
| `SERVER_URL=http://127.0.0.1:7990 npm run test:bridge-stability:browse` | **PASS** | readyP95=7ms，无 wedged |

### 实机 Bridge 摘要（2026-07-16T06:40Z）

- 数据盘：229 jsonl / 266MB；最大单会话 48.6MB（雷神）
- messages 探针 12 会话：全部 200；payload 0–0.61MB；**P95 118ms**
- 结论：Bridge 侧延迟正常；历史卡顿主因仍在前端 deliverable 全量扫描（Track A defer/bundle 已加固）

### 未纳入本轮（与 perf 无直接关联 / 需额外凭据）

| 命令 | 状态 |
|------|------|
| `npm run test:prelaunch:quick` | 已知 FAIL：`test:saas:deep` x-forwarded-for、`smoke:capability-hub` Pill 计数 |
| `ui/e2e/saas/session-switch-perf.spec.ts` | 需 `DIAG_USER`/`DIAG_PASS` Playwright 实机 |
| `npm run test:session-switch:validation --tier=1,2,5` | 需专用验收项目 + 长时 Gateway |

## 回滚速查（不变）

| 现象 | 回滚 |
|------|------|
| 历史消息缺失 | `PILOTDECK_HISTORY_TAIL_READ=0` |
| 成果清单异常 | `VITE_SESSION_PIPELINE_BUNDLE=0` + `VITE_DEFER_DELIVERABLES_WHILE_STREAMING=0` |
| validate 展示异常 | 检查 `turnAcceptanceMeta` 引擎 trust；紧急 `VITE_BYPASS_DELIVERABLE_VALIDATION=true` |
| Bridge validate 慢 | `PILOTDECK_VALIDATE_PARALLEL=0` |

## 变更文件（本轮修复）

- `ui/src/shared/turnAcceptanceMeta.ts` — 引擎 verified 路径 basename 解析
- `ui/src/shared/validateDeliverables.ts` — pending 可见 + 恢复 display 策展

## 建议后续（可选）

1. 对 48MB+ 大会话跑 Playwright `session-switch-perf` 对比优化前后 TTFP
2. 执行 `node scripts/diag/prune-stale-dev-jsonl.mjs --apply` 清理 7 个 >10MB 陈旧 jsonl（dry-run 已确认）
3. 发版前仍跑 `npm run test:pre-production` 精益门禁（不阻塞 perf hotfix）
