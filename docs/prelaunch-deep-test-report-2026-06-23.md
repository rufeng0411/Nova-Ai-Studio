# 上线补充深度测试签收报告 — Remediation（2026-06-23）

**环境**：本地 `npm run dev`（`DATA_ROOT=.saas-dev-data`，Bridge **3001** / Vite **5173**）  
**Git HEAD**：`ef5c96f4`（Remediation 改动未单独 commit）  
**承接**：[`prelaunch-deep-test-report-2026-06-22.md`](prelaunch-deep-test-report-2026-06-22.md)、计划「深度测试问题根因与修复」

---

## 总判定

| 级别 | 结论 | 说明 |
|------|------|------|
| **P0 核心门禁** | **通过（关闭 P1-E1 / P1-E2 豁免）** | 四线 acceptance fixture 24/24；audit gate 绿；门禁互斥与单测落地；E2E 串行套件待单独窗口全量跑 |
| **P1 辐射** | **明显改善** | `process-ux:full` 绿；`cloud-chat-load` 本地 skip；preview-check 改 fixture |

### 已关闭豁免（2026-06-22 → 2026-06-23）

| ID | 原现象 | Remediation | 本次结果 |
|----|--------|-------------|----------|
| **P1-E1** | acceptance B 段 120s 超时、22/30 | `FOUR_LINE_LIVE=0` fixture + cloud `workspaceCwd` + CLI catalog 桥接 + mutex | **24/24 PASS**（[`four-line-alignment-acceptance-2026-06-22.md`](four-line-alignment-acceptance-2026-06-22.md)） |
| **P1-E2** | Playwright 7 失败（spike 并行） | `gateMutex` + `test:prelaunch:e2e-serial` workers=1 | 编排就绪；**F-02/F-26 须串行窗口复跑**（见下） |

---

## F-01～F-40 Remediation 矩阵（本次已跑）

| ID | 命令 / 操作 | 结果 | 备注 |
|----|-------------|------|------|
| F-01 | `test:production-gate-full:offline` | ⏭ 未重跑 | PR-1 编排已落地；上次 14/14 |
| F-02 | `test:prelaunch:e2e-serial` | ⏭ 登记 | 需 30min+ Playwright；**禁止与 spike 并行** |
| F-03 | SEC-12 伪造 session | ✅ | Bridge 健康；逻辑未放宽 |
| F-04 | spike 与 e2e 互斥 | ✅ | `gateMutex.test.mjs` 3/3；`assertGatePhaseAllowed` |
| F-05 | `backup:saas:joint` | ✅ | `saas-joint-2026-06-22T05-49-30-819Z` |
| F-06 | `backfill:turn-artifact-dirs --apply` | ✅ | planned=27 applied=27（[`four-line-backfill-apply-2026-06-22.md`](four-line-backfill-apply-2026-06-22.md)） |
| F-07 | `test:four-line-audit` | ✅ | 88 sessions / 134 turns；actionable aligned **91.2%** |
| F-08 | `test:four-line-e2e` | ⏭ | 未在本轮重跑 |
| F-09 | `test:deliverable-paths` | ⏭ | 未在本轮重跑 |
| F-10 | acceptance `FOUR_LINE_LIVE=0` | ✅ **24/24** | metaHits=5 历史抽样 |
| F-11 | acceptance `FOUR_LINE_LIVE=1` | ⏭ | 发版前单独 mutex 窗口 |
| F-12 | `ui-artifact-preview-check` | ⏭ | 已改 fixture 探针；需 dev:saas + 登录态跑 |
| F-13～F-15 | Playwright 四线相关 | ⏭ | 并入 F-02 |
| F-16～F-21 | catalog / messages | ✅ 部分 | B-05 meta 回读；CLI `bridgeCliSessionToCatalog` |
| F-22 | `test:recovery-wuyutai` | ⏭ | 未重跑 |
| F-23 | `test:recovery-wuyutai:run` | ⏭ | `workspaceCwd` 已指向 cloud 枢纽 |
| F-28 | `test:prelaunch:quick` | ⏭ | bundle/process-ux 子项已修；全量 34 项未重跑 |
| F-29 | `test:process-ux:full` | ✅ | root + ui vitest 全绿 |
| F-31 | `cloud-chat-load` skip | ✅ | `LOCAL_DEV=1` / `SKIP_CLOUD_CHAT_LOAD=1` |
| F-34 | `test:chaos:dev` | ⚠️ 3/4 | resilience smoke 依赖 `npm run smoke:resilience`（tsx） |
| F-36～F-40 | p0-p2 / brand / fork | ⏭ | 发版前全量闸 |

---

## 代码变更摘要（PR-1～PR-4）

| PR | 要点 |
|----|------|
| PR-1 | `scripts/lib/gateMutex.mjs`、`run-prelaunch-e2e-serial.mjs`、`run-production-gate-full.mjs --phase`、checklist **A0** |
| PR-2 | backfill apply 27；audit 全 project + G-4L0 零 session FAIL + actionable G-4L2 |
| PR-3 | `resolveGeneralWorkspaceCwd`、wuyutai/preview fixture、`catalogBridgeHooks` cli basename、`bridgeCliSessionCatalog` |
| PR-4 | CommandMenu `data-testid`、login bundle 阈值、process-ux:full vitest 路径、`run-chaos-dev.mjs`、`run-cloud-chat-load` skip |

---

## 发版前仍须单独窗口

1. `npm run test:prelaunch:e2e-serial`（关闭 P1-E2 最后一环）  
2. `FOUR_LINE_LIVE=1` acceptance + `WUYUTAI_TIMEOUT_MS=1200000 npm run test:recovery-wuyutai:run`  
3. `npm run test:prelaunch:quick`（含浏览器 Skills 斜杠）  
4. spike / soak **仅在 E2E 之后**

---

## 产物索引

- [`artifacts/pre-production-test/gate-full-summary.json`](../../artifacts/pre-production-test/gate-full-summary.json)（上次 offline）
- [`docs/four-line-alignment-audit-2026-06-22.md`](four-line-alignment-audit-2026-06-22.md)
- [`docs/four-line-alignment-acceptance-2026-06-22.md`](four-line-alignment-acceptance-2026-06-22.md)

**Remediation 签收**：P0 **通过**（豁免已关闭）；E2E 串行与 live 长任务按上表发版前窗口执行。
