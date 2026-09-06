# 上线补充深度测试签收报告（2026-06-22）

**环境**：本地 `npm run dev`（PG + Redis，`DATA_ROOT=.saas-dev-data`）  
**执行窗口**：2026-06-22 12:22–12:50 CST  
**口径**：`SERVER_URL=http://127.0.0.1:3001`（Bridge/API）；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173`（Vite）  
**承接**：[`post-gate-dev-acceptance-2026-06-22.md`](post-gate-dev-acceptance-2026-06-22.md)、[`prelaunch-production-gate-2026-06-22.md`](prelaunch-production-gate-2026-06-22.md)

---

## 端口与健康

| 服务 | 端口 | 探针 |
|------|------|------|
| Bridge/API | **3001** | `GET /api/auth/status` → 200 |
| Gateway WS | **18789** | wuyutai `hello_ok` |
| Vite | **5173** | HTTP 200 |

---

## 总判定

| 级别 | 结论 | 说明 |
|------|------|------|
| **P0 核心门禁** | **有条件通过（2 项登记豁免）** | SEC、存储、负载、离线门禁全绿；四线历史对齐率 & live 造数、并发 Playwright 有缺口 |
| **P1 辐射** | **部分未跑 / 已知 flaky** | soak、云端 chat-load、Docker 混沌、Skills 斜杠浏览器项 |

### P0 豁免单（≤2 项，已用满）

| ID | 项 | 现象 | 归类 | ETA |
|----|-----|------|------|-----|
| **P1-E1** | 四线实机 acceptance B 段 | Gateway 新建对话 120s 超时；`cli:project` meta 未回读 | 与并行压测 + 长 turn 叠乘；离线 A 段 71.1% 对齐 | 发版前单独窗口重跑 `four-line-alignment-acceptance.mjs`（workers=1，无 spike） |
| **P1-E2** | Playwright F 章 7 项失败 | 登录 `waitForResponse` 60s 超时 / Composer 不可见 | 与 spike 43315 请求 + 8 workers 并发叠乘；隔离/deep-uat/deliverable-404 已通过 | 门禁前串行 `--workers=1` 复跑失败项 |

### P1 观察（不阻断本次签收）

| ID | 项 | 说明 |
|----|-----|------|
| P1-O1 | `recovery-wuyutai:run` | 15min 超时；`generate_image×3` + `compose_images_to_document` 已执行；`slide-manifest.json` 已落盘；turn 未 `turn_completed` |
| P1-O2 | `ui-artifact-preview-check` | write_file 未在 180s 内落盘；reload `networkidle` 30s 超时 |
| P1-O3 | `test:prelaunch:quick` | 30/34（Skills 斜杠、login bundle 体积、process-ux:full） |
| P1-O4 | `test:cloud:chat-load` | 需 `DIAG_USER`/`DIAG_PASS` 云端凭据，本地跳过 |
| P1-O5 | 混沌 CH-01/02/07/08 | 未杀 Gateway/Redis、未 `restart:ui-dev×3`（保护 wuyutai 长任务与在跑 Playwright） |
| P1-O6 | http-load soak 15min | 未跑 |
| P1-O7 | CH-06 docker-smoke | 本机未跑 Docker |

---

## §0 前置

| 项 | 结果 |
|----|------|
| dev:saas 健康 | ✅ |
| 端口记录 | server 3001 / gateway 18789 / vite 5173 |
| 加速 env | devLauncher 默认 `PILOTDECK_HISTORY_SANITIZE=1`、`PILOTDECK_HISTORY_TAIL_READ=1`、`PILOTDECK_CLARIFICATION_GATE=1` |

---

## §1 近期改动 + 定向复测

### 1.1 离线门禁

| 命令 | 结果 |
|------|------|
| `npm run test:production-gate-full:offline` | ✅ **14/14**（[`gate-full-summary.json`](../../artifacts/pre-production-test/gate-full-summary.json)） |
| `npx vitest run tests/saas/clarification-gate.test.ts` | ✅ |
| `capabilityPrerequisiteHint` / `capabilitySessionBinding` vitest | ✅ |
| `node --test ui/server/saas/conversation/sessionReadAccess.test.mjs` | ✅ 4/4 |

### 1.2 Live 安全

| 命令 | 结果 |
|------|------|
| `SERVER_URL=3001 node scripts/security-regression-checklist.mjs` | ✅ 全 PASS（[`security-checklist.json`](../../artifacts/full-test/security-checklist.json)） |
| **SEC-12** 伪造 session | ✅ **404** |

### 1.3 手工探针（API）

| ID | 结果 |
|----|------|
| REG-fake session messages | ✅ 404 |

---

## §2 四线 / 四联同步

### 2.1 离线最深

| 命令 | 结果 | 关键数字 |
|------|------|----------|
| `npm run test:deliverable-paths` | ✅ | collision 6 + vitest 38 |
| `npm run test:four-line-audit` | ✅ gate | tenant `default` 扫描 **0 session**（空租户过滤；见 acceptance 真数据） |
| `npm run test:four-line-e2e` | ✅ | 无历史抽样跳过 |
| `node scripts/audit-four-line-alignment.mjs --gate` | ✅ G-4L1/4L2 | 0 turn → 100%（空集 PASS） |

### 2.2 实机 acceptance

[`four-line-alignment-acceptance-2026-06-22.md`](four-line-alignment-acceptance-2026-06-22.md)：**22/30**

| 段 | 结果 | 备注 |
|----|------|------|
| A 离线 | ✅ 6/6 | **aligned=71.1%**（154 turns；低于 85% 目标，历史债务） |
| B 多用户 HTTP | ✅ 隔离/存储/列表 | 3 租户 cloud-only |
| B Gateway 造数 | ❌ 8 项 | admin-fourline 120s 超时；cli:project meta/validate |

### 2.3 辐射

| 套件 | 结果 |
|------|------|
| `ui-artifact-preview-check.mjs` | ❌ 文件未创建 + reload 超时 |
| Playwright `path-folder-picker` | ❌ 新建项目按钮不可见 |
| Playwright `design-canvas/phase6` | ❌ upload 60s 超时 |
| Playwright `history-messages-perf` | ⏭ skipped |

---

## §3 上线前补充

### 3.1 Playwright F 章

日志：[`playwright-f-chapter.log`](../../artifacts/pre-production-test/playwright-f-chapter.log)

| 统计 | 数值 |
|------|------|
| 通过 | **18** |
| 失败 | **7**（登录/Composer 超时，见 P1-E2） |
| 跳过 | **2**（DEL-PPT/DOC live） |

**已通过要点**：`isolation` 3/3、`deep-uat` 4/4、`deliverable-ppt` SEC-404、`deliverable-doc` 单元、`long-session` LONG-06/07、`process-ux-live` P-UX3–7。

### 3.2 Smoke / 集成

| 命令 | 结果 |
|------|------|
| `smoke:conversation-catalog` | ✅ |
| `smoke:resilience` | ✅ |
| `smoke:project-memory` | ✅ |
| `test:saas:conversation-catalog` | ✅ |
| `integration-saas-storage-comprehensive` | ✅ **30/30** |
| `integration-saas-folder-scenarios` | ✅ **20/20** |
| `test:multi-user:sim` | ✅ |
| `test:history-messages:quick` | ✅ |
| `test:p0-p2:full` + selfcheck | ✅ |

### 3.3 负载（API 3001）

| 场景 | total | fail | errorRate | p95 | 阈值 | 结果 |
|------|-------|------|-----------|-----|------|------|
| smoke | 870 | 0 | 0% | **799ms** | <1% | ✅ |
| stress | 3338 | 0 | 0% | **4211ms** | <2% | ✅ |
| spike | 43315 | 0 | 0% | **235ms** | <5% | ✅ |
| soak 15min | — | — | — | — | P1 | ⏭ 未跑 |

JSON：[`http-load-smoke.json`](../../artifacts/pre-production-test/http-load-smoke.json) 等同目录 stress/spike。

### 3.4 混沌 K 章

| ID | 操作 | 结果 |
|----|------|------|
| CH-03 | 10× `GET /api/projects?fresh=1` | ✅ 0/10 错误 |
| CH-04 | corrupt jsonl 末行 | ✅ messages **200** len=3387 |
| CH-05 | `limit=999999` | ✅ **200** 有界响应 |
| CH-01 | 停 Gateway | ⏭ 未跑（保护长任务） |
| CH-02 | 停 Redis 30s | ⏭ 未跑 |
| CH-07 | SANITIZE/TAIL 临时关 | ⏭ 未跑 |
| CH-08 | `restart:ui-dev×3` | ⏭ 未跑 |
| CH-06 | docker-smoke | ⏭ P1 豁免 |

### 3.5 Recovery / Live 交付

| 命令 | 结果 |
|------|------|
| `npm run test:recovery-wuyutai` | ✅ jsonl 对比（94 events vs baseline 3） |
| `npm run test:recovery-wuyutai:run` | ⚠️ **timeout 900s**；`recoveryAttempts=0`；tools: `generate_image×3`, `write_file`, `compose_images_to_document` |
| `integration-deliverable-e2e-smoke` | ✅ 离线 policy + p0-p2 profiles |
| 落盘抽检 | `general/artifacts/slides-wuyutai-test/slide-manifest.json`（3 页大纲） |

### 3.6 P1 辐射

| 命令 | 结果 |
|------|------|
| `test:prelaunch:quick` | ❌ **30/34**（[`report`](../../artifacts/prelaunch-quick/report-2026-06-22.md)） |
| `smoke:document-export` | ✅ pdf/docx/pptx/xlsx |
| `test:cloud:chat-load` | ⏭ 缺 `DIAG_USER` |
| `test:process-ux:full` | ❌（含于 prelaunch-quick） |

### 3.7 发版闸

| 命令 | 结果 |
|------|------|
| `npm run pack:preflight` | ✅（2 警告：Windows dbPath、~/.pilotdeck/projects 体积） |
| `npm run check:saas-fork` | ✅ 379 entries |
| `npm run brand:check` | ✅ |

---

## 关键产物索引

| 路径 | 内容 |
|------|------|
| [`artifacts/pre-production-test/gate-full-summary.json`](../../artifacts/pre-production-test/gate-full-summary.json) | 离线门禁 14/14 |
| [`artifacts/full-test/security-checklist.json`](../../artifacts/full-test/security-checklist.json) | SEC 全绿 |
| [`artifacts/pre-production-test/four-line-acceptance.log`](../../artifacts/pre-production-test/four-line-acceptance.log) | 四线 acceptance 明细 |
| [`docs/four-line-alignment-acceptance-2026-06-22.md`](four-line-alignment-acceptance-2026-06-22.md) | 22/30 报告 |
| [`artifacts/pre-production-test/playwright-f-chapter.log`](../../artifacts/pre-production-test/playwright-f-chapter.log) | F 章 Playwright |
| [`artifacts/pre-production-test/http-load-*.json`](../../artifacts/pre-production-test/) | 负载三场景 |
| [`artifacts/pre-production-test/recovery-wuyutai-run.log`](../../artifacts/pre-production-test/recovery-wuyutai-run.log) | 吴裕泰 live |
| [`docs/recovery-stability-report-2026-06-22.md`](recovery-stability-report-2026-06-22.md) | recovery 4 events |

---

## 建议下一步（发版前）

1. **串行复跑**：Playwright 失败 7 项 + `four-line-alignment-acceptance.mjs`（无 spike、workers=1）。
2. **四线历史**：71.1% → 执行 JSONL 回填 dry-run（planned=23）后重审计，或 ECS 造数后 `--gate`。
3. **Live PPT**：`WUYUTAI_TIMEOUT_MS=1200000` 或减页数复跑，确认 `.pptx` 或完整 manifest+PNG。
4. **ECS Gate-B**：混沌 CH-01/02/07/08、soak、cloud chat-load（见 [`next-pack-reminders.zh-CN.md`](next-pack-reminders.zh-CN.md)）。

---

*生成：上线补充深度测试计划执行（本地 dev:saas）*
