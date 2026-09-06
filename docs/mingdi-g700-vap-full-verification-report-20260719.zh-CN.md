# 鸣镝 G700 + VAP 全量验收报告（2026-07-19）

**生成时间**：2026-07-19T09:21:31+08:00  
**执行命令**：`npm run test:vap-g700:full-verification`  
**总耗时**：约 27 分钟（含 Gateway 三场景实机 ~26 分钟）

---

## Executive 结论

| 维度 | 结论 |
|------|------|
| **离线结构门禁** | **通过** — 11 案回放、VAP 28 单测、官方素材 81 测、四线导出 46/46、fork 666 条 |
| **Playwright 问题案例复测** | **通过** — 7 passed / 6 skipped（实机 E2E 需 `DELIVERABLE_SUMMARY_E2E=1`） |
| **Bridge browse** | **通过** — wedged=0，readyP95=6ms @7990 |
| **Gateway VAP 三场景实机** | **部分通过** — 1/3 KPI 绿；**未调用 `resolve_session_visual_assets`** |
| **生产整包 GO** | **否** |

**总判定：`NO_PRODUCTION_GO`（结构 `STRUCTURAL_PASS_LIVE_PENDING`）**

机器可读汇总：[`artifacts/mingdi-g700-production-acceptance/vap-g700-full-verification-report.json`](../artifacts/mingdi-g700-production-acceptance/vap-g700-full-verification-report.json)

---

## 1. 验证矩阵（全程未中断）

### 1.1 离线结构门禁 — 全绿

| 测试 | 结果 | 要点 |
|------|------|------|
| `test:mingdi-g700:unit` | PASS | 14/14 |
| `test:mingdi-g700:replay` | PASS | 11/11 历史问题标签稳定复现 |
| `test:export-four-line-parity` | PASS | 46/46 |
| `check:saas-fork` | PASS | 666 manifest |
| `audit:capability-scope` | PASS | 4/4 Hub slug |

### 1.2 VAP / 通用配图发现 — 全绿

| 测试 | 结果 | 要点 |
|------|------|------|
| `test:visual-asset-platform:acceptance` | PASS | 28 vitest + 五案 replay gate |
| `test:official-media:acceptance` | PASS | 81 pass；`official-source-roots` valid roots=0（CI 通用空表） |
| 五案 `officialMediaRequirement` replay | PASS | 4/4 官方案编译为 `official_only` + `forbidGenerateImage` |

**说明**：离线 replay 验证的是**策略编译与结构**，不等于实机已走 VAP 管线。

### 1.3 Playwright 成果/四线复测 — 全绿

| Spec | 结果 |
|------|------|
| `ui/e2e/prelaunch/deliverable-five-entry.spec.ts` | PASS |
| `ui/e2e/saas/deliverable-preview-click.spec.ts` | PASS |
| `ui/e2e/saas/deliverable-summary-sdm-regression.spec.ts` | 7 pass / 6 skip |

Playwright 环境：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081`，`SERVER_URL=http://127.0.0.1:7990`  
日志：[`artifacts/mingdi-g700-production-acceptance/verify-playwright-deliverable-regression.log`](../artifacts/mingdi-g700-production-acceptance/verify-playwright-deliverable-regression.log)

---

## 2. Gateway 多场景自动配图/生图实机（0719 三案）

**环境**：`dev:saas` Bridge **7990** / Gateway **18789** / Vite **8081**  
**对比上次（06:56 批次）**：子秒空转已消除；本轮三案均有真实 LLM/工具调用（6–11 分钟/案）。

| 场景 | 耗时 | 状态 | 关键工具 | 主要问题 |
|------|-----:|------|----------|----------|
| **nova-slides-official-20260719** | 381s | **FAIL** | `generate_image×8`、`fetch_page_images×1`、无 VAP | **官方案仍生图 8 次**（`forbidden_generate_image=1`）；未调用 `resolve_session_visual_assets` |
| **html-demo-official-20260719** | 516s | **FAIL** | `fetch_page_images×1`、`write_file×2` | `acceptance=needs_repair`（missing/type_mismatch）；无 `assets/raw` 本地化链 |
| **campaign-official-20260719** | 689s | **KPI 绿** | `fetch_page_images×1`、`write_file×7` | 无 `generate_image`；但成果路径无 `assets/raw|prepared`，配图仍靠散落 fetch 非 VAP manifest |

### 2.1 Nova 8 页幻灯（最严重）

- 产出：`slide-01..08.png` + `slide-manifest.json`（路径 `artifacts/task-20260719-558cc120/`）
- **违规**：`generate_image` **8 次** — 与用户「图和资料要来自官网」及 `forbidGenerateImage` 冲突
- **缺失**：`resolve_session_visual_assets` / `discover_visual_assets` / `prepare_visual_asset` **均为 0**
- **推断**：VAP 在 dev 为 `shadow`，Orchestrator 写 manifest 但未 enforce 拦截生图；模型仍走旧 `generate_image` 路径

### 2.2 HTML 演示

- 产出：`index.html`、`presentation.pptx`、`slide-manifest.json`
- 验收：`needs_repair`（missing + type_mismatch）
- **无** `forbidden_generate_image`（未调用生图工具）
- **无** VAP 工具；仅 1 次 `fetch_page_images`

### 2.3 Campaign 全案

- 产出：6 份阶段 md + `campaign-full-report.html`
- KPI：无 forbidden / missing_localized 计数（因 `fetch_page_images≥1` 且未强制检查 `assets/raw` 落盘）
- **结构绿、质量待查**：Campaign 以文本/HTML 为主，官网配图未进 VAP manifest

---

## 3. 与历史问题对照

| 历史问题（evaluation §3） | 本轮 | 说明 |
|---------------------------|------|------|
| CLI harness 子秒空转 | **已修复** | 三案 380–689s，有 toolCalls |
| 无 LLM/无工具 | **已修复** | read_skill / web_search / write_file 正常 |
| 官方案 SVG 假绿 | **未复现** | 未写 SVG 占位冒充官图 |
| 官方案仍 `generate_image` | **仍复现** | Nova 案 8 次生图 — **P0 阻塞** |
| VAP Turn0 自动搜图 | **未生效** | 三案均无 `resolve_session_visual_assets` |
| `official-source-roots` 空 | CI 仍空 | dev 应经 `PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH` 指向 g700-canary |

---

## 4. Bridge 稳定性（抽样）

| 项 | 结果 |
|----|------|
| `test:bridge-stability:browse` | PASS — wedged=0，readyP95=6ms |

（本轮未重跑 smoke/load/soak；历史 06:48 批次 load/soak 仍 FAIL，不阻塞本报告结构结论。）

---

## 5. 阻塞项与建议（待你下令）

1. **enforce canary**：对 `nova-ppt-aesthetic-slides` / `html-ppt-skill` / `brand-campaign-full` 开 `PILOTDECK_GOAL_QUALITY_CONTRACT=enforce` + `PILOTDECK_OFFICIAL_MEDIA_V2=enforce`，验证 `generate_image` 硬拦与 VAP 优先。
2. **Orchestrator 可观测**：shadow 下须 telemetry 证明 Phase-A/B 已跑；实机 jsonl 查 `<visual-asset-manifest>` 注入与 manifest 落盘。
3. **Nova 案回归**：enforce 后重跑 `nova-slides-official-20260719`，KPI 要求 `forbidden_generate_image=0` 且 `assets/raw` ≥1。
4. **运维**：生产灌根域 `npm run import:official-source-roots:g700` 或设置 `PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH`。
5. **Playwright 实机层**：需 `DELIVERABLE_SUMMARY_E2E=1` 跑满莫德里奇 6 skip 项（可选下一批）。

---

## 6. 产物索引

| 产物 | 路径 |
|------|------|
| 本报告 | `docs/mingdi-g700-vap-full-verification-report-20260719.zh-CN.md` |
| JSON 汇总 | `artifacts/mingdi-g700-production-acceptance/vap-g700-full-verification-report.json` |
| 全程日志 | `artifacts/mingdi-g700-production-acceptance/vap-full-verification-run.log` |
| Live Gateway 明细 | `artifacts/mingdi-g700-production-acceptance/live-p0-report.json` |
| VAP 五案 replay | `artifacts/mingdi-g700-vap-replay/five-case-replay-report.json` |
| 编排脚本 | `scripts/run-vap-g700-full-verification.mjs` |
| 一键复跑 | `npm run test:vap-g700:full-verification` |

---

**报告结束 — 等待你的下一步命令。**
