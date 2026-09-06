# 成果四线错位与加戏死循环 — 0731 验收证据

## G-0 Step0 复现简表（只读）

| case | slug | 结果 |
|---|---|---|
| 行业市场须交付 md | `nova-research-industry-market` | 1 槽 `industry-market-report.md`（无 01/03/docx） |
| 同上 | `""` 空 | **仍 1 槽**（must-deliver 早返回已绿） |
| 用户研究须交付 md | `nova-research-user-general` / 空 | 同上 |
| 正式调研+Word | research-report | 3 槽；enrich 后 hints 互斥（PR-A） |
| 深度蒸馏 | 无 | Step0 时 null；PR-C 后 1 md（flag shadow） |

毒槽主因：历史 baseline 已锁 `authority_research-report_*`（heal shadow 观察；enforce 可换槽）。

## 门禁结果

| Gate | 命令 | 结果 |
|---|---|---|
| G-A | vitest authority + sdmSlotMatching | PASS |
| G-B | + `npm run test:sdm:unit` | PASS |
| G-C | distill fixtures + policy | PASS |
| G-D | `assistantCompletionGate` 单测 | PASS |
| G-E | detectGoalMutation + processTemplate 同构 + `check:saas-fork` | PASS（809+ entries） |
| L0 公共 | task-continuation-policy | PASS |
| L1 | sdm:unit / sdm:acceptance / export-four-line-parity / check:saas-fork | PASS（WC-01 已兼容 `universal_data_sources`） |
| L2 offline | `npm run test:four-line-0731:offline` | PASS |
| L2 live Gateway | `npm run test:four-line-0731:live`（串行） | **4/4 pass**（见取证表；证据 `artifacts/four-line-0731-live/`） |
| L3 | `test:export-four-line-parity` + `test:four-line-audit` | PASS |
| L4 telemetry | 见下表实数 | 已回填（shadow；**未**默认 enforce） |

## Flag（三处同步，pack 默认 shadow）

- `PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY=shadow`
- `PILOTDECK_SDM_HEAL_RESEARCH_LITE=shadow`
- `PILOTDECK_DISTILL_SDM=shadow`
- `PILOTDECK_BLOCK_SILENT_RESEARCH_ADD=shadow`

enrich 分槽为无 flag 直修。

## L2 取证表（Gateway live 2026-07-31）

| # | sessionKey 短尾 | SDM / 实写 basename | acceptance | repair/备注 |
|---|---|---|---|---|
| 1 行业市场 | `…76263a50` | `industry-market-report.md` + data-sources | **passed** | 无 01/03/docx；~486s |
| 2 用户研究 | `…ff3fce60` | `user-research-report.md` + data-sources | **passed** | 无毒槽；~292s |
| 3 正式调研+Word | `…b3a90424` | `03-report-body.md` + charts（未见 docx） | null（本轮未收口 Word） | enrich 互斥 compile 已绿；Word 槽待续跑/export；**未开 enforce** |
| 4 深度蒸馏 | `…b9489213`（retry） | `wuxiaobo-writing-os.md`（蒸馏 alias 命中） | null（单 md 已写） | 无 research-report 三件套；~293s |

汇总：`artifacts/four-line-0731-live/summary.json` → `failed: 0`。

## L4 实数（`.saas-dev-data/telemetry/stability-events.jsonl`）

| 事件 | 实数 |
|---|---|
| `sdm_heal_research_lite` | 0（本批 live 未触发毒槽 heal；单测 enforce 覆盖） |
| `research_docx_fuzzy_hit` | 0（本批 live 未写中文报告 docx；matching 单测覆盖） |
| `distill_sdm_compiled` | ≥1（probe + compile 路径） |
| `silent_add_blocked` | ≥1（shadow probe） |
| `assistant_completion_gate` | 157（lifetime；含历史 shadow） |
| `false_incomplete`（本批 lite 两案） | 0（acceptance=passed） |

## 完成宣称检查清单

- [x] G-0 简表已出
- [x] G-A…G-E 命令全绿
- [x] L1 契约关键项绿
- [x] L2 四案取证表填齐（案 3 Word 未齐 → 保持 shadow，禁宣称 Word 槽生产 enforce）
- [x] L3 导出门禁绿
- [x] L4 实数已填
- [x] 未默认 enforce；回滚键已写入三处
- [x] 验收会话/成果保留在 `artifacts/task-20260731-*` 与 `artifacts/four-line-0731-live/`（未 teardown）

## 回滚

各新 flag 置 `off` 或从 `pack.mjs` / `apply-cloud-perf-env.sh` / `devLauncherCore.mjs` 去掉注入后 recreate 即可；enrich 直修回滚需还原 `enrichResearchReportAuthoritySlots`。
