# 0731 三案假 incomplete 加固 — 验收报告

## 裁决

**离线门禁全绿（L0–L3）+ Gateway 实机三案已跑（L4）+ 事后 reassert PASS。**  
侧栏 HTML 再导出未做（本批取证权威为 `artifacts/four-line-0731-fail-live/*.json` + offline `slotSatisfied`/`gate`）；禁止把「侧栏 HTML 四分」与本批 CLI 证据混称同一物。

## G0 还原点

- Tag: `restore-point/pre-four-line-false-incomplete-20260731232121` @ `f7e06aa1`
- 基线：`npm run test:sdm:unit` PASS；`npm run test:four-line-0731:offline` PASS

## 失败 RCA（HTML 权威 · Downloads 只读清单）

| 案 | session / task | Downloads HTML（文件名短尾） |
|---|---|---|
| B 小米蒸馏 | `6a26960f` / `task-20260731-e7734d77` | `web-s_6a26960f-…-2026-07-31.html` |
| C Nike IP | `e3610dee` / `task-20260731-5b0416fd` | `web-s_e3610dee-…-2026-07-31.html` |
| A PWA | `cbf12232` / `task-20260731-d6ad62e2` | `web-s_cbf12232-…-2026-07-31.html` |

成功锚点（禁改）：`c6255800` / `19b116f0` / `54dc633c` / `484856c2` / `43ddcfc7` / `9bb3d7c1`

## 改动摘要

| PR | 内容 |
|---|---|
| P0-1 | `writingStyleDistillAliasSatisfied` 认 `methodology`；`buildWritingStyleDistillSlots` 去掉无条件 `wuxiaobo-writing-os.md`，吴晓波 subject 保留；追加 `${subjectSlug}-methodology.md` |
| P0-2 | 策略/社媒 hints：`内容策略.md`/`copywriting.md` + English legacy `strategy.md`/`copy-matrix.md`；sanitize 拒 `策略 .md` |
| P0-4 | distill 主槽同 gap≥3 且 verified 无净增 → `repairCircuit.tripped`（Campaign 阈值不动） |
| P0-3 | `PILOTDECK_OPEN_HTML_MIN_SDM` 默认 **off**（三处同步）；shadow 仅 telemetry；完成话术门控 + 禁 `artifacts/**` 扫盘复用 |

## Flag 三处同步

| Flag | pack / apply-cloud-perf / devLauncherCore |
|---|---|
| `PILOTDECK_DISTILL_SDM` | shadow（不改） |
| `PILOTDECK_ASSISTANT_COMPLETION_GATE` | shadow（不改） |
| `PILOTDECK_OPEN_HTML_MIN_SDM` | **off** |

## 门禁结果

| Gate | 命令 | 结果 |
|---|---|---|
| L0 | vitest authority / sdmSlotMatching / assistantCompletionGate / sessionRepairCircuitBreaker | **PASS** |
| L0′ | `npx vitest run tests/saas/four-line-0731-success-regression.test.ts` | **PASS（6/6）** |
| L1 | `test:sdm:unit` + `test:four-line-0731:offline` + `check:saas-fork` + `brand:check` | **PASS**（fork 812） |
| L2 | `npm run test:four-line-0731-fail:offline` | **PASS**（B/C `false_incomplete=0`；A `gated=true`） |
| L3 | `test:export-four-line-parity` + `test:four-line-audit` | **PASS** |
| L4 live | `node --import tsx scripts/run-four-line-0731-fail-live-gate.mjs --gate` | 首跑 assert 2 红（C/A 断言过严 / hints 缺 `strategy.md`·`copy-matrix.md`） |
| L4 reassert | `node --import tsx scripts/reassert-four-line-0731-fail-live.mjs` | **PASS**（补 hints 后对同一 writes 复验） |

证据目录：`artifacts/four-line-0731-fail-live/`（含 `reassert-summary.json`）。

## L4 四分取证表（CLI Gateway 实机 · 非侧栏 HTML）

| 案 | 助手 | footer/槽匹配 | 证书 | 文件夹 | 判定 |
|---|---|---|---|---|---|
| B | 无硬「全部完成」收口（snippet 为执行中叙事） | `*methodology*` 命中 distill alias | `acceptance=null`（CLI 未落证书） | `task-20260731-b95f38bc/…/02-methodology-playbook.md` | **匹配绿**；证书未 enforce |
| C | 计划/阶段叙事 | `strategy.md`+`copy-matrix.md` → 策略/社媒槽 `slotSatisfied=true` | `needs_repair`（长文×2 等其它槽仍可能缺口） | `task-FL0731-NIKE-IP/` | **策略/社媒假 incomplete 已消**；整案非 passed |
| A | 过程中有「完成全部交付物」软词 | 硬收口 claim → `gate.gated=true` | `needs_repair`（无 min SDM enforce） | `task-20260731-5c925539/index.html` | **门控绿**；文件在 task-* |

## KPI 回填

| KPI | 命令/来源 | 目标 | 实数 |
|---|---|---|---|
| false_incomplete B/C | `test:four-line-0731-fail:offline` + live reassert | 0 | **0**（offline + reassert） |
| distill repair 次数 B | live JSONL / harness | →0 或 trip 后停 | live 单轮写盘 methodology，**未见 repair 风暴**（`durationMs≈339s`） |
| IP 假 blocked C | 策略/社媒槽匹配 | 0（或槽已绿） | **策略+社媒匹配绿**；整案 `needs_repair`（非假 incomplete 根因） |
| assistant_completion_gate A | fail offline + reassert | ≥1 shadow/block | **gated=true** |
| success regression | L0′ | 6/6 | **6/6** |
| userTurns B | live harness | 不因假 incomplete 暴涨 | **单 submitTurn**（`maxTurns` 内收敛） |

## 回滚

- 新 flag：`PILOTDECK_OPEN_HTML_MIN_SDM=off`（默认）或不注入
- P0-1/2/4：回退至 `restore-point/pre-four-line-false-incomplete-20260731232121`

## 完成宣称边界

- ✅ 假 incomplete（methodology / 策略·社媒 pathHints / 完成话术门控）已用离线门禁 + live writes reassert 证明
- ⚠️ 未做 admin 侧栏 HTML 再导出四分；若需与历史 Downloads HTML 同形态归档，请在 `0731-FalseIncomplete` 项目导出后追加
- ⚠️ C/A 整案 `acceptance=passed` **未**宣称（OPEN_HTML_MIN_SDM 保持 off；C 其它槽可能仍 incomplete）
