# 鸣镝 G700 生产稳态加固 — 实机验收评测与优化分析（2026-07-19）

## 1. Executive 结论

| 维度 | 结论 |
|------|------|
| **离线/结构门禁** | **通过** — 单元、11 案回放、官方素材链、四线导出、fork 登记、scope 审计均绿 |
| **Bridge 稳定性** | **部分通过** — 侧栏 browse 实机 PASS；smoke/load/soak 因 `wedgedCount>0` 未过门禁 |
| **Gateway 7 场景实机** | **未通过** — 6/7 交付类场景 `false_incomplete`；回合 sub-second 完成且无工具/无 acceptance |
| **模型/Gateway 基线** | **可用** — `T-09` 脑爆纯聊天 132s PASS（`general` 项目，无 capability 绑定） |
| **生产整包 GO** | **否** |

**总判定：`NO_PRODUCTION_GO`**

机器可读汇总：[`artifacts/mingdi-g700-production-acceptance/full-acceptance-report.json`](artifacts/mingdi-g700-production-acceptance/full-acceptance-report.json)

---

## 2. 本次执行的测试矩阵

### 2.1 已通过项

| 测试 | 结果 | 说明 |
|------|------|------|
| `test:mingdi-g700:unit` | PASS | 14/14 |
| `test:mingdi-g700:replay` | PASS | 11/11 脱敏回放，稳定复现历史失败标签 |
| `test:official-media:acceptance` | PASS | 79 pass + 2 skip（外网）；`check:official-source-roots` valid 但 **roots=0** |
| `test:export-four-line-parity` | PASS | 46/46 |
| `check:saas-fork` | PASS | 645 条 |
| `audit:capability-scope` | PASS | 4/4 Hub slug；`brand-campaign-full` 流程模板例外 |
| `test:cloud:official-media-smoke` | PASS（结构） | 以 `http://127.0.0.1:7990/api/saas/health/ready` 登记，非外网 official-media |
| `test:bridge-stability:unit` | PASS | vitest 11 + node 20 |
| `test:bridge-stability:browse` | PASS | wedged=0，readyP95=7ms（**贴近用户侧栏连点**） |
| `integration-prelaunch T-09` | PASS | 132s，`turnCompleted=true`，无 write_file |

### 2.2 未通过项

| 测试 | 结果 | 关键指标 |
|------|------|----------|
| `test:bridge-stability:smoke` | FAIL | wedged=3，readyP95=37ms @7990 |
| `test:bridge-stability:load` | FAIL | wedged=51，readyP95=72ms；validate/messages 大量 503 重试但 hardErrorRate≈0 |
| `test:bridge-stability:soak` | FAIL | 180s soak，wedged=23，readyP95=48ms |
| `run-mingdi-g700-live-gateway` 7 场景 | FAIL | 6/7 `false_incomplete=1`；平均耗时 **0.5–2s**，无 `toolCalls`、无 `acceptanceStatus` |

报告路径：

- Bridge：`artifacts/bridge-stability-test/load-*-2026-07-19*.json`
- Live：`artifacts/mingdi-g700-production-acceptance/live-p0-report.json`
- 全量日志：`artifacts/mingdi-g700-production-acceptance/live-gateway-full-run.log`

---

## 3. 7 场景实机问题剖析

### 3.1 现象

在 `dev:saas`（Bridge **7990**、Gateway **18789**）下，7 场景串行跑批结果：

| 场景 | 耗时 | turnCompleted | toolCalls | KPI |
|------|-----:|:-------------:|-----------|-----|
| strategy-consultation | 2.1s | ✓ | 无 | 通过（但耗时偏短） |
| brand-website-official-media | 0.6s | ✓ | 无 | **false_incomplete** |
| nova-slides-6-official | 0.6s | ✓ | 无 | **false_incomplete** |
| last30days-single-artifact | 0.6s | ✓ | 无 | **false_incomplete** |
| strategy-report | 0.6s | ✓ | 无 | **false_incomplete** |
| product-user-research | 0.6s | ✓ | 无 | **false_incomplete** |
| campaign-full-subject | 0.6s | ✓ | 无 | **false_incomplete** |

`turn-timing.jsonl` 显示这些回合仅含 `session_prepare` / `compact` 阶段，**无 `router_judge` / LLM 推理阶段**。

### 3.2 对照基线（证明非全局 Gateway 故障）

同环境 `integration-prelaunch-live-tasks` **T-09**（`general`、**无** `capabilityContext`）：

- 耗时 **132s**
- `turnCompleted=true`，无 artifacts 写入 — **符合预期**

**结论**：Gateway + 模型池在 `general` 可用；**带 `capabilityContext.slug` 的 CLI harness 回合被 sub-second 空完成**，未进入 Agent 主循环，导致 7 场景实机验收**不能代表加固效果**。

### 3.3 与历史 11 案的关系

- **11 案 replay** 验证的是「旧 HTML 导出可被审计器打上历史失败标签」——已通过。
- **7 场景 live** 本应验证 P0-1/6/9 等在**真实对话**中的 KPI —— **当前 harness 未跑通，不能宣称加固已在实机生效**。

---

## 4. Bridge soak 评测

### 4.1 端口纠偏（重要）

首轮全量验收误将 **`http://127.0.0.1:8081`（Vite）** 当作 `SERVER_URL`，导致：

- load 报告 wedged **8082**、hardErrorRate **31%** — **无效压测**

重跑使用 **`http://127.0.0.1:7990`（Express Bridge）** 后：

| 场景 | wedged | readyP95 | hardErrorRate | 判定 |
|------|-------:|---------:|--------------:|------|
| browse | 0 | 7ms | 0 | **PASS** |
| smoke | 3 | 37ms | 0 | FAIL（wedged 门禁） |
| load 5min | 51 | 72ms | validate 0 / messages 0 | FAIL（wedged） |
| soak 3min | 23 | 48ms | 0 | FAIL（wedged） |

并发 load/soak 期间 **503 背压重试占主导，hard 错误率为 0** — 说明背压在工作，但 **`GET /api/saas/health/ready` 偶发 >3s** 仍计为 wedged，导致门禁 FAIL。

### 4.2 优化判断

- **P0**：验收脚本/文档强制 `SERVER_URL=Bridge 端口`（7990 或 dev 探针结果），**禁止默认走 Vite 8081**。
- **P1**：load 期间 wedged 与 503 语义分离 — 503 可 retry，wedged 应区分「Bridge 真死锁」vs「背压排队 >3s」。
- **P1**：继续 `pathInProject` async FS + validate 串行/cache（AGENTS 已列 RCA 方向）。

---

## 5. 加固代码 vs 实机覆盖度

| P0 模块 | 离线验证 | 实机 7 场景 | 缺口 |
|---------|----------|-------------|------|
| P0-1 scope / 咨询双模式 | replay + unit | **未触达**（空 turn） | CLI capability 路由 |
| P0-2 goalQualityContract | unit + TurnRunner test | shadow，未 enforce | 灰度 + 实机 prompt |
| P0-3～6 official-media | 79 tool tests | **未触达** | 需真 fetch + 实 write |
| P0-7 终验收证书 | unit + export | acceptance=null | 回合未跑完交付链 |
| P0-8 UI 质量态 | vitest 52+ | 未 UI 走查 | Playwright 四线 |
| P0-9 内容断言 | unit | **未触达** | 需完整交付 turn |
| P0-10 live 门禁 | 结构 PASS | **KPI FAIL** | harness 修复 |

Dev 默认 flag（`devLauncherCore`）：`PILOTDECK_CAPABILITY_SCOPE_V2=enforce`，但 **official-media / content-quality / goal-quality 多为 shadow** — 实机即使跑通，也需分阶段升 **enforce** 并复测。

---

## 6. 优化方案（按优先级）

### P0 — 阻塞「实机 7 场景 GO」

1. **修复 CLI `capabilityContext` 提交路径**  
   - 对照 Web `submit_turn` vs CLI harness：为何 slug 绑定回合在 `session_prepare` 后即 `turn_completed`。  
   - 参考已通过路径：`integration-prelaunch-live-tasks.mjs`（general + 长 timeout + 磁盘 verify）。

2. **实机验收改双轨**  
   - **轨 A（回归）**：Playwright / 0709 式 UI 实机，带 Hub「试一下」绑定。  
   - **轨 B（Harness）**：修复后 `run-mingdi-g700-live-gateway.mjs` 串行 workers=1，每场景磁盘 verify + HTML 导出审计。

3. **验收编排强制 Bridge 端口**  
   - `run-mingdi-g700-full-acceptance.mjs` 已改探针顺序；CI/文档同步写死「读 `[dev-saas] resolved dev ports` 的 server 行」。

### P1 — Bridge 生产稳态

4. **Wedged 门禁校准**  
   - load 下 ready>3s 若伴随 503 retry 且无 hard fail，记 **WARN** 非 FAIL；真 wedged（health 超时/ECONNRESET）仍 FAIL。

5. **官方素材运维**  
   - 灌入 `config/official-source-roots.json`（鸣镝/联名方根域）；当前 **roots=0** 仅 schema valid。

6. **Harness 质量断言增强**  
   - live KPI 增加：`durationMs >= 10_000`（交付类）、`stages` 含 LLM、`assistantText.length` 下限；避免 sub-second 假绿。

### P2 — 灰度与发版

7. **Flag 升 enforce 顺序**  
   `GOAL_QUALITY_CONTRACT` → `OFFICIAL_MEDIA_V2` → `CONTENT_QUALITY_V2` → UI quality；每步复跑 7 场景 + 11 案 replay。  
   **VAP 并行灰度**：`PILOTDECK_VISUAL_ASSET_PLATFORM` shadow → canary enforce → 全量（独立于 OFFICIAL_MEDIA_V2）。

8. **云端 official-media**  
   - staging URL 指向真实 `fetch_page_images` / CDN 抽样，而非 health 端点。

### §5–§6 更新（2026-07-19 VAP）

| 项 | 状态 |
|----|------|
| source-roots | 已灌 zongheng/chery/autohome/dongchedi（roots=4） |
| 「来自官网」编译 | `officialMediaRequirement` 已扩展 |
| VAP 平台 | `src/saas/media/visualAssetPlatform/*` + DoH + recipes |
| CLI displayName | Gateway/harness 已填，防 sub-second 空转 |
| 离线验收 | `npm run test:visual-asset-platform:acceptance` |
| 生产 GO | **仍否** — 须 enforce canary 下五案实机 `localizedOfficialImages>=1` |

规格：[`visual-asset-platform-spec.zh-CN.md`](visual-asset-platform-spec.zh-CN.md)、[`mingdi-g700-visual-asset-rca-20260719.zh-CN.md`](mingdi-g700-visual-asset-rca-20260719.zh-CN.md)。

---

## 7. 本轮代码修复（已落地）

| 项 | 文件 | 作用 |
|----|------|------|
| Harness 等待 final | `scripts/lib/gatewaySessionHarness.mjs` | 不在 submit ack 上提前结束 |
| Bridge 端口探针 | `scripts/run-mingdi-g700-live-gateway.mjs` | 去掉 Vite 8081 |
| Live 项目 | 同上 | 改用 `general` + `resolveGeneralWorkspaceCwd` |
| goalVersion | `ui/src/shared/turnAcceptanceMeta.ts` | 四线 envelope 合并 |
| Scope audit | `scripts/audit-capability-scope.mjs` | 流程模板例外 |
| 实机跑批 | `scripts/run-mingdi-g700-live-gateway.mjs` + `mingdiG700LiveScenarios.mjs` | 7 场景定义 + KPI |
| 一键验收 | `scripts/run-mingdi-g700-full-acceptance.mjs` | dev + bridge + live 编排 |

---

## 8. 建议的下一步（需您下令）

1. **CLI capability 空转已修**（displayName）；在 `dev:saas` 下重跑 `node --import tsx scripts/run-mingdi-g700-live-gateway.mjs --gate`（含 0719 视觉案 KPI）。  
2. **Bridge**：在 7990 上仅重跑 `test:bridge-stability:smoke` + `browse` 作为发版最小集；load/soak 与 wedged 阈值调整单独立项。  
3. **enforce 灰度**：`PILOTDECK_VISUAL_ASSET_PLATFORM=shadow` 观察 → slug canary enforce → 全量；同步 OFFICIAL_MEDIA_V2。

---

## 9. 附件索引

| 文件 | 说明 |
|------|------|
| [`docs/mingdi-g700-production-hardening-acceptance-20260719.zh-CN.md`](mingdi-g700-production-hardening-acceptance-20260719.zh-CN.md) | 上一轮结构验收 |
| [`docs/mingdi-g700-production-hardening-baseline-20260718.zh-CN.md`](mingdi-g700-production-hardening-baseline-20260718.zh-CN.md) | 11 案历史基线 |
| [`artifacts/mingdi-g700-production-acceptance/live-p0-report.json`](../artifacts/mingdi-g700-production-acceptance/live-p0-report.json) | 7 场景实机 KPI |
| [`artifacts/prelaunch-live-tasks/live-tasks-20260719.json`](../artifacts/prelaunch-live-tasks/live-tasks-20260719.json) | T-09 基线 PASS |
| [`docs/prelaunch-live-tasks-20260719.md`](../docs/prelaunch-live-tasks-20260719.md) | T-09 可读报告 |

**签收**：离线加固与门禁脚本已就绪；**生产 GO 须待 CLI capability 实机跑通 + Bridge wedged 门禁收敛后**再更新本报告 verdict。
