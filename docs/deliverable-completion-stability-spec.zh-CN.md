# 交付完成稳定性规格（Goal Loop R9–R10）

> 权威还原基线：`restore-point/post-rog-phase8-2-2026-07-08`  
> 验收黄金集：`tests/fixtures/goal-loop/0708/` + `npm run test:goal-loop:0708-batch`

## 四条不变式

| ID | 规则 | 违反症状 |
|----|------|----------|
| I1 | 槽位仅来自 goal/profile/Campaign/引擎 verified；禁 skill 模板独占 | Dock 1/1 vs 正文多文件 |
| I2 | 有 pathHint 或 Campaign pattern 时禁止 kind 泛化匹配 | 1 个 md 覆盖 3 个 md 槽 |
| I3 | `passed` 须 SDM 全 required 槽覆盖；禁 verified=0 假完成 | 空表宣称完成 |
| I4 | resolve/preview/memory 锚定 sessionGoalAnchor + turnArtifactDir | 同 hub 串台 |

## 数据流（turn 末）

1. `validateEngineDeliverables` 终验  
2. `reconcileSlotsWithVerifiedPaths` 同步 SDM slots  
3. `recordSessionDeliverableManifest` 追加 JSONL（Bridge **禁止**写 SDM）  
4. WS `session_manifest_updated` 刷新 UI contract  
5. Dock / 汇总表 / Composer 读同一 `resolveSessionDeliverableContract` 内核  

## 扩行规则（I1-bis）

| 来源 | 可否新增 contract 行 |
|------|---------------------|
| 引擎 `verifiedPaths` | 可以 |
| 无 SDM 基线时的正文/用户显式路径 | 可以 |
| 有 SDM 基线时的 assistant 正文提及 | **不可以**（仅 enrich） |
| folder scan / glob | **禁止**增行 |

## Feature flags（生产默认）

| 变量 | 默认 | 说明 |
|------|------|------|
| `PILOTDECK_SESSION_DELIVERABLE_MANIFEST` | 1 | SDM 开 |
| `PILOTDECK_COMPLETION_GATE` | 1 | 完成门控 |
| `PILOTDECK_VERIFICATION_PASS` | 1 | 核验通道 |
| `PILOTDECK_GROUND_TRUTH_RECONCILE` | 1 | 磁盘事实 reconcile |
| `PILOTDECK_DELIVERABLE_SUMMARY_FORCE` | 1 | 汇总表必显 |
| `PILOTDECK_REPAIR_CIRCUIT_STRICT` | 0 | 熔断 tripped→passed；staging/黄金集可开 1 |

## Composer 生命周期

| 阶段 | Composer | 用户说「可以了」 |
|------|----------|------------------|
| `deliverable_incomplete` | 软禁用 | `userDeliverableAcknowledgment` 仍生效 |
| `turn_streaming` / repair | 禁用 | 等 turn 结束 |
| `blocked_user_action` | 禁用 | 走 UAR 卡片 |

## 门禁

```bash
npm run test:sdm:unit
npm run test:rog-phase8-2:unit
npm run test:goal-loop:0708-batch
npm run test:goal-loop:acceptance
npm run analyze:task-completion -- --gate
```
