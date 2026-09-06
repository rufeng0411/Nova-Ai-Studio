# 格式词 ≠ 必交格式 · 验收（2026-08-20）

> 执行计划后填实数。token 读不到写 **n/a**。  
> 本批最多 **GO(shadow)**。不得生产 GO。  
> shadow **不能**证明 CASE_12FC6055 已不再编 pptx；该项只认 **L2 B enforce**。

还原点 tag：`restore-point/pre-kind-mention-sanitize-20260820023824`

## L0

命令：`npm run test:kind-mention:unit`

结果：**7 files / 96 tests PASS**（2026-08-20 02:47）

| 项 | 结果 | 备注 |
|---|---|---|
| goalKindSanitize 冻结句 | PASS | 12FC6055 无祈使 pdf/pptx |
| taskGoalContract 周会/12 页 PPT | PASS | 既有用例仍绿 |
| html+docx+pdf 并行 kinds | PASS | enforce 下仍 `html,docx,pdf` |
| CASE_12FC6055 enforce 无 pdf/pptx | PASS | |
| CASE_12FC6055 off 仍可有办公 kinds（回滚基线） | PASS | shadow 同 legacy |
| expensiveIntent DUAL/STICKY | PASS | 本批未改保险丝语义 |
| builtinToolNameGuard | PASS | `read_skill export_document` 重定向 |
| stabilityFlags unset=off | PASS | 1/shadow/enforce 三态 |

## L1

命令：`npx vitest run src/saas/deliverableCapabilityProfiles.script-intent.test.ts`

结果：**PASS**（与 L0 同批 113 tests 含此文件）

## L2 A shadow

Bridge：`http://127.0.0.1:7990`  
命令：`SERVER_URL=http://127.0.0.1:7990 KIND_LIVE_PASS=all npm run test:kind-mention:live`  
项目：`kind-mention-20260820`（未 teardown）  
产物：`artifacts/kind-mention-sanitize-20260820/`

| 案 | 办公槽 | 贵意图问 | `kind_mention_sanitize_diff` | 备注 |
|---|---|---|---|---|
| KM-12FC | 仍有 `required_pdf_1`/`required_pptx_2` | 0 | 有（shadow 打点） | 符合 shadow 不改槽 |
| KM-TRUE | pptx / `presentation.pptx` | 0 |  | profile=ppt |
| KM-WEEKLY | 中文名 + `presentation.pptx` | 0 |  | |
| KM-ZHIHU | 无 presentation.pptx；有 01-topics.md | 0 |  | |
| KM-DUAL | 须交付 md；不问 | 0 |  | 首跑误因 profile=ppt 判红；复判 asked=0 为 PASS |
| KM-SOURCE | 本趟无 SDM | 0 |  | 允许仍有 pdf；本趟未编槽 |

## L2 B enforce

spawn：`PILOTDECK_KIND_MENTION_SANITIZE=enforce` + `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1` + `PILOTDECK_SDM_PARSE_MUST_DELIVER=1`（端口 19892）

| 案 | 办公槽 | 贵意图问 | 其它 |
|---|---|---|---|
| KM-12FC | **无** required_pdf / required_pptx（slotIds=[]） | 0 | 无飞轮 01-topics 三槽 |
| KM-TRUE | pptx；hints 含 presentation.pptx | 0 | |
| KM-WEEKLY | pathHints 含 presentation.pptx | 0 | |
| KM-ZHIHU | 含 01-topics.md；无 presentation.pptx | 0 | |
| KM-DUAL | 须交付 md；不问 | 0 | 与保险丝 shadow 一致 |
| KM-SOURCE | **无** report.pdf | 0 | |

## L3 用户可见

| 项 | 结果 |
|---|---|
| 无本机转换/LibreOffice/npm 甩锅 | PASS（产物与预览未出现） |
| 无 SDM 槽 id 外露 | PASS（助手预览为人话） |

## L4 telemetry

路径：`.saas-dev-data/telemetry/stability-events.jsonl`

| 事件 | shadow 次数 | enforce 次数 |
|---|---|---|
| `kind_mention_sanitize_diff` | 3 | 10 |
| `read_skill_builtin_redirect` | 合计 3（未分 mode） | 合计 3 |
| tokens in/out | n/a | n/a |

末条 enforce：`from=pdf,pptx` → `to=`（空），对应该案消毒后不再编办公 kind。

## 裁决

- [x] GO(shadow)（2026-08-20 预览档）
- [x] **dev/pack 默认改为 enforce**（2026-08-20 用户下令止血；回滚 `PILOTDECK_KIND_MENTION_SANITIZE=shadow` 或 `off`）
- [ ] NO_GO

历史已 lock 会话不回写，须新开对话。云端须重启/recreate 后注入才生效。
