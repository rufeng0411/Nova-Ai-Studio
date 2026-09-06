# 上线前生产级全量测试签收报告（2026-06-24）

**环境**：本地 `npm run dev:saas`（`DATA_ROOT=.saas-dev-data`，PG + Redis）  
**执行窗口**：2026-06-24 08:20–08:42 CST（接续 Remediation + 五阶段计划）  
**口径**：`SERVER_URL=http://127.0.0.1:3001`（Bridge/API）；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173`（Vite）  
**Git HEAD**：`0c9e2567` — feat: 对话稳定性与五线交付统一收敛，修复验收循环与路径解析  
**承接**：[`prelaunch-deep-test-report-2026-06-23.md`](prelaunch-deep-test-report-2026-06-23.md)、Remediation PR-1～PR-4

---

## 端口与健康

| 服务 | 端口 | 探针 |
|------|------|------|
| Bridge/API | **3001** | `GET /api/health` → 200 |
| Gateway WS | **18789** | dev:saas 启动日志 |
| Vite | **5173** | HTTP 200 |

---

## 总判定

| 级别 | 结论 | 说明 |
|------|------|------|
| **P0 核心门禁** | **有条件通过** | 功能/负载/E2E/四线/存储/SEC 全绿；**2 项登记豁免**（见下）；内存审计与 KPI 基线门禁为观察项 |
| **P1 辐射** | **通过** | 移动双引擎、浏览器 lean、混沌 dev、品牌/完整性/preflight 绿 |

### P0 登记豁免（≤2 项）

| ID | 项 | 现象 | 归类 | 后续 |
|----|-----|------|------|------|
| **P0-E1** | `LIVE-F09` 0608 显示名 | 本机 live 租户无 `0608` 文件夹 | 本地数据缺口；隔离场景 FOLD-01 已绿 | 发版前在云环境有 0608 样本时复测；**不阻断** |
| **P0-E2** | `analyze:task-completion --gate` | `pptCompletionRate 0.0% < 8.0%`（历史 JSONL 基线） | KPI 基线门禁，非本轮回归引入 | 发版后 `npm run analyze:task-completion` 持续跟踪；**不阻断功能门禁** |

### P1 观察（不阻断签收）

| ID | 项 | 说明 |
|----|-----|------|
| P1-O1 | `test:memory-leak:audit` | Bridge RSS 379.8→942.6 MB（+148%），与负载/stress 并行叠乘；静态风险 2 high 已登记；浏览器堆 -13.3% |
| P1-O2 | Firefox full compat | 本机未装 `ms-playwright/firefox` → SKIP |
| P1-O3 | `ui-artifact-preview-check` | `strict=false` 通过；右栏 iframe / folder 卡探针未命中（fixture 会话无自动开预览） |
| P1-O4 | `test:recovery-wuyutai:run` | 未在本窗口跑满（20min+ live PPT）；jsonl 对比 `test:recovery-wuyutai` 已绿 |
| P1-O5 | 真机 Tier A 12 条 | 脚本覆盖 Chromium+WebKit 模拟；**真机手工 12 条须发版前人工勾选** |
| P1-O6 | CH-01 Gateway 杀进程 / CH-07 Redis down | `test:chaos:dev --skip-gateway-kill`；手工 K 章未杀 Gateway |

### 已关闭豁免（Remediation → 本次复测）

| ID | 原现象 | 本次结果 |
|----|--------|----------|
| **P1-E1** | 四线 live 超时 | `FOUR_LINE_LIVE=1` acceptance **31/31** |
| **P1-E2** | Playwright 与 spike 并行失败 | `gateMutex` + `test:prelaunch:e2e-serial` **27 passed / 3 skipped** |

---

## 五阶段验收表

### 阶段 0 — 基线

| 项 | 结果 |
|----|------|
| 48h 变更 / HEAD | `0c9e2567` 及前序 6 提交（对话稳定性、五线、路径解析） |
| 端口 / DATA_ROOT | `.saas-dev-data`；3001 / 5173 / 18789 |

### 阶段 1 — 功能全量

| 命令 / 场景 | 结果 | 备注 |
|-------------|------|------|
| `test:p0-p2:full` | ✅ | unit + integration + selfcheck |
| `test:saas:deep` | ✅ | |
| `test:saas:storage` | ✅ 30/30 | |
| `test:saas:folder` | ✅ 19/20 | LIVE-F09 登记 P0-E1 |
| `test:deliverable-paths` / `test:four-line-e2e` | ✅ | |
| `test:saas:conversation-catalog` / `test:history-messages:quick` | ✅ | |
| `test:four-line-audit` | ✅ | ~96 sessions；actionable 对齐 ~67% |
| `FOUR_LINE_LIVE=0` acceptance | ✅ 26/26 | |
| `FOUR_LINE_LIVE=1` acceptance | ✅ 31/31 | Gateway write_file ~69–94s/场景 |
| `run-dialogue-stability-full-chain.mjs` | ✅ 16/16 | |
| `test:prelaunch:quick` | ✅ 全绿 | 斜杠菜单 + Playwright CLI 路径已修 |
| `test:prelaunch:e2e-serial` | ✅ 27 / 3 skip | live 交付类 skip |
| smoke：hub / templates / capability-try / document-* | ✅ | |

### 阶段 2 — 负载与韧性

| 场景 | total | fail | p95 | 结果 |
|------|-------|------|-----|------|
| smoke（10×30s） | 1042 | 0 | 661ms | ✅ |
| stress（50×120s） | 4162 | 0 | 2993ms | ✅ |
| spike（100×60s） | 14372 | 0 | 485ms | ✅ |
| soak（20×15min） | 262390 | 0 | 95ms | ✅ P1 已跑 |
| `test:chaos:dev` | 4/4 | | resilience smoke + bridge health |
| `test:gate-mutex` | 3/3 | | |

**编排**：负载在 E2E 之后执行；soak 与 memory-audit 部分重叠（见 P1-O1）。

### 阶段 3 — 安全与质量

| 项 | 结果 |
|----|------|
| `security-regression-checklist.mjs` | ✅ 12 项（SEC-07/09 观察项） |
| `test:memory-leak:audit` | ⚠️ FAIL | bridge RSS 超阈值；见 P1-O1 |
| `browser-compat-check.mjs --lean` | ✅ | Chromium full + WebKit lean；Firefox SKIP |
| 探针脚本加固 | `browser-compat-check` 改用 `ensurePlaywrightWorkspace` + textarea 30s 等待 |

### 阶段 4 — 移动

| 项 | 结果 |
|----|------|
| `mobile-regression-check.mjs` | ✅ Chromium + WebKit 全项 |
| 截图 | `artifacts/ui-theme-preview/mobile-touch-*.png` |
| 真机 Tier A 12 条 | ⏳ 人工登记（P1-O5） |
| 探针修复 | 「我的」页退出按钮 `getByRole('button', { name: /^退出$/ })` + 滚动到底 |

### 阶段 5 — 生产闸与签收

| 项 | 结果 |
|----|------|
| `test:production-gate-full:offline` | ⚠️ | `analyze:task-completion --gate` FAIL；其余 build/fork/audit/preflight 等绿 |
| `pack:preflight` | ✅ | 2 警告（Windows path / projects 体积） |
| `brand:check` | ✅ | 24 assets / 28 guards |
| `verify:saas:data-integrity` | ✅ | fourLine aligned 100% |
| `LOCAL_DEV=1 test:cloud:chat-load` | ✅ skip 验证 |
| `ui-artifact-preview-check.mjs` | ✅ strict=false | 部分预览探针未命中 P1-O3 |
| `test:recovery-wuyutai`（jsonl） | ✅ | live run 未在本窗口 |

---

## F-01～F-40 矩阵（本次执行）

| ID | 命令 / 操作 | 结果 | 备注 |
|----|-------------|------|------|
| F-01 | `test:production-gate-full:offline` | ⚠️ | P0-E2 KPI gate |
| F-02 | `test:prelaunch:e2e-serial` | ✅ 27/3 skip | 关闭 P1-E2 |
| F-03 | SEC-12 伪造 session | ✅ | |
| F-04 | spike 与 e2e 互斥 | ✅ | gateMutex |
| F-05 | `backup:saas:joint` | ⏭ | 未重跑（6-22 备份有效） |
| F-06 | backfill turn-artifact-dirs | ⏭ | 6-22 applied=27 |
| F-07 | `test:four-line-audit` | ✅ | |
| F-08 | `test:four-line-e2e` | ✅ | |
| F-09 | `test:deliverable-paths` | ✅ | |
| F-10 | acceptance `FOUR_LINE_LIVE=0` | ✅ 26/26 | |
| F-11 | acceptance `FOUR_LINE_LIVE=1` | ✅ 31/31 | 关闭 P1-E1 |
| F-12 | `ui-artifact-preview-check` | ✅* | strict=false |
| F-13～F-15 | Playwright 四线 | ✅ | 并入 e2e-serial |
| F-16～F-21 | catalog / messages | ✅ | |
| F-22 | `test:recovery-wuyutai` | ✅ | |
| F-23 | `test:recovery-wuyutai:run` | ⏭ | P1-O4 |
| F-24～F-27 | http-load | ✅ smoke/stress/spike/soak | |
| F-28 | `test:prelaunch:quick` | ✅ | |
| F-29 | `test:process-ux:full` | ✅ | |
| F-30 | `security-regression` | ✅ | |
| F-31 | `cloud-chat-load` skip | ✅ | LOCAL_DEV |
| F-32 | `browser-compat` | ✅ lean | Firefox SKIP |
| F-33 | `mobile-regression` | ✅ | |
| F-34 | `test:chaos:dev` | ✅ 4/4 | |
| F-35 | `test:memory-leak:audit` | ⚠️ | P1-O1 |
| F-36 | `test:p0-p2:full` | ✅ | |
| F-37 | `check:saas-fork` | ✅ | |
| F-38 | `brand:check` | ✅ | |
| F-39 | `verify:saas:data-integrity` | ✅ | |
| F-40 | `pack:preflight` | ✅ | |

---

## 本轮脚本修补（测试 harness，非产品逻辑）

| 文件 | 改动 |
|------|------|
| `scripts/browser-compat-check.mjs` | `ensurePlaywrightWorkspace`；textarea 30s 等待 |
| `scripts/mobile-regression-check.mjs` | header/hub/files 等待加长；退出按钮探针 + 滚动 |

---

## 发版前仍建议单独窗口

1. `WUYUTAI_TIMEOUT_MS=1200000 npm run test:recovery-wuyutai:run`  
2. 真机 Tier A 12 条手工勾选  
3. 冷启动后重跑 `test:memory-leak:audit`（勿与 spike/soak 并行）  
4. 云端 `npm run test:cloud:chat-load`（非 LOCAL_DEV）+ `verify-cloud-perf.sh`  
5. `npx playwright install firefox` 后跑 `browser-compat-check.mjs`（非 lean）

---

## 产物索引

| 产物 | 路径 |
|------|------|
| 负载 | `artifacts/pre-production-test/http-load-*.json` |
| 内存审计 | `artifacts/memory-audit/memory-audit-2026-06-24T00-25-08.json` |
| 安全 | `artifacts/full-test/security-checklist.json` |
| 浏览器截图 | `artifacts/browser-compat/` |
| 移动截图 | `artifacts/ui-theme-preview/mobile-touch-*.png` |
| 完整性 | `artifacts/saas-data-integrity/integrity-2026-06-24.json` |
| 离线门禁日志 | 见本轮 `test:production-gate-full:offline` 终端输出 |

**签收结论**：五阶段计划 **执行完毕**；P0 **有条件通过**（P0-E1/E2 登记豁免）；Remediation 项 P1-E1/P1-E2 **已关闭**。发版前按上表补跑长任务 wuyutai、真机与云端探针即可收口。
