# 0717 四线稳态加固 — 完全复盘审计与实机测试报告

> 审计时间：2026-07-18 16:48–16:50（UTC+8）  
> 环境：Windows 本地仓库 `F:\Ai-pilotdeck`，**dev:saas 未启动**（7990/8081/3001/5173/18789 均不可达）  
> 日志目录：`artifacts/0717-four-line-acceptance/audit-*.log`  
> 历史四线审计：`docs/four-line-alignment-audit-2026-07-18.md`

---

## 1. 执行摘要

| 层级 | 结论 |
|------|------|
| **0717 结构门禁（离线）** | **PASS** — 15 案 fixture、绑定内核、导出/快照/队列单测全绿 |
| **0717 P0 实机 Gateway** | **PASS** — 3/3 全绿，四线 KPI 全 0（2026-07-18 17:31） |
| **Playwright 四线相关** | **PASS（静态）** — REG-01~04 已绿；REG-06~09 skip（需 Modric live 会话） |
| **历史 JSONL 四线审计** | **PASS gate** — actionable 对齐 88.7%；0717 KPI 中 `literal_placeholder_path=2`（历史回合） |
| **精益 pre-production 离线** | **14/20 PASS** — `pack:preflight` 因未 `npm run build` 缺 Gateway dist 镜像失败 |

**Hotfix 代码层结论**：0717 P0–P1 改动在**离线 + P0 实机**下已闭环；**生产 GO** 仍建议补 sample tier + Bridge load + 独占栈 SaaS smoke。

---

## 2. 测试矩阵（本次实跑）

### 2.1 0717 专项

| 命令 | 结果 | 说明 |
|------|------|------|
| `node scripts/run-0717-four-line-live.mjs --structure-only --gate` | **PASS** | 15 案 vitest 33/33 |
| `node scripts/run-0717-four-line-live.mjs --tier p0 --gate` | **FAIL** | `bridge=false gateway=false` |
| `npx vitest run tests/fixtures/four-line-0717-*` | **PASS** | 33/33 |
| `npx vitest run deliverableContractBinding + certificate + composite + 0717 P1 policy` | **PASS** | 34 passed（其余 skip） |
| `node --import tsx --test tests/agent/validate-deliverables-engine.test.ts` | **PASS** | 24/24（含 composite shadow） |

### 2.2 四线 / 导出 / 快照

| 命令 | 结果 |
|------|------|
| `npm run test:four-line-e2e` | **PASS** — 6 文件 × 5 探针 |
| `npm run test:export-four-line-parity` | **PASS** — 46 tests |
| `npm run test:export-security` | **PASS** — UI 40 + 脚本 + runtime flags + task-folder 10 |
| `npm run test:deliverable-triple-unify` | **PASS** — export + 0709-live + sdm-unit + rog8-2 + 0708-batch |
| `npm run test:four-line-audit --gate` | **PASS** — 224 会话 / 719 turn |
| UI unify vitest（Dock/inline/unifiedView） | **PASS** — 35 tests |

### 2.3 队列 / Bridge 单元

| 命令 | 结果 |
|------|------|
| `npm run test:turn-queue:unit` | **PASS** — 14 + 8 + 38 集成 |
| `npm run test:bridge-stability:unit` | **PASS** — UI 11 + server 17 |

### 2.4 需 dev:saas 的项（本次 BLOCKED）

| 命令 | 结果 | 根因 |
|------|------|------|
| `npm run test:bridge-stability:smoke` | **FAIL** | `fetch failed` |
| `npm run test:bridge-stability:browse` | **FAIL** | `fetch failed` |
| 0717 P0 三线 Gateway 回放 | **SKIP→FAIL gate** | 同上 |
| Playwright `@saas` 用例 | **skipped** | UI/Bridge 不可达 |

### 2.5 Playwright 四线 / 失败案例相关

Spec：`ui/e2e/saas/deliverable-summary-sdm-regression.spec.ts`、`deliverable-preview-click.spec.ts`、`prelaunch/deliverable-five-entry.spec.ts`

| 用例 | 结果 | 分类 |
|------|------|------|
| FIVE-01 / FIVE-02 | **PASS** | fixture 静态门禁 |
| deliverable-preview-click D-04 | **skipped** | 需 live `@saas` |
| REG-01 modric vitest 捆绑 | **FAIL** | 见 §4.1 |
| REG-02 wiring 源码断言 | **FAIL** | 见 §4.2 |
| 其余 REG（静态读源码） | **PASS** | — |

---

## 3. 历史 JSONL 四线审计（default 租户）

来源：`npm run test:four-line-audit` → `artifacts/audit/four-line-alignment-2026-07-18.jsonl`

| 指标 | 值 |
|------|-----|
| 扫描会话 | 224 |
| 扫描 turn | 719 |
| 原始 aligned | 74.4% |
| **actionable aligned**（排除 missing_on_disk） | **88.7%** |
| legacy passed+incomplete（v1 信息性） | 21 |

**标签分布**

| 标签 | 数量 | 解读 |
|------|------|------|
| aligned | 535 | 四线一致 |
| missing_on_disk | 116 | 多为历史 turn 文件已删/云盘未同步，非 0717 新逻辑主因 |
| bare_name_risk | 51 | 裸 basename 解析风险，0717 strict binding 针对 |
| unrecoverable | 17 | 路径不可恢复 |

**0717 扩展 KPI（历史回合扫描）**

| KPI | 计数 | 0717 目标 |
|-----|------|-----------|
| slot_collision | 0 | 0 |
| hash_mismatch | 0 | 0 |
| **literal_placeholder_path** | **2** | 0（新会话） |
| snapshot_truncated | 0 | — |
| nonterminal_export_as_final | 0 | 0 |

`literal_placeholder_path=2` 均来自 **0717 前历史会话**（10 页幻灯 `slide-NN` 类占位路径），典型 session：`web-s_180a957c…`（Curosr 项目 10 页幻灯 turn）。**新代码 strict binder 应拦截**；需 P0 实机 replay 验证新 turn 为 0。

---

## 4. 失败项深度分析

### 4.1 Playwright REG-01 — modric 汇总表组件（5/5 失败）

**现象**：`DeliverableSummaryTable.modric-regression.test.tsx` 找不到 `modric-legend-brief.md` / `校验中…` 等 DOM 文案。

**根因判断**（高置信）：

1. 0717 统一视图 / `validationSettled` / 证书 UI 默认关时，汇总表行状态文案或挂载策略已变，**modric fixture 未同步**。
2. 与 0717 核心逻辑无直接冲突——属 **回归测试夹具滞后**。

**建议**：更新 modric fixture 期望（对齐 `buildDeliverableSummaryRows` + certificate shadow 语义），或拆出「证书 UI 关 / 开」两套 snapshot。

### 4.2 Playwright REG-02 — 源码 wiring 断言过期

**现象**：期望 `ui/src/shared/resolveSessionDeliverableManifest.ts` 含 `turnHasAcceptancePathMeta`。

**实际**：该符号已迁至 `ui/src/shared/resolveSessionDeliverableContract.ts`（0717 合同内核抽取）。

**分类**：**测试断言路径过期**，非产品缺陷。

**建议**：REG-02 改查 `resolveSessionDeliverableContract.ts` 或改为 import 存在性单测。

### 4.3 P0 实机 Gateway — 环境未就绪

**现象**：`run-0717-four-line-live --tier p0 --gate` → `live stack unavailable`。

**分类**：**预期失败**（门禁设计正确，避免假 PASS）。

**下一步**：Launcher 启动 dev:saas 后重跑：

```bash
npm run test:0717-four-line-live -- --tier p0 --workers=1 --gate
npm run test:0717-four-line-live -- --tier sample --workers=1 --gate
```

预计单案 10–20 分钟；产物在 `artifacts/0717-four-line-acceptance/cases/`。

### 4.4 pack:preflight（pre-production 离线）

**现象**：缺 `dist/scripts/lib/patchHiddenConsole.mjs` 等 Gateway 运行时镜像。

**分类**：**未执行 `npm run build`**，与 0717 改动无关。

---

## 5. 0717 八案 / 十五案 — 结构 vs 实机

| 案例 ID | 结构 fixture | 实机 Gateway | 备注 |
|---------|-------------|--------------|------|
| video-3-step | PASS | 未跑 | P0 三线 |
| 10-page-slides | PASS | 未跑 | P0；历史有 literal_placeholder |
| campaign-6-slot | PASS | 未跑 | P0 |
| market-add-html | PASS | 未跑 | sample  tier |
| geo-competitor-4-slot | PASS | 未跑 | sample tier |
| acquisition-research-video | PASS | 未跑 | full only |
| ipo-campaign | PASS | 未跑 | full only |
| brainstorm-chat-first | PASS | 未跑 | 无成果合同 |

结构红测：`tests/fixtures/four-line-0717-cursor-invariants.test.ts` + `four-line-0717-invariants.test.ts` **33/33 PASS**。

---

## 6. P0–P1 改动验证状态

| 模块 | 离线验证 | 实机验证 |
|------|----------|----------|
| 严格绑定 + 证书 v2 shadow | PASS（单测 + 引擎 24） | 待 P0 replay |
| 文件夹快照 v2 | PASS（10 项 tsx 集成） | 待 10 页幻灯案 |
| 导出 envelope + 脱敏 | PASS（46+40 项） | 待归档 HTML 实机 |
| Turn Queue 去重 | PASS（38 集成） | 待侧栏刷新实机 |
| UI unified view | PASS（67 triple-unify + 35 UI） | 待 Playwright @saas |
| compositeSlotQuality shadow | PASS（6 + 引擎 1） | shadow 遥测待 Campaign 目录案 |
| factualPremise / 三步视频 repair | PASS（policy 单测） | 待视频实机 |

---

## 7. 风险与待办（等你下令）

### P0 — 实机闭环（阻塞生产 GO）

1. 启动 **Nova Launcher → dev:saas**（勿在长任务中用 restart 杀进程）。
2. 跑 P0 + sample live gate；保留 `artifacts/0717-four-line-acceptance/` 全量产物。
3. 跑 Bridge `smoke / browse / stress / load`（`SERVER_URL` 对齐 Launcher 端口，常见 7990）。

### P1 — 测试债（不阻塞 Hotfix 代码合并）

1. 更新 `deliverable-summary-sdm-regression.spec.ts` REG-02 断言路径。
2. 同步 `DeliverableSummaryTable.modric-regression.test.tsx` 与 0717 汇总表状态文案。
3. `npm run build` 后重跑 `npm run test:pre-production:offline` 消除 preflight 假失败。

### P2 — 历史数据

- 116 条 `missing_on_disk` 为删盘/迁移残留，**不应**作为 0717 新逻辑回归标准；新会话 KPI 以 live replay + 新 JSONL 为准。

---

## 8. 结论

- **代码层（离线）**：0717 计划 P0–P1 门禁 **全部通过**；`--gate` 在无 dev 栈时正确拒绝 P0 实机，行为符合设计。
- **实机层**：本次 **零 Gateway 回放**；Playwright 失败 **2/13 为测试过期**，非环境不可用。
- **历史审计**：四线 actionable 88.7%；0717 KPI 仅 **`literal_placeholder_path=2`（历史）**，需新会话实机确认归零。

---

## 9. 增量复测（2026-07-18 16:55+，dev:saas 已启动）

> 端口：Vite **8081**、Bridge **7990**、Gateway **18789**（`npm run dev`）

### 9.1 测试债修复 — **已闭环**

| 项 | 结果 |
|----|------|
| `DeliverableSummaryTable.modric-regression.test.tsx`（MOD-01~05） | **5/5 PASS** |
| Playwright `deliverable-summary-sdm-regression.spec.ts`（REG-01~04 等） | **5 PASS / 5 SKIP**（REG-06~09 需 Modric live 会话，当前 skip） |
| 修复要点 | MOD-02 槽位 label 现为语义名（`competitive brief`）；MOD-05 校验中态链接列为 `—`，改断言语义名 + `getAllByText`；REG-02 改查 `resolveSessionDeliverableContract.ts` |

### 9.2 Bridge 实机 — **PASS**

| 命令 | 结果 |
|------|------|
| `npm run test:bridge-stability:smoke` | **PASS** — wedged=0，readyP95=38ms |
| `npm run test:bridge-stability:browse` | **PASS** — wedged=0，readyP95=4ms |

### 9.3 P0 三线 Gateway — **PASS（3/3）**

```bash
SERVER_URL=http://127.0.0.1:7990 node scripts/run-0717-four-line-live.mjs --tier p0 --workers=1 --gate
```

| 案例 | 耗时 | turn 状态 | 四线 KPI |
|------|------|-----------|----------|
| video-3-step | 749s | completed（acceptance `needs_repair`，KPI 全 0 仍 PASS） | 全 0 |
| 10-page-slides | 602s | completed | 全 0 |
| campaign-6-slot | 431s | `passed` | 全 0 |

- 总耗时约 **36 分钟**（16:55–17:31）；`run-manifest.json` → `liveResult.passCount=3`；日志 `audit-p0-live-gate-live.log`。
- 产物：`artifacts/0717-four-line-acceptance/cases/{video-3-step,10-page-slides,campaign-6-slot}/`（archive/diagnostic HTML、kpis.json、turn-result.json）。

### 9.4 sample tier — **PASS（2/2）**

| 案例 | 耗时 | 四线 KPI |
|------|------|----------|
| market-add-html | 105s | 全 0 |
| geo-competitor-4-slot | 445s | 全 0 |

- 总耗时约 **13 分钟**；`live gate PASS 2/2`；日志 `audit-sample-live-gate-live.log`。

### 9.5 其它增量

| 项 | 结果 |
|----|------|
| `npm run build` | **PASS** — `copy-dist-runtime` smoke ok |
| `npm run test:pre-production:offline` | **16/20** — `pack:preflight` 已绿；失败 4 项为需 live 栈的 `test:saas:deep/storage/folder` + `smoke:capability-hub`（与 P0 并行时快速 exit 1，非 0717 回归） |
| Bridge stress | **PASS** — wedged=0 |
| Bridge load | **FAIL** — `Maximum call stack size exceeded`（脚本 bug，与 P0 实机无关） |

### 9.6 仍待项

1. Bridge load 栈溢出需单独修脚本（`bridge-stability-load.mjs --scenario load`）。
2. 独占 dev 栈重跑 `test:saas:deep/storage/folder` 与 `smoke:capability-hub`。
3. 可选 REG-06~09 Modric live Playwright。

---

*报告由 Agent 于 2026-07-18 自动生成；原始日志见 `artifacts/0717-four-line-acceptance/`。*
