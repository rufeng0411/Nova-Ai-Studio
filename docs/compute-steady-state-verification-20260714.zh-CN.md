# 算力提速稳态方案 · 严格验证测试报告

**生成时间**：2026-07-14 00:31（UTC+8）  
**验证环境**：Windows 本地工作区 `f:\Ai-pilotdeck`（未启动 `dev:saas` Gateway 实跑）  
**代码基准**：工作区未提交改动（含 Train-0A～2 + P0-4 测试修复）

---

## 1. 执行摘要

| 维度 | 结论 | 说明 |
|------|------|------|
| **Train-0A/B 核心逻辑** | ✅ 通过 | meta 持久化、passed 硬短路、P0-4 引擎信任、0713 fixture、SDM 单测 |
| **Train-0D Turn Queue** | ✅ 通过 | 9/9 单元（slot / queue / gate） |
| **Train-1 JSONL 瘦身** | ✅ 通过 | history sanitize 10/10、tail-read 20/20 |
| **Train-2 Synthetic Budget** | ✅ 通过 | `sessionSyntheticTurnBudget` 单测纳入 Train 核心 47/47 |
| **R1 对话稳定门禁** | ✅ 通过 | `test:p0-p2:unit` 156/156 + display-engine-alignment |
| **五线成果路径** | ✅ 通过 | deliverable-paths 碰撞 6/6 + 路径单测 45/45 |
| **KPI 门禁 `--gate`** | ❌ 未通过 | 交付干预率 26.9% > 阈值 22.0%（历史 JSONL 扫描，非本次回归引入） |
| **GEO Hub smoke** | ❌ 未通过 | 7 个 GEO skill 缺中文 `display_name`（i18n 债，与算力核心无关） |
| **ECS / 实机 Gateway** | ⏸ 未执行 | 需 `pack:deploy` + `upgrade.sh` + `verify-cloud-runtime` |
| **Playwright 排队生命周期** | ⏸ 未执行 | `test:turn-queue:lifecycle` 需 dev:saas |
| **吴裕泰 Gateway 实跑** | ⏸ 未执行 | `test:recovery-wuyutai:run` 需 running≤1 单会话 |

**总体判定**：

- **Hotfix 代码路径（Train-0A/B + UI P0-4）可进入打包发版**，单元与集成门禁均已绿。
- **算力稳态全量 KPI（R1 `--gate`）尚未达标**，不应宣称「整包算力方案已生产闭环」。
- **发版与算力双轨**：Nova 可发 Hotfix；R2/R3 云端 perf flag 须按 `apply-cloud-perf-env.sh` 分期开启。

---

## 2. 验证矩阵（已执行）

### 2.1 Train-0A · meta / repairCircuit 持久化

| 命令 | 结果 | 证据 |
|------|------|------|
| `vitest run src/saas/taskState/sessionDeliverableManifest.test.ts` 等 SDM 套件 | ✅ 53/53 | `npm run test:sdm:unit` |
| `vitest run tests/fixtures/udc/geo-wuyutai-coldbrew/replay.test.ts` | ✅ | 含 0713 五案 fixture 引用 |
| `tests/saas/rog-four-line-acceptance-meta.test.ts` | ✅ 1/1 | `test:rog-phase6:integration` |

**覆盖点**：`turn_acceptance_meta` / `sessionDeliverableManifest` / repairCircuit 落盘、四线 acceptance meta 对齐。

### 2.2 Train-0B · 假 repair 短路 + UI 信任引擎 meta

| 命令 | 结果 | 证据 |
|------|------|------|
| `tests/saas/task-continuation-policy.test.ts` | ✅ | passed 硬短路用例 |
| `npm run test:bridge-stability:unit:0` | ✅ 11/11 | 含 **修复后** `useValidatedDeliverables.test.tsx` 3/3 |
| `npm run test:p0-p2:unit` | ✅ 156/156 | 含 validateDeliverables / taskResume / clarification |

**P0-4 专项**（本次补测）：

- `trusts engine acceptance meta and skips Bridge validate fetch` — ✅  
- 幻影 text 路径 server broken 后隐藏 — ✅  
- tool 路径 softVerified + resolvedPath 仍展示 — ✅  

**测试修复说明**：原测试 stub 全局 `fetch`，但 hook 走 `fetchDeliverableValidationCached`；已改为 mock 缓存层 + `clearAllLedgersForTests()`，并给 `useValidatedDeliverableSet` effect 补上 `latestAcceptanceMeta` 依赖项。

### 2.3 Train-0D · Turn Queue 启动 hydrate/pump

| 命令 | 结果 |
|------|------|
| `npm run test:turn-queue:unit` | ✅ 9/9（turnSlotRegistry 3 + turnQueueManager 2 + turnConcurrencyGate 4） |

**未跑**：`npm run test:turn-queue:lifecycle`（Playwright，需 Bridge/Gateway 在线）。

### 2.4 Train-1 · tool_result 压缩 + history sanitize

| 命令 | 结果 |
|------|------|
| `npx tsx --test tests/web/server/historyMessageSanitize.test.ts` | ✅ 7/7 |
| `npm run test:history-messages:quick` | ✅ sanitize 10 + tail 20 + pagination 8 |
| `scripts/release/apply-cloud-perf-env.sh` 键位 | ✅ 已含 `PILOTDECK_TOOL_RESULT_COMPACTION=1`（R2） |

### 2.5 Train-2 · SESSION_SYNTHETIC_BUDGET 灰度

| 命令 | 结果 |
|------|------|
| `vitest run src/saas/sessionSyntheticTurnBudget.test.ts` | ✅ | 纳入 Train 核心 47/47 |
| `apply-cloud-perf-env.sh` R3 | ✅ 已含 `PILOTDECK_SESSION_SYNTHETIC_BUDGET=1` + `LIMIT=8` |

### 2.6 R1 门禁 · 对话稳定 + 展示对齐

| 命令 | 结果 |
|------|------|
| `npm run test:display-engine-alignment` | ✅ PASS |
| `npm run test:rog-phase6:integration` | ✅ 19 fixtures + 1 vitest |
| `npm run test:recovery-wuyutai`（JSONL 对比） | ✅ | 报告 `docs/recovery-stability-report-2026-07-13.md` |
| `npm run test:deliverable-paths` | ✅ 6 碰撞 + 45 单测 |
| `npm run test:deliverable-triple-unify:export` | ✅ 7/7 |
| `npm run pack:preflight` | ✅ | 2 警告：Windows databasePath、projects 体积 |

### 2.7 KPI 扫描（历史会话，非单测）

```bash
node scripts/analyze-task-completion.mjs --gate
```

| 指标 | 值 | 门禁 |
|------|-----|------|
| 扫描会话 | 224 | — |
| 交付导向会话 | 119 | — |
| **交付干预率** | **26.9%** | ❌ > 22.0%（phase1） |
| Recovery 空转率 | 0.0% | ✅ |
| PPT 完成率（.pptx 工具路径） | 34.8% | 跟踪项 |
| TTFT first_visible p95 | 43877ms | 跟踪项 |

> KPI 失败反映 **历史 dev 会话统计**，不代表本次 diff 引入回归；Train-0B 目标正是降低 acceptance_repair 与 UI 重复 validate。上线后须用新 JSONL 复扫验收。

---

## 3. 失败与阻塞项

### 3.1 ❌ `smoke:geo-hub`

```
geo hub skill mcp-geo-optimizer / mcp-ai-seo / mkt-claude-seo /
geo-cn-crawlers / geo-monitor-hub / geo-monitor-report / geo-visibility-probe
→ missing Chinese display_name
```

**性质**：能力 catalog i18n 缺口，**不阻塞** Train-0A/B Hotfix 发版。  
**修复路径**：`npm run capabilities:gen` + 补 `capability-hub-zh` / overrides，或单独 vendor GEO 中文名。

### 3.2 ❌ KPI `--gate` phase1

- **原因**：`deliverableInterventionRate 26.9% > 22.0%`
- **与算力方案关系**：Train-2 合成预算 + Train-0B repair 短路 **意图** 降低该指标；须 Hotfix 上线 + 新会话样本复测。
- **Recovery 基线**：`acceptance_repair` 728 次仍偏高（见 recovery 报告），与 0713 事故一致。

### 3.3 ⏸ 未执行项（发版前建议补）

| 项 | 命令 | 前置条件 |
|----|------|----------|
| Gateway 吴裕泰实跑 | `npm run test:recovery-wuyutai:run` | `dev:saas`，running≤1 |
| Turn Queue E2E | `npm run test:turn-queue:lifecycle` | Playwright + dev:saas |
| 云端运行时 | `verify-cloud-runtime.sh` | ECS `pack:deploy` + `upgrade.sh` |
| 云端 perf | `verify-cloud-perf.sh` | R2/R3 env 套用后 |
| Gate-B | admin 改密 + `test:cloud:chat-load` | 生产只读抽检 |

---

## 4. 分项统计汇总

| 套件 | 通过数 | 状态 |
|------|--------|------|
| bridge-stability:unit:0 | 11 | ✅ |
| turn-queue:unit | 9 | ✅ |
| Train 核心 vitest（4 文件） | 47 | ✅ |
| test:sdm:unit | 53 | ✅ |
| test:p0-p2:unit | 156 | ✅ |
| test:rog-phase6:integration | 19+1 | ✅ |
| history-messages:quick | 38+ | ✅ |
| test:deliverable-paths | 51 | ✅ |
| deliverable-triple-unify:export | 7 | ✅ |
| useValidatedDeliverables（修复后） | 3 | ✅ |
| smoke:geo-hub | — | ❌ |
| analyze:task-completion --gate | — | ❌ |

**合计已绿单测/集成**：约 **370+** 用例（不含重复运行的 display-engine-alignment）。

---

## 5. 风险与辐射面（静态评估）

| 区域 | 风险 | 缓解 |
|------|------|------|
| 成果校验 UI | P0-4 跳过 Bridge POST 时引擎 meta 必须可信 | `canTrustEngineAcceptanceMeta` 仅 passed/circuit；单测已覆盖 |
| JSONL 压缩 | 历史 tail 与 sanitize 行为变化 | history 38+ 单测 + R2 可回滚 flag |
| Synthetic budget | 误熔断长任务 | missing 缩小不熔断 + limit=8 灰度 |
| Turn queue 启动 pump | 重复 submit / 槽位风暴 | 9 单元 + 待 E2E |
| 合并/发版 | 品牌与 fork manifest | 发版前 `npm run brand:check` + `check:saas-fork` |

---

## 6. 建议签收动作

### 6.1 可立即（Hotfix 轨）

1. 提交本次 Train-0A/B + 测试修复改动。  
2. `npm run pack:deploy` → ECS `upgrade.sh --bundle …`  
3. `scripts/release/apply-cloud-perf-env.sh`：**先 R2**（`TOOL_RESULT_COMPACTION`），观察后再 **R3**（`SESSION_SYNTHETIC_BUDGET`）。  
4. `verify-cloud-runtime.sh` + Gate-B 改密。  
5. 单会话 `test:recovery-wuyutai:run`（running≤1）确认 ≤2 turn 或 circuit 正常停。

### 6.2 算力稳态闭环（待 KPI 绿）

1. 上线 7 天后复跑 `analyze:task-completion.mjs --gate`。  
2. 对比 `recovery-events.jsonl` 中 `acceptance_repair` 占比是否下降。  
3. P1/P2（memory / compact / maxContext）**独立 flag**，勿与 Train-1 混发。

---

## 7. 附录：关键命令清单

```bash
# 核心回归（本次已全部执行）
npm run test:bridge-stability:unit:0
npm run test:turn-queue:unit
npm run test:p0-p2:unit
npm run test:sdm:unit
npm run test:rog-phase6:integration
npm run test:history-messages:quick
npm run test:deliverable-paths
npm run test:recovery-wuyutai
npm run pack:preflight

# 已知失败（记录用）
npm run smoke:geo-hub
node scripts/analyze-task-completion.mjs --gate

# 发版后补跑
npm run test:recovery-wuyutai:run
npm run test:turn-queue:lifecycle
```

---

**报告作者**：Cursor Agent（自动验证流水线）  
**关联文档**：`docs/wuyutai-0713-preflight-evidence.md`、`docs/recovery-stability-report-2026-07-13.md`、`docs/next-pack-reminders.zh-CN.md`
