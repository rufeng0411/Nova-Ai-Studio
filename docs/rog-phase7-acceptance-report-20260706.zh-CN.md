# ROG Phase 7 验收报告（0706 雷神批次）

**日期**：2026-07-06  
**还原点**：`restore-point/pre-rog-phase7-20260706`  
**归档**：`artifacts/0706雷神批次/`（12 导出 + 12 prompts + baseline KPI）

---

## 执行摘要

Phase 7 以 **单管道 `reconcileDeliverableFacts`** 收口 PPT/Nova 假缺口与 verified∩broken 双轨，并加 **SDM.repairCircuit 跨 turn 熔断** 与 UI `circuitBreakerTripped` 拒续跑。相对 0706 批次基线（repair 风暴 146/232/118 步级 needs_repair），自动化门禁已覆盖 G0–G7 判定层与 Phase 6 全量回归。

| KPI | 0706 基线（归档 HTML） | Phase 7 自动化（post-fix 逻辑） |
|-----|------------------------|----------------------------------|
| 零干预率 | 17%（2/12） | 静态路由/alias 门禁全绿 |
| PPT 三线 passed | 0/3 | T0706-07/08/09 静态门禁通过 |
| verifiedBrokenOverlap | 517c6c7e 等多会话 >0 | fixture `rog-517*` / `rog-nova-images-done*` → 0 |
| Phase 6 回归 | — | `test:rog-phase6:acceptance --gate` 全绿 |

---

## 自动化验收结果

| 级别 | 命令 | 结果 |
|------|------|------|
| L1 | `npm run test:rog-phase7:unit` | **PASS**（25 tests） |
| L2 | `npm run test:rog-phase7:integration` | **PASS**（13 fixtures + four-line） |
| L3 | Phase 6 内含 four-line | **PASS** |
| L5 | `test:rog-phase7:full-chain`（Playwright 离线） | **PASS**（7/8，1 live skip） |
| 编排 | `npm run test:rog-phase7:acceptance -- --gate` | **PASS** |
| Fork | `npm run check:saas-fork` | **448 条登记** |

---

## T0706 场景表（静态门禁 + 基线对照）

| ID | 场景 | 静态门禁 | 0706 导出末态 | 备注 |
|----|------|----------|---------------|------|
| T0706-01 | Campaign 全案 | profile=campaign ✓ | passed | 回归 |
| T0706-02 | last30days | anchor 过滤 ✓ | passed | G4 |
| T0706-03 | AI 配图幻灯 | 不误升 ppt-master ✓ | passed | 回归 |
| T0706-04 | HTML 演示 | 基线归档 ✓ | unknown | 零干预 |
| T0706-05 | 杂志长文 | 基线归档 ✓ | unknown | G5 报告 GT |
| T0706-06 | Nova-竞品对标 | profile=research ✓ | needs_repair×8 | G5 已加 passed GT |
| T0706-07 | PPT 生成 | df-ppt→ppt-master ✓ | needs_repair×146 | **G2+G1** |
| T0706-08 | 原生可编辑 PPT | pptx alias ✓ | needs_repair×232 | **G1+G2** |
| T0706-09 | Nova-美学幻灯 | nova-slide-deck + deck pass ✓ | needs_repair×118 | **G3** |
| T0706-10 | 爆款文案+视频 | combo stage ✓ | unknown | G6 UX |
| T0706-11 | 播客+音频 | 文档化 ✓ | unknown | G6 |
| T0706-12 | 营销视频 | 环境依赖 ✓ | unknown | Key/模型 |

**P0 三线（T0706-07~09）**：判定层 fixture + KPI **3/3 静态通过**；Gateway 实机复验见下节。

---

## L4 实机（Gateway）状态

| 项 | 说明 |
|----|------|
| 前置 | `npm run dev:saas` + 模型池生图 Key |
| 命令 | capability try → `turn_completed` → `npm run test:rog-phase7:live -- --jsonl=<session.jsonl> --gate` |
| 本次会话 | **未启动 12 场景实机**（避免无 Key 长时间空跑）；基线已写入 `artifacts/0706雷神批次/kpi-baseline-0706.jsonl` |
| 发版前必做 | **T0706-07/08/09** 各 ≤15min wall-clock；`verifiedBrokenOverlap=0` |

---

## 主要代码变更（PR-G0~G7）

1. **`reconcileDeliverableFacts.ts`**：alias / dedupe overlap / novaDeckCompletePass / verifier gap 剔除  
2. **`sessionRepairCircuitBreaker.ts`**：SDM.repairCircuit 跨 turn ≥3 或 total≥6 熔断  
3. **`validateDeliverablesEngine.ts`**：单管道调用 + reconcile 后 acceptance 重算  
4. **`deliverableCapabilityProfiles.ts`**：df-ppt 升级、nova-slide-deck 优先、research 竞品 pattern  
5. **UI**：`circuitBreakerTripped` 阻断 `useIncompleteDeliverableAutoContinue`；`combo_stage_pending`  
6. **基建**：`test:rog-phase7:*`、`analyze-rog-batch-exports.mjs` 增强列、0706 归档

---

## Flag 回滚

| Flag | 默认 | 作用 |
|------|------|------|
| `PILOTDECK_SESSION_REPAIR_CIRCUIT_BREAKER` | ON | G0 熔断 |
| `PILOTDECK_PPTX_BASENAME_ALIAS` | ON | G1 alias |
| `PILOTDECK_PPT_HUB_ROUTE_STRICT` | ON | G2 路由（binding+SDM） |
| `PILOTDECK_NOVA_SVG_DEGRADE` | ON | G3 去重+deck pass |
| `PILOTDECK_ANCHOR_SANITIZE` | ON | G4 anchor |
| `PILOTDECK_RESEARCH_PASSED_GT` | ON | G5 研究 passed |
| `VITE_PILOTDECK_COMBO_STAGE_UI` | ON | G6 阶段 UI |

---

## 建议

- **可合并代码并打包**；L4 P0 三线实机建议在 `dev:saas` + 生图 Key 环境跑一轮后更新本报告「L4」节为 PASS。  
- 打包前：`npm run test:rog-phase7:acceptance -- --gate` + `npm run brand:check`（已知 PlatformOps 项不纳入 DoD）。

---

*生成：ROG Phase 7 自动化编排 `scripts/run-rog-phase7-acceptance.mjs`*
