# 全链路提速 · 实施追踪

> 计划：`docs/full-chain-speed-optimization-20260725.zh-CN.md`  
> 审阅时间：**2026-07-26 14:10**  
> 结论：**P0–P2 代码与 L0–L3 离线门禁已完成**；**L4 未全闭环**（ES9 live 第 4 轮：澄清门控已修、Agent 已跑但 subagent  phantom 落盘 → 已补 orchestration bypass，**须 Gateway 热重载后第 5 轮复测**）

## 计划 todo 对照（16 项）

| ID | 计划项 | 代码 | 验收 | 状态 |
|----|--------|------|------|------|
| P0-1a | resolveLiveTimeout + 0717 接入 | ✅ | `test:resolve-live-timeout` 5/5 | **完成** |
| P0-1b | ES9 Gateway harness + four-format gate | ✅ | live **第 4 轮**：Agent 3 turn/subagent 声称 5 文件但**盘无文件**；已修 clar+bypass | **待第 5 轮** |
| P0-1c | monitor v2 SKIP_LIVE | ✅ | quick **8/8**；live 10/10 未跑 | **部分** |
| P0-2a | SDM parallelGroup / wire | ✅ | `test:es9:five-case-replay` 33/33 | **完成** |
| P0-2b | sequentialDeliverableGate + shadow | ✅ | vitest 绿 | **完成** |
| P0-2c | advanceStage + 证书 + live 四线 | ✅ 单测 | ES9 live 四线未绿 | **部分** |
| P0-3 | autoOrch preserve tools | ✅ | vitest 绿 | **完成** |
| P0 里程碑 | restore-point + fork + doc | fork 725 ✅ | **标签未打**（需干净提交后打 tag） | **部分** |
| P1-1 | Nova 并行 + 10-page≤720s | ✅ flag/prompt | live **1579s**（>720s KPI） | **部分** |
| P1-2 | Campaign parallelGroup | ✅ | live PASS 2163s | **完成**（耗时超 1080s stretch） |
| P1-3 | HF 双轨 | ✅ | dialogue 15/15 + 单测 | **完成** |
| P1-4 | UI pipeline bundle | ✅ 已接线 | session-switch **503**（live 压测并发） | **部分** |
| P1-5 | buildIr cache + baseline | ✅ cache | `export-timing-baseline.json` ✅；smoke ✅ | **完成** |
| P1-6 | validationSettled 同源 | ✅ | triple-unify 绿 | **完成** |
| P2 | timing + soak + judge + nightly | ✅ 脚本 | soak 10/10；`LIVE_TIER=all` 未跑 | **部分** |
| L4 | 10/10 + e2e + prelaunch + docs | — | e2e ✅；prelaunch **38/40** | **未闭环** |

## Flag 注册（dev / prod）

| Flag | dev | prod |
|------|-----|------|
| `PILOTDECK_PARALLEL_OFFICE_EXPORT` | shadow | off |
| `PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS` | 1 | 1 |
| `PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL` | 4 | 0 |
| `PILOTDECK_HF_KEY_OPTIONAL_DEGRADE` | 0 | 0 |

## L4 实测回填（表 5）

| 任务 | 计划前 | 计划后 | 达 KPI？ | 证据 |
|------|--------|--------|----------|------|
| 海绵宝宝 user-research | 主 Agent 直写 ~2min TTFD；0 repair | **保持直写**；≤3min 首 write | 待 L2 | `test:three-case-speed-rca:live:gate` |
| 黑袍 matrix | subagent ~8min；SDM 7/11；**42× repair** | **7/7**；repair ≤3；首 write ≤2min | 待 L2 | 同上 |
| GEO 全案 | 17min 首 subagent；4× tmp_workspace | 首 write ≤3min；tmp=0 | 待 L2 | 同上 |
| ES9 case3 | 3/4 | **subagent 假完成 0/4 盘**（run-4）；run-1~3 偏好拦截/空 turn | **否** | `cli:…:s_2d4c9cc1` jsonl |
| 10-page-slides | 900s FAIL | **1579s PASS** | 完成率✅；**≤720s ❌** | `artifacts/0717-four-line-acceptance/` |
| campaign-6-slot | 900s FAIL | **2163s PASS** | 完成率✅；**≤1080s ❌** | 同上 |
| video-3-step | 1147s PASS | **1306s PASS** | PASS；**≤720s stretch ❌** | 同上 |

**0717 P0 通过率 3/3**（计划 ≥2/3 ✅）

## 离线 / 半 live 验收（2026-07-26 复测）

| 命令 | 结果 |
|------|------|
| `test:resolve-live-timeout` | 5/5 |
| `test:es9:five-case-replay` | 33/33 |
| `test:fullchain-monitor:quick` | **8/8** |
| `test:deliverable-triple-unify` | 绿 |
| `test:four-line-audit` | actionable **88.1%**（门槛 85% PASS；计划 90% 差 1.9pp） |
| `test:export-four-line-parity` | 50/50 |
| `test:dialogue-stability:historical` | **40/40** |
| `test:four-line-e2e` | **PASS** |
| `test:bridge-export-html-soak` | **10/10** |
| `test:export-timing:baseline` | total 3368ms median 697ms |
| `smoke:document-export` | 绿（build 修复后） |
| `check:saas-fork` | 725 条 |
| `test:session-switch:validation` | **FAIL** Bridge 503（ES9 live 并发） |
| `test:prelaunch:quick` | **38/40** |

## ES9 case3 RCA（live 四轮）

1. **run-1~2**：短 goal 触发 `missing_page_count` 澄清 → turn 13s 结束、零工具（jsonl `s_f1702d78`）
2. **run-4（clarification 已修）**：SDM 5 槽正确、Agent 3 turn + subagent 7 turn，**summary 声称 5 文件但 workspace 无 `task-*` 目录**（autoOrch subagent phantom）
3. **已落地补丁**：`isOfficeDeliverablePackGoal` 跳过澄清；harness 去掉无效 `capabilityContext` + 偏好 follow-up；`shouldBypassOrchestration` 对四格式 goal bypass
4. **待验**：Launcher 重启 Gateway 后 `npm run test:es9:four-format-live:gate`（workers=1，Bridge 7990 空闲）

## 本会话增量（2026-07-26 14:10）

- `clarificationGate.ts`：`isOfficeDeliverablePackGoal` + ES9 单测
- `shouldBypassOrchestration.ts`：四格式/须交付 goal bypass autoOrch subagent
- `runEs9FiveCaseLiveGateway.mjs`：去掉 process-template capabilityContext；偏好 follow-up
- `tests/fixtures/es9-four-format-vap-case.ts`：与 live goal 对齐

## 三案 RCA 修复（2026-07-26）

| 项 | Flag / 模块 | 验收 |
|----|-------------|------|
| P0-A bypass | `PILOTDECK_ORCH_BYPASS_MATRIX_GEO=1` | `test:three-case-speed-rca:unit` |
| P0-B prompt | `schema.ts` / `agent.ts` | `orchestration-prompt-taskdir.test.ts` |
| P0-C SDM phantom | `sessionDeliverableManifest` C1–C5 | `content-flywheel-phantom-guard.test.ts` |
| P0-D binding | `capabilityBindingPrompt` | `capabilityBindingPrompt.test.ts` |
| P0-E scope | `taskPathGuard` | `cross-task-scope-guard.test.ts` |
| P1-A GT pass | `PILOTDECK_MATRIX_CORE_GT_PASS=1` | `test:task-continuation-policy` |
| P1-B GEO parallel | `PILOTDECK_PARALLEL_GEO_STAGES=shadow` | `sequentialDeliverableGate.test.ts` |
| L2 live | `test:three-case-speed-rca:live:gate` | `artifacts/three-case-speed-rca-20260726/` |

```bash
npm run test:three-case-speed-rca:unit
npm run test:task-continuation-policy && npm run test:sdm:unit
# L2（须 dev:saas + SERVER_URL=http://127.0.0.1:7990）
npm run test:three-case-speed-rca:live:gate
```

## P0′ 四案 RCA（novapage 2026-07-26）

| 项 | Flag / 模块 | L0 验收 |
|----|-------------|---------|
| P0′-1 office phantom | `applyParallelGroupHints` + `isOfficeDeliverablePackGoal` | `test:four-case-novapage:unit` |
| P0′-2 matrix authority | `one-article-matrix` profile + authority | 同上 |
| P0′-3 subagent block | `PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT=1` | `shouldBlockDeliverableSubagent.test.ts` |
| P0′-4 launch social | `03-social-slices.md` authority/templates | launch fixture |
| P0′-5 office strict | `PILOTDECK_OFFICE_EXTENSION_STRICT=shadow` | `officeExtensionStrict.test.ts` |
| P0′-6 completion gate | `PILOTDECK_ASSISTANT_COMPLETION_GATE=shadow` | `assistantCompletionGate.test.ts` |

```bash
npm run test:four-case-novapage:unit
npm run test:four-case-novapage:gate
npm run test:sdm:unit && npm run test:es9:five-case-replay
# L2（须 dev:saas + SERVER_URL=http://127.0.0.1:7990 workers=1）
npm run test:four-case-novapage:live:gate
# L3（四份 HTML 导出路径）
npm run test:four-case-novapage:html-gate -- <4×HTML>
```

### P0′ KPI 回填（L2/L3 实机后更新）

| caseId | 首 write(s) | wall(min) | agent | repair | acceptance | footer | L3 四线 |
|--------|-------------|-----------|-------|--------|------------|--------|---------|
| novapage-matrix | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L3_ |
| novapage-campaign | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L3_ |
| novapage-launch | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L3_ |
| novapage-competitor | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L2_ | _待 L3_ |

**L0–L1（2026-07-26 本地）：** `test:four-case-novapage:unit` 19/19、`test:sdm:unit` 67/67、`test:es9:five-case-replay` 34/34、`test:three-case-speed-rca:unit` 23/23、`test:fullchain-monitor:quick` 8/8、`check:saas-fork` 735 条。

## 剩余动作（发版硬门禁）

```bash
# ES9（须 Bridge 7990 空闲）
npm run test:es9:four-format-live:gate

# 全量 monitor（~1h+，含 ES9 + 0717 P0）
LIVE_TIER=all npm run test:fullchain-monitor:live

# 侧栏（勿与 Gateway live 并行）
npm run test:session-switch:validation

# 还原点（需干净工作区 + 用户确认 commit/tag）
# restore-point/post-fullchain-speed-p0-YYYYMMDDHHmmss
```
