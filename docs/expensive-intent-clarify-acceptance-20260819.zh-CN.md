# 贵意图冲突 · 保险丝问一次验收（2026-08-19）

> 对应计划：`docs/expensive-intent-clarify-plan-20260819.zh-CN.md`  
> 还原点：`restore-point/pre-expensive-intent-clarify-20260819203348` @ `c8380204`  
> 裁决：**GO(shadow)** / **不得生产 GO**  
> 原因：准入 + 问一次 + 下一句 fail-open 已实机；默认注入仍是 shadow。enforce 仅作旁路 Gateway 实机，未改三处注入为 enforce。禁止把本报告写成生产 GO。

---

## 审阅冲突闭环

| # | 冲突 | 落地 |
|---|---|---|
| R1 | `resolveClarificationGoal` 回放 DUAL 再问 | admit 用 `latestUserRaw`；再问只看指纹 / `expensiveIntentHandled` |
| R2 | 缺 Key「继续」仍 pending | 仅本指纹其后任意用户回复合；缺 Key 单测保留 |
| R3 | 单进程不能切 shadow/enforce | A 趟 launcher `18789`；B 趟 spawn `19891` + `enforce` |
| R4 | 循环 import | `expensiveIntentConflict.ts` 不 import `clarificationGate.ts` |
| R5 / R8 | DUAL + `resolveProfile(anchor)` 幻影 ppt | **未改** `resolveProfile`；repair 调用点优先 `sessionManifest.profileId` |
| R6 | `shouldAsk*` 双轨 | 未引入；只留 admit |
| R7 | 标题「需要补充一点信息」 | 本指纹 notice 标题「需要你选一下」 |
| R10 | 裸 `2` 当页数 | pending 下裸 `2` = 选项 B |

---

## 修改前 / 修改后 / 风险

| 项 | 修改前 | 修改后 | 风险 |
|---|---|---|---|
| 点名 md +「另外做成一份PPT」 | 可能绑 ppt 或空转问卷 | enforce 停问一次；shadow 只打点、不停 turn | 用户回「？」后模型仍可能按原文想做 PPT（anchor 不改写，C5）；清单 profile 已不是 ppt |
| 问完回继续 / ？ / 乱回 | 页数问卷空转 | 关保险丝 keep，禁止再问 | 听不懂记 `unparsed_reply` 打点，仍推进 |
| 真周会 PPT | 与冲突稿抢同一路径 | 无冲突、不问、`profileId=ppt` | 无 |

---

## Flag 三处同步

| 键 | 代码 unset | 注入默认 | 本批 |
|---|---|---|---|
| `PILOTDECK_EXPENSIVE_INTENT_CLARIFY` | `off` | `devLauncherCore` / `pack.mjs` / `apply-cloud-perf-env.sh` = **shadow** | 未改成 enforce |

回滚：三处改为 `off`，或 `git reset --hard restore-point/pre-expensive-intent-clarify-20260819203348`。  
enforce 若再出现二次提问或「继续/？」后仍 pending：**立刻关 enforce 退 shadow**。

---

## 验收分级

| 级 | 命令 | 结果 |
|---|---|---|
| L0 | `npm run test:expensive-intent:unit` | **PASS** 6 files / **129** tests |
| L0′ | `npx vitest run tests/saas/task-continuation-policy.test.ts`（含在 L0） | **PASS**；R8 DUAL+SDM 不幻影 ppt repair |
| L1 | `npm run test:deliverable-triple-unify` | **PASS** |
| L1′ | `tests/saas/clarification-gate.test.ts`（含在 L0） | **PASS**；「生成PPT」仍 preference |
| L2 | Bridge `7990` + 两趟 Gateway | A-shadow **2/2**；B-enforce（SDM=1）**7/7**；`reask=0` |
| L2′ | sticky 三案，项目 `sticky-stage-20260819` **未 teardown** | **hard 3/3**；ZHIHU `profileId=default` |
| L3 | `shouldTriggerDeliverableRepair` 单测 | 返回值不变（L0′） |
| L4 | `.saas-dev-data/telemetry/stability-events.jsonl` | 见下；token **n/a** |

`check:saas-fork`：本批已登记 `expensiveIntentConflict` 模块 / AgentLoop / compile overlay。

---

## L2 实机（2026-08-19）

- Bridge：`http://127.0.0.1:7990` ready（postgres）
- Gateway A：launcher **18789**，`PILOTDECK_EXPENSIVE_INTENT_CLARIFY=shadow`
- Gateway B：spawn **19891**，`enforce` + `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`
- 项目：`workspaces-expensive-intent-20260819`（展示名 `expensive-intent-20260819`），**禁止 teardown**
- 权威 KPI：
  - A 趟：`artifacts/expensive-intent-clarify-20260819/kpi.jsonl`
  - B 趟：`artifacts/expensive-intent-clarify-20260819/enforce-sdm/kpi.jsonl`
  - sticky：`artifacts/expensive-intent-clarify-20260819/sticky-retest/kpi.jsonl`

首趟 B spawn 未注入 SDM 开关，jsonl 无 `profileId`，`EI-TRUE-PPT` 假红。脚本已补 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1` 后重跑 B 趟，下表以重跑为准。

| 案 | 趟 | 硬门禁 | 结果 | wallClockMs | asked | pending | profileId | 备注 |
|---|---|---|---|---|---|---|---|---|
| EI-ZHIHU | A shadow | 不问且 ≠ppt | PASS | 144936 | 0 | false | **default** | 缺席投诉不问 |
| EI-DUAL-SHADOW | A shadow | 不停 | PASS | 132068 | 0 | false | ppt | shadow 允许绑 ppt；有 `_shadow` 点 |
| EI-DUAL-ENFORCE | B enforce | 问一次 | PASS | 4767 | **1** | true | default | `purpose=user_action_required`；无 pptx 写盘 |
| EI-DUAL-CONTINUE | B 同 session「继续」 | 不再问、≠ppt、pending=false | PASS | 37714 | 0 | **false** | default | parentAsked=1；`_resolved` keep |
| EI-DUAL-QMARK | B 「？」 | 同上 | PASS | 31681 | 0 | false | default | `_fallback` unparsed + keep；未二次提问 |
| EI-DUAL-GARBAGE | B 「啊？」 | 同上 | PASS | 85132 | 0 | false | default | 同上 |
| EI-DIRECT | B +直接开始做 | 不问、≠ppt | PASS | 180000 | 0 | false | default | 墙钟打满 timeout；未停问 |
| EI-TRUE-PPT | B | 不问且 =ppt | PASS | 27716 | 0 | false | **ppt** | 须交付 `.pptx` 非冲突 |
| EI-RESUME | B task-resume | 不得再停问 | PASS | 45825 | 0 | false | default | parentAsked=1 |

sticky 回归（未 teardown）：

| 案 | 结果 | wallClockMs | userTurns | profileId | 槽 |
|---|---|---|---|---|---|
| STICKY-HTML | PASS | 34429 | 1 | html | 2 |
| STICKY-SCRIPT | PASS | 20444 | 1 | script-md | 2 |
| STICKY-ZHIHU | PASS | 124987 | 1 | **default** | 3 |

对照同日 sticky 首跑 ZHIHU 曾误绑 `ppt`；本批回归为 `default`，`userTurns=1` 未膨胀。

---

## KPI（绑命令，实数）

| KPI | 命令 | 实数 |
|---|---|---|
| false_ask | EI-ZHIHU / STICKY-HTML | asked=0 / asked=0 |
| true_ask | EI-DUAL-ENFORCE | asked=1 |
| continue_default | EI-DUAL-CONTINUE | 二次 asked=0，profile=default，pending=false |
| qmark_unstuck | EI-DUAL-QMARK | 同上 |
| garbage_unstuck | EI-DUAL-GARBAGE | 同上 |
| stuck_reask | live 全案 | **reask=0** |
| direct_start | EI-DIRECT | asked=0，profile=default |
| true_ppt | EI-TRUE-PPT | profile=ppt，asked=0 |
| repair 语义 | L3 | 不回归 |
| userTurns 非冲突案 | sticky | HTML/SCRIPT/ZHIHU 均为 **1** |
| token | 各案 usage | **n/a** |

---

## L4 打点

读 `.saas-dev-data/telemetry/stability-events.jsonl`（本批 live 窗，禁止用更早单测行冒充墙钟）：

| 事件 | 有无 | 证据 |
|---|---|---|
| `expensive_intent_conflict_shadow` | 有 | A 趟 DUAL 窗口，`ask:false` `stripped:false` |
| `expensive_intent_conflict_asked` | 有 | `s_b408d5f0-…`（EI-DUAL-ENFORCE）`mode=enforce` `ask:true` |
| `expensive_intent_conflict_resolved` | 有 | CONTINUE 后 `chosen=keep_must_deliver` |
| `expensive_intent_conflict_fallback` | 有 | 「？」/「啊？」/`task-resume` → keep + `unparsed_reply`（预期，不是再问） |

---

## 残留（不挡 GO(shadow)）

1. **C5**：`sessionGoalAnchor` 仍是用户原文。问完回「？」后助手正文可能仍说「三样都要含 PPT」，但 **不再弹出保险丝**，SDM `profileId=default`。这是计划锁死的「不改写 anchor」。
2. B 趟独立 Gateway **必须**带 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`，否则无 jsonl profile（已写入 live 脚本）。
3. 默认注入保持 **shadow**。未达到生产 GO。

---

## 回滚

1. 三处 `PILOTDECK_EXPENSIVE_INTENT_CLARIFY=off`  
2. `git reset --hard restore-point/pre-expensive-intent-clarify-20260819203348`  
3. enforce 空转或二次提问：关 enforce，先修准入/fail-open  
