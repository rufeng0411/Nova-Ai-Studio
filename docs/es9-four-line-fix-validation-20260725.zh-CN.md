# ES9 失败案 · 四线对齐修复校验报告

- **生成时间**：2026-07-25 23:49（UTC+8）
- **监控编排**：`scripts/run-fullchain-monitor-20260725.mjs`
- **原始日志目录**：`artifacts/fullchain-monitor-20260725/`
- **Bridge 探针**：`http://127.0.0.1:7990/api/saas/health/ready` → **200 OK**

---

## 1. 执行摘要

| 维度 | 结论 | 证据等级 |
|------|------|----------|
| **四线对齐（离线修复）** | ES9 专项修复 **单测/replay 全绿**；历史盘扫 actionable 对齐 **87.9%** | L0–L1 ✅ |
| **四线对齐（Gateway 实机）** | P0 三线 **1/3 通过**；超时案 KPI 无 collision/hash 问题 | L2 部分 ⚠️ |
| **减少用户干预** | 「做成PPT」澄清误拦、scope 外 phantom 绑定的 **代码已修+单测绿**；实机 ES9 四格式 **未重跑 live** | L0 ✅ / L2 待补 |
| **流程模板失败案** | 吴裕泰/雷蛇/分阶段 write_file 等 **CLI 场景绿**；北京 AI recovery 等 4 场景仍红 | L1 部分 ⚠️ |
| **整体发版建议** | **Hotfix 可合**（澄清门控、read_file 串台、scope 绑定）；**整案 GO 否**（长任务 15min 超时、continuation-policy 回归） | — |

**一句话**：本次针对 ES9 会话的根因修复在 **离线门禁已验证**；四线 **结构/导出 parity/audit KPI** 达标；但 **Gateway 长任务 15min 未收口** 与 **task-continuation-policy 单测回归** 表明「零干预跑完全案」在生产实机仍 **未闭环**。

---

## 2. 监控方法与覆盖范围

### 2.1 三阶段编排

| 阶段 | 内容 | 结果 |
|------|------|------|
| **A 离线修复校验** | ES9 五案 replay、repair-loop、四线 audit、导出 parity、修复单测簇 | **5/5 PASS** |
| **B 历史/流程模板 CLI** | `dialogue-stability:process-templates`、`historical`、吴裕泰 SDM replay | **1/3 PASS**（B1/B2 红） |
| **C Gateway 实机** | 0717 四线 structure-only + P0 live（video/slides/campaign） | **1/2 PASS**（C2 红） |

总耗时约 **56 分钟**（含 C2 Gateway **55 分钟**）。

### 2.2 失败案例选取（与用户要求对齐）

| 类型 | 案例 ID | 历史症状 | 本次覆盖方式 |
|------|---------|----------|--------------|
| **单任务·四格式** | ES9 `web-s_34b7bf73` / `md-html-office-pack` | 澄清误拦、read_file 串台、pdf/docx 绑到旧 task、pptx 缺失、footer 全「校验中…」 | A1/A2/A5 单测 + 历史 HTML 取证 |
| **单任务·调研 HTML** | ES9 Case2 `product-user-research` | SDM 双槽 pathHint | A1 replay |
| **流程模板·增长全案** | `saas-growth-full`（8 槽） | 曾误绑 geo 全案 / 清单编译错 | A1 Case1 + checklist authority 单测 |
| **流程模板·Campaign** | 吴裕泰 `content-flywheel` | 第二轮成果丢失、尾页分页 | B1 wuyutai 场景 + B3 replay |
| **流程模板·GEO** | 雷蛇 `geo-aeo-audit` | 裸名/多目录碰撞 | B1 display-engine-alignment |
| **Gateway P0** | Campaign 6 槽 / Nova 10 页幻灯 | 0717 历史 false-incomplete / 长 turn 不收敛 | C2 live（**超时 FAIL**） |

> **说明**：ES9 四格式 **未纳入本次 Gateway live 15min 窗口**（原会话需 export_document 链 + 多轮续做，单 turn 超时不够）。修复校验以 **离线 replay + 原会话 HTML 四线 debug 表对照 + 同族 P0 实机 KPI** 三角取证。

---

## 3. 问题一：四线对齐与用户干预是否改善？

### 3.1 原 ES9 会话（`web-s_34b7bf73`）四线分裂取证

| 线 | 2026-07-24 实机表现 | 根因 |
|----|---------------------|------|
| **助手正文** | 停在「确认 PPTX 质量…」，未宣称 passed | read_file 返回 SKILL 全文 → Agent 无法读 report |
| **footer 汇总表** | 六行全「校验中…」 | `validationSettled=false` + scope 外 verified 污染 |
| **Dock / 导出 debug** | pdf/docx 链到 `task-20260722-*`；**无 report.pptx** | `filterVerified` 未 scope 优先；跨 task enrich |
| **文件夹 Tab** | report.md 在 `task-20260723-fd6c3d5f` | 盘真存在，但与 verified 绑定不一致 |

**用户干预次数（原会话）**：≥ **3 次**（两次「做成PPT」+ 导出 HTML 自查），含 **1 次误澄清**。

### 3.2 已落地修复与校验

| 修复项 | 模块 | 单测 | 预期效果 |
|--------|------|------|----------|
| 「做成PPT」不误问卷 | `clarificationGate.ts` + `AgentLoop.ts` | `clarification-gate.test.ts` ✅ | 有 SDM 成果时 follow-up PPT **零澄清** |
| read_file 结果串台 | `ToolResultBudget.ts` | `ToolResultBudget.test.ts` ✅ | spill 键 `turnId::toolCallId`，禁跨 turn 复用 preview |
| read_file 可观测 | `readFile.ts` | — | 结果首行 `File: <path>` |
| scope 优先 verified 绑定 | `filterVerifiedForContractBinding.ts`、`sdmSlotMatching.ts` | 两文件单测 ✅ | 禁 `task-20260722` phantom 绑进 `task-20260723` |
| repair 期 Trust Copy | `deliverableUserStatusCopy.ts` | `es9-repair-loop-four-case.test.ts` ✅ | repair 中禁「回复可以了」误导 |

### 3.3 四线门禁 KPI（2026-07-25 盘扫）

来源：`docs/four-line-alignment-audit-2026-07-25.md`

| KPI | 值 | 门禁 |
|-----|-----|------|
| 会话扫描 | 61 | — |
| Turn 审计 | 492 | — |
| **actionable 对齐率** | **87.9%**（raw 69.1%，排除 missing_on_disk） | G-4L2 ≥85% **PASS** |
| slot_collision | 0 | ✅ |
| hash_mismatch | 0 | ✅ |
| literal_placeholder_path | 1 | ⚠️ 待清 |
| bare_name_risk | 41 turns | 持续治理 |

**0717 P0 Gateway 实机 KPI**（`artifacts/0717-four-line-acceptance/run-manifest.json`）：

| 案例 | 耗时 | 结果 | 四线 KPI |
|------|------|------|----------|
| video-3-step | **1147s (~19min)** | **PASS** | 全 0 |
| 10-page-slides | 900s（超时） | FAIL | 全 0（turn 未 complete） |
| campaign-6-slot | 900s（超时） | FAIL | 全 0（turn 未 complete） |

**解读**：超时案的 KPI **无 collision/hash 问题**——失败主因是 **turn 生命周期未收敛**，不是四线合并算法再次绑错。这与 ES9「文件在盘但清单红/校验中」属于 **同族症状**（engine/UI 未 settled）。

### 3.4 「减少用户干预」判定

| 场景 | 修复前 | 修复后（当前证据） |
|------|--------|-------------------|
| ES9「做成PPT」续做 | 澄清门控拦一次 | 单测：**不再问卷** ✅ |
| ES9 read_file report | 返回 ppt-master SKILL | spill 隔离 ✅；**live 未复跑** |
| ES9 四线 pdf/docx 路径 | 跨 task | scope filter ✅ |
| 流程模板 8 槽增长全案 | 用户手打「继续」 | SDM replay 8 槽编译 ✅；**live 未跑** |
| Campaign / 10 页幻灯 | 长任务卡住 | **15min 超时仍 FAIL** ❌ |

**结论（问题 1）**：

- **离线/结构层**：四线对齐修复 **有效**，ES9 类 scope 串台与澄清误拦 **已门禁**。
- **实机端到端**：**尚未**证明 ES9 四格式可在 **零用户「继续」** 下自动 export 齐 4 文件；P0 长案仍 **依赖超时或人工**。

---

## 4. 问题二：全程产生了哪些错误？

### 4.1 监控编排 FAIL 项

| ID | 错误 | 根因分类 |
|----|------|----------|
| **B1/B2** | `task-continuation-policy.test.ts`：`hf-website-to-video` 期望 `retry_alternate` 得 `user_action_required` | **测试/策略漂移**（HyperFrames 视频模板缺 Key 时快停策略变更） |
| **C2** | `10-page-slides`、`campaign-6-slot`：`turn_not_completed` + `turn_timeout` @ 900s | **长 turn 未收敛**（生图/多文件 write 链） |

### 4.2 对话稳定性历史套件（11/15 通过）

来源：`docs/dialogue-stability-full-chain-acceptance-2026-07-25.md`

| 失败场景 | 关联命令失败 |
|----------|--------------|
| PPT 只交 HTML/脚本 | validate-deliverables-engine 链 |
| 北京 AI 调研 recovery | task-continuation-policy |
| 文档导入/OCR/导出中断 | task-continuation-policy |
| 第三方 skill 缺配置 | task-continuation-policy |

> 四处失败 **收敛到同一单测**：`capability execution contracts bypass optional media keys`——与 ES9 四格式 **无直接关系**，但影响 **视频/网站成片类流程模板** 的「少干预续跑」叙事。

### 4.3 原 ES9 会话错误分类（归档）

| 错误 | 严重度 | 是否已修 |
|------|--------|----------|
| 澄清门控误拦「做成PPT」 | P0 体验 | ✅ |
| read_file 大结果 spill 串台 | P0 执行 | ✅ 单测 |
| verified 跨 task 绑定 | P0 四线 | ✅ 单测 |
| Sequential deliverable 拦 batch export | P1 执行 | 未在本次 live 验证 |
| 侧栏导出 HTML 503 | 独立链路 | 非本案主因（见前序 RCA） |

---

## 5. 修复校验矩阵（门禁清单）

| 门禁命令 | 结果 | 日志 |
|----------|------|------|
| `npm run test:es9:five-case-replay` | ✅ 32/32 | `A1-es9-five-replay.log` |
| `tests/es9-repair-loop-four-case.test.ts` | ✅ | `A2-es9-repair-loop.log` |
| `npm run test:four-line-audit -- --gate` | ✅ G-4L2 | `A3-four-line-audit.log` |
| `npm run test:export-four-line-parity` | ✅ | `A4-export-parity.log` |
| 修复单测簇（ToolResultBudget / filterVerified / sdm / clarification） | ✅ | `A5-fix-unit.log` |
| 吴裕泰 SDM replay | ✅ | `B3-wuyutai-replay.log` |
| `test:0717-four-line-live --structure-only --gate` | ✅ 34 tests | `C1-four-line-structure.log` |
| `test:0717-four-line-live --tier p0 --gate` | ❌ 1/3 | `C2-four-line-live-p0.log` |
| `test:dialogue-stability:process-templates` | ❌ | `B1-*.log` |
| **ES9 四格式 Gateway live 重放** | ⏸ 未执行 | 建议单独 `--timeout 2400` 专项 |

---

## 6. 流程模板案例专项

### 6.1 已通过（CLI）

- **吴裕泰 Campaign 累计成果**：ledger + tail 分页 ✅
- **雷蛇 GEO 裸名碰撞**：display-engine-alignment ✅
- **流程模板 write_file 分阶段约束**：smoke:templates ✅
- **短剧/Remotion 过程脚本过滤**：validateDeliverables + displayPolicy ✅
- **saas-growth-full 8 槽编译**：ES9 Case1 replay ✅（非 geo 误绑）

### 6.2 仍失败 / 未 live

- **北京 AI 长报告 recovery**：continuation-policy 回归
- **PPT 真 pptx 合同**：engine 链仍有失败项
- **Campaign 6 槽 / Nova 10 页**：Gateway **900s 超时**

---

## 7. 结论与后续验收命令

### 7.1 能否宣称「四线已对齐、少干预完成」？

- **结构/绑定层**：**可以**（离线门禁 + audit KPI + scope 修复单测）。
- **ES9 原会话级端到端**：**不可以**——需补跑：
  1. ES9 四格式 Gateway live（建议 `scripts/run-es9-five-case-live.mjs --cases case3-four-format-vap --gate --timeout-ms 2400000`）
  2. 原会话 jsonl **replay 四线 export HTML** 对比修复前后
  3. Playwright `test:four-line-e2e`（audit 报告 G-4L3 pending）

### 7.2 建议下一里程碑

1. 修复 `task-continuation-policy` 与 HyperFrames 契约单测（或更新期望为 `user_action_required` 若产品意图变更）
2. P0 live harness **900s → 2400s** 对 Campaign/Nova 幻灯，或拆为多 turn 验收
3. ES9 Case3 **专用 live gate** 纳入 `test:prelaunch:quick` 切片

---

## 8. 附件索引

| 文件 | 说明 |
|------|------|
| `artifacts/fullchain-monitor-20260725/summary.json` | 总览 PASS/FAIL |
| `artifacts/0717-four-line-acceptance/run-manifest.json` | P0 live 明细 |
| `docs/four-line-alignment-audit-2026-07-25.md` | 61 会话四线盘扫 |
| `docs/dialogue-stability-full-chain-acceptance-2026-07-25.md` | 15 历史场景 |
| `tests/fixtures/es9-repair-loop-four-case.ts` | ES9 repair 四案锚点 |

---

## Post-Implementation（2026-07-26）

- **离线**：ES9 五案 replay + 四线 audit/export parity **绿**；Case3 `parallelGroup=office-export` 单测已补
- **P0-2**：`sequentialDeliverableGate` + `applyParallelGroupHints`（修复 `keywords.md` 误触 office 包）
- **Live**：Case3 四格式 Gateway + 四线 L3 仍须 `npm run test:es9:four-format-live:gate`（dev:saas）
