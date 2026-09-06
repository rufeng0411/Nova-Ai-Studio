# 工作台良品率对齐 — 验收记录（2026-08-05）

## 执行序（已落地）

1. Step0 还原点：`restore-point/pre-workbench-yield-align-20260805093545` @ `54da83ce`
2. P0-C Hub try-prompt / `SLUG_EXTRA` / `capabilities:gen` + `check:task-dir-prompts` OK
3. P0-A `deliverableBriefContract`（flag `PILOTDECK_DELIVERABLE_BRIEF_CONTRACT`）
4. P0-B `inferCapabilityContext`（flag `PILOTDECK_INFER_CAPABILITY_CONTEXT`）
5. P0-D pack / apply-cloud-perf / devLauncher 三处同步；SEQUENTIAL pack=`shadow`；禁 soft-pass 门禁单测
6. P1 profile `maxTurnsHint` + Hub 视频/HF 缺 Key 降级句

## Flag 默认

| Flag | pack | apply-cloud-perf | dev |
|------|------|------------------|-----|
| `PILOTDECK_DELIVERABLE_BRIEF_CONTRACT` | shadow | shadow | enforce |
| `PILOTDECK_INFER_CAPABILITY_CONTEXT` | shadow | shadow | shadow |
| `PILOTDECK_SEQUENTIAL_DELIVERABLES` | shadow | shadow | 1（enforce） |
| `PILOTDECK_TRY_PROMPT_CONTRACT_V2` | 1 | 1 | 1 |
| `GOAL_QUALITY` / `CAPABILITY_SCOPE` | 保持 shadow | shadow | 不变 |
| `OFFICIAL_MEDIA_V2` | off | off | 不变 |

## L0–L4

| 级 | 状态 | 证据 |
|----|------|------|
| L0 | PASS | `deliverableBriefContract.test.ts` / `inferCapabilityContext.test.ts` / `noSoftPassFourLine.guard.test.ts` / try-contract node test；`test:sdm:unit`；`test:task-continuation-policy` |
| L1 | PASS | `capabilities:gen` + `check:task-dir-prompts`；三处 flag 键名已同步 |
| L2 | PASS | `test:three-case-speed-rca:gate`；`test:deliverable-triple-unify` |
| L3 | PASS | Playwright 四案 `WORKBENCH_YIELD_LIVE=1` → `artifacts/workbench-yield-L3/report.json`（admin 项目 `workbench-yield-L3`，禁 teardown） |
| L4 | 未回填 | telemetry：`brief_contract_compiled` / `capability_context_inferred` / `sequential_gate_shadow`；**未回填实数前不得宣称生产闭环** |

### L3 实机明细（2026-08-05）

| 案 | 结果 | 要点 |
|----|------|------|
| Hub 试一下 od-saas-landing | PASS | 预填含「须交付：index.html」；SDM 槽位 index.html；`capabilitySlug=od-saas-landing` |
| 自由文本官网 | PASS | brief contract enforce 后槽位 index.html；**锚点无合成「须交付」**（R1/R2） |
| 自由文本一稿多平台 | PASS | matrix basename / 非 flywheel 幻影 |
| 问候负例 | PASS | 无交付 SDM、无推断 binding |

命令：`npm run test:workbench-yield:l3:live`（或 `WORKBENCH_YIELD_LIVE=1 npx playwright test ui/e2e/saas/workbench-yield-l3-live.spec.ts --workers=1`）。  
注：Gateway 须带 `PILOTDECK_DELIVERABLE_BRIEF_CONTRACT=enforce`（devLauncher 默认）；仅 shadow 时自由文本官网会退化为 research 槽。

## 回滚

分钟级 env：`PILOTDECK_DELIVERABLE_BRIEF_CONTRACT=off`、`PILOTDECK_INFER_CAPABILITY_CONTEXT=off`、`PILOTDECK_SEQUENTIAL_DELIVERABLES=0`、`PILOTDECK_TRY_PROMPT_CONTRACT_V2=0`。
