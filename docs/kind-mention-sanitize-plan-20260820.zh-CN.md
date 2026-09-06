# 格式词 ≠ 必交格式 · 细则（2026-08-20）

> **Build 入口**是 Cursor 计划卡 [`.cursor/plans/格式词不等于必交格式_20260820.plan.md`](../.cursor/plans/格式词不等于必交格式_20260820.plan.md)。本文是事故取证与冻结句细则，**不是** Build 入口。  
> 未经用户明示：**禁止 commit / 禁止 pull 上游**。预览档曾不得生产 GO；**2026-08-20 用户下令**将 `PILOTDECK_KIND_MENTION_SANITIZE` 默认改为 **enforce**。

## 1. 事故（用户 HTML 导出为权威）

- 会话：`web-s_12fc6055-3855-4b19-baa0-bf38fa6c66d7`
- 导出时间：`2026-08-19T18:22:59Z`（北京 2026-08-20 02:22）
- 任务目录：`artifacts/task-20260820-2b13bbb3`
- 冻结清单：`required_pdf_1`=`report.pdf`，`required_pptx_2`=`presentation.pptx`，`universal_data_sources` 已 done
- `profileId=default`，`baselineLocked=true`，`goalVersion=1`
- 证书：`acceptanceStatus=failed`，`completionState=blocked`，`requiredDone=0/2`，`blockedReasonType=system_exhausted`，`repairCircuit.tripped`，gap `sdm:required_pdf_1|required_pptx_2`
- 盘上已有中文选题 md/html/pptx，但 hint 是英文泛名，**对不上**（禁止用 kind-only 吞并来「修」）

用户原意：知乎系列选题 5 期。  
「PDF 中的…」「在 PPT 里没有展示」= 说明附件里缺这两段产品信息，不是要交 PDF/PPT。

时间线（导出）：约 01:16 已写选题 md → 01:18 起被当成要补 PPTX → 02:10 熔断后让用户本机转换（不允许）。

## 2. 代码锚点

| 符号 | 路径 |
|---|---|
| `inferExpectedKinds` / `inferExplicitOutputKinds` | `src/saas/taskState/taskGoalContract.ts` ~178–246 |
| kinds 回退编 `required_${kind}_*` | `src/saas/taskState/sessionDeliverableManifest.ts` ~590–622 |
| `stripNegatedDeliverableMentions` / `PPT_ABSENCE_COMPLAINT_SPAN` | `src/saas/deliverables/deliverableChecklistAuthority.ts` |
| `defaultPathHintForKind` | `src/saas/deliverables/sdmSlotMatching.ts` |
| `kindMatchAllowed`（有 pathHint 则为 false） | 同上 |
| `resolveSuggestedBasename` | `src/saas/deliverables/deliverableFilenamePolicy.ts` |
| PPT recovery 把 export_document 写成 skill 后置 | `src/agent/loop/toolFailureRecovery.ts` ~116 |
| 真工具 | `src/tool/builtin/exportDocument.ts` |
| `read_skill` | `src/tool/builtin/readSkill.ts` |
| 贵意图保险丝（**本批禁止扩**） | `src/saas/intent/expensiveIntentConflict.ts` |

`compileSessionDeliverableManifest` 在 kinds 回退时传入 `buildTaskGoalContract({ userGoal })` 用的是 **原始** `userGoal`（不是 fuse `compileGoal`）。本案保险丝本来就不会剥这段。修复必须打在 `inferExpectedKinds`，让所有 contract 调用方同源。

## 3. 为什么保险丝问一次救不了

指纹 `expensive_intent:ppt_vs_named_files` 要求：剥完后仍有 **须交付非 pptx 文件** **且** **祈使做成 PPT**。  
本案既无「须交付：01-topics.md」，也无「另外做成一份PPT」。硬套会：误问、或误剥真周会 PPT。

## 4. 三轨（互不替代）

1. **格式提及消毒 + 办公 kind 祈使门**（止血主轨，flag 控制编译）
2. **真办公槽 pathHints 中文+legacy**（防止再出现「做了中文 pptx 仍红」）
3. **内置工具名不得走 read_skill**（always-on 文案/拦截；不靠本 flag）

## 5. 历史会话

已 `baselineLocked` 的 12fc6055 **不要**自动翻槽。新逻辑只作用于新 compile。用户需新开对话复跑选题。

## 6. 验收项目

- 项目名：`kind-mention-20260820`
- 产物：`artifacts/kind-mention-sanitize-20260820/`
- **禁止 teardown**
- L2 spawn 必须 `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1`
