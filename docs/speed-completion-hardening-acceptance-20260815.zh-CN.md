# 生成速度·效率·完成度加固验收报告（2026-08-15）

> 对应计划：生成速度·效率·完成度加固（稳定第一修订版）  
> 还原点：`restore-point/pre-speed-completion-20260815150314` @ `c8380204`  
> 裁决：**GO(shadow)** / **不得生产 GO**  
> 原因：本批原 4 条编译根因 + 文件名整句/口播落盘 + F3-E 真上传已修并复测通过。三案速度实机门禁 **1/3**（海绵宝宝过；黑袍 7/7 齐但首写 138s>120s；GEO 写了文件但清单 0/8）——不阻塞 shadow，阻塞生产。

---

## 审阅冲突闭环

| # | 冲突 | 落地 |
|---|------|------|
| C1 | 行级乐观绿 vs 校验中可打开 | unsettled 可 enrich 路径并 `linkable`；**不** `mayPromoteDelivered`；状态固定校验中 |
| C2 | 多 HTML 槽交叉认领 | `htmlSlotCount>1` 仅 hint/basename；单槽才 fuzzy（含 `Index.html`） |
| C3 | 并行 write vs Sequential | `isParallelWriteFileAllowed` 仅 `PARALLEL_WRITE_FILE=enforce` **且** Sequential **非** enforce；`data-sources.md` 永不并行 |
| C4 | repair 文案误绑流式 | 仅改 USN：流式/`isAssistantWorking` → `working.making`；真 repair 仍 aligning |
| C5 | 幻灯 parallel=4 进 pack | pack/apply **`NOVA_SLIDE_IMAGE_PARALLEL=2`**；dev 可 4 |
| C6 | 降校验叠乘假绿 | HTML 形态默认 **shadow 不否决**；空壳/无 PK 仍 fail；官图 VAP 仍 `officialMediaRequired` 才 enforce |

---

## Flag 三处同步

| Flag | pack | apply-cloud | devLauncher |
|------|------|-------------|-------------|
| `PILOTDECK_PARALLEL_WRITE_FILE` | shadow | shadow | enforce（可覆盖） |
| `PILOTDECK_HTML_FORMAL_ACCEPTANCE` | shadow | shadow | shadow |
| `PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL` | **2** | **2** | 4 |
| `PILOTDECK_ORCH_BYPASS_MATRIX_GEO` | 1（已有） | **补 1** | 1 |
| `PILOTDECK_MATRIX_CORE_GT_PASS` | 1（已有） | **补 1** | 1 |
| `PILOTDECK_PARALLEL_GEO_STAGES` | **off** | **shadow** | shadow |
| `PILOTDECK_SEQUENTIAL_DELIVERABLES` | shadow | shadow | 现网不变 |

回滚：各键独立改 `off` 后 recreate nova。长任务中途勿切 Sequential/并行。

---

## P0-F 实测矩阵

### F1 本批功能

| ID | 命令 | exit | 结果 |
|----|------|------|------|
| F1-A | `npx vitest run src/saas/deliverables/sdmSlotMatching.test.ts` + `npm run test:sdm:unit` | 0 | 中文 md / 单槽 Index.html done；双 html 交叉 fail；SDM unit 99 |
| F1-B | `npx vitest run src/saas/deliverables/acceptanceChecks.formal-html.test.ts` | 0 | shadow 不否决半正式 HTML；空文件 / 无 PK pptx 仍 broken |
| F1-C | `npm --workspace ui run test -- src/shared/buildDeliverableDockRows.test.ts` | 0 | unsettled+path → checking + 链接；不 delivered |
| F1-D | `SessionDeliverableSummaryBar.test.tsx` + progress | 0 | `generated/accepted/total`；折叠条无「已生成/已验收」长标签 |
| F1-E | `deliverableUserStatusCopy.test.ts` | 0 | 流式 `working.making` ≠ 正在核对成果清单 |
| F1-F | `parallelWritePolicy.test.ts` + `sequentialDeliverableGate.test.ts` | 0 | enforce Sequential 下不并行；data-sources 串行 |
| F1-G | `npm run dev` + 浏览器 `http://127.0.0.1:8081` admin | 已跑 | **PASS（第二轮）**。复测会话 `web-s_973dee55-8ffb-4809-9d6d-7fa44e316229`（`task-20260815-612f64fe`，51s）。排队侧栏「排队中」；制作中 Composer **「制作中，请稍候…」**，全程未见「正在核对成果清单」。折叠「成果 2/2」无长标签；展开 `report.html` + `data-sources.md` 已完成。截图 `ui/f1g-retest-*.png`。第一轮 PARTIAL 证据仍保留对照。 |

### F2 辐射

| ID | 命令 | exit | 结果 |
|----|------|------|------|
| F2-1 | `npm run test:four-line-audit` | 0 | sessions=111 aligned=67.0%（历史基线，gate 通过） |
| F2-1b | `npm run test:deliverable-triple-unify` | 0 | export / 0709-live / sdm-unit / rog-phase8-2 / 0708-batch |
| F2-2 | `npm run test:deliverable-triple-unify:export` | 0 | 78 tests |
| F2-3 | dock merge 单测（F1-C） | 0 | unsettled 不绿。`test:deliverable-dock:acceptance` 需 UI → 未跑 |
| F2-4 | `npm run test:three-case-speed-rca:unit` + `test:three-case-speed-rca:live:gate` | unit 0 / live 1 | unit 24。**live 1/3**（2026-08-15 18:27–18:40，`SERVER_URL=7990`）。海绵宝宝 footer 2/2 PASS；黑袍 7/7 但首写 138s>120s FAIL；GEO 写了 18 个文件但清单 0/8 FAIL。产物 `artifacts/three-case-speed-rca-20260726/` |
| F2-5 | sequential + parallelWrite unit | 0 | 并行 flag 不绕过 Sequential enforce |
| F2-6 | USN 单测；未改 `engineRepairOwned` | 0 | 仅文案相位 |
| F2-7 | `npm run test:deliverable-paths` | 0 | collision + 49 UI path tests |
| F2-8 | `node scripts/check-white-screen.mjs "http://127.0.0.1:8081/p/general"` | 0 | 营销首页可渲染，`ERRORS_COUNT=0` |
| F2-9 | pack=2 / apply=2 / dev=4 | 核对源码 | 一致；未跑幻灯 live |

### F3 P1-A / P1-B

| ID | 命令 | exit | 结果 |
|----|------|------|------|
| F3-A | `tests/saas/clarification-gate.test.ts` | 0 | 有附件/`<attachment`/`pdf` 不拦；无附件短句「生成PPT」仍拦 |
| F3-B | `deliverableCapabilityProfiles.script-intent.test.ts` 附件须交付 | 0 | 「出一份 HTML 报告」+ 附件「须交付：01-sources.md」→ profile=`html` |
| F3-C | 同文件 8 条脚本/成片 fixture + media strategy | 0 | 口播脚本 ≠ video-mp4；10 秒广告 / 文生视频仍成片；Python 脚本非 video/html |
| F3-D | `npm run test:task-continuation-policy` | 0 | 46 tests；脚本 md verified 不因缺 mp4 repair |
| F3-E | 真 multipart 上传 docx | 0 | **PASS**。`POST /api/projects/general/upload-attachments` 上传真实 `brief.docx`（`1-brief.docx`），再 Gateway 带附件开做。`profile=html`，hint=`report.html`，`acceptance=passed`。会话 `cli:…s_db35540d`，`task-20260815-f3e7a0af`。 |

PDF：`shouldEmbedFullPdfBase64` — 抽字 ≥200 不再塞整份 base64。

### L2 内容实机（2026-08-15 16:00 前后）

命令：`node scripts/run-speed-completion-live.mjs`（`SERVER_URL=http://127.0.0.1:7990`）  
产物：`artifacts/speed-completion-live-20260815/summary.json`  
**exit 1**（脚本 2/4 PASS；严格内容另计）

| 案 | 脚本 | 严格内容 | 证据 |
|----|------|----------|------|
| L2-CLARIFY「生成PPT」 | FAIL | FAIL | 40.5s；未问主题；`profile=ppt`；委派 `agent` subagent。正文英文编排。Harness 前缀 `[L2-CLARIFY]` 使 `hasConcreteTopic` 为真（门被标签污染）。会话 `cli:…s_8e32900e` |
| L2-SCRIPT 口播+须交付脚本.md | FAIL | FAIL | 写出 md、无 mp4、无成片工具、`profile=script-md`。但 SDM 被 `parseExplicitHtmlVideoDeliverableSlots` **抢先**编出 `explicit_html_report`+`explicit_video_clip`（「不要 HTML 录屏 / 不要做成视频」命中双槽正则），`acceptance=needs_repair`。会话 `cli:…s_084696f6` |
| L2-HTML report.html | PASS（弱断言） | FAIL | 写出 `report.html`。`profile=ppt`（「不要 Word/PPT」命中 `PPT_GOAL_PATTERN`）；pathHint 污染为 `report.html不要配图.html`（须交付子句与下一句 `join('')` 无分隔）。会话 `cli:…s_3359d0bb` |
| L2-ATTACH 附件 markup | PASS（弱断言） | PARTIAL | 未拦主题；写出 `report.html`+`01-sources.md`；无 research 全包槽。但 `profile=research`；pathHint 被 `[L2-ATTACH]` 整句污染。会话 `cli:…s_606f36c0` |

根因（已定位，**本轮未改产品代码**，先汇报）：

1. `resolveAuthoritativeSdmSlots`：`explicitDual.length>=2` **先于**「须交付：basename」返回，否定句可劫持槽位。  
2. `PPT_GOAL_PATTERN` 不认「不要 PPT」。  
3. `hasConcreteTopic` 不剥 `[L2-CLARIFY]` 类 harness 前缀。  
4. 实机脚本 `join('')` 把须交付子句与禁令粘在一起，放大 pathHint 污染（测试设计问题，已记）。

F1-G 截图（第一轮）：`artifacts/speed-completion-live-20260815/ui/f1g-*.png`  
UI 会话（第一轮）：`web-s_1420b0b0-e709-432f-8429-3206ea880ca0`（`task-20260815-96fc805b`）。

---

## 第二轮：四案根因修复后复测（2026-08-15 18:00 前后）

命令：`node scripts/run-speed-completion-live.mjs`（`SERVER_URL=http://127.0.0.1:7990`，`skipMessageTag: true`，须交付与禁令 `\n` join）  
产物：`artifacts/speed-completion-live-20260815/summary.json`（`startedAt=2026-08-15T10:02:48.588Z`）  
**exit 1**（脚本 3/4；CLARIFY 旧断言 + `ask_user` 挂到 180s timeout）

| 案 | 脚本 | 严格内容 | 证据 |
|----|------|----------|------|
| L2-CLARIFY「生成PPT」 | FAIL（旧断言 `asked=false` + timeout） | **PASS** | `ask_user_question:1`；正文「确认几个关键信息」；无 pptx / 成片工具；`profile=ppt`。会话 `cli:…s_892de992`。源码断言已扩「确认几个\|关键信息\|ask_user」；未再烧 180s 单案重跑 |
| L2-SCRIPT 口播+须交付脚本.md | PASS | **PASS（编译）** | `profile=script-md`；槽仅 `脚本.md` + `data-sources`；无 video/html 双槽、无 mp4。Agent 写成整句 `.md` 而非 `脚本.md` → `acceptance=needs_repair`（模型落盘，非本批原根因）。会话 `cli:…s_bbd08cdc`，`task-20260815-3a6acf25` |
| L2-HTML report.html | PASS | **PASS** | `profile=html`；pathHint=`report.html` 干净；`acceptance=passed`。会话 `cli:…s_8d63b345`，`task-20260815-b14772b5` |
| L2-ATTACH 附件 markup | PASS | **PARTIAL** | `profile=html`，无 research 全包。写出 `report.html`+`01-sources.md`。pathHint 被 `deliverableFilenamePolicy` 扩成整句 `.html`（中文 basename 策略残留，非本批原 FAIL）。会话 `cli:…s_4c42f25e` |

本批原 4 条根因复测：

1. 须交付 basename 优先于 `parseExplicitHtmlVideoDeliverableSlots` + 否定句剥离 → SCRIPT 不再编 html/video 双槽  
2. `PPT_GOAL_PATTERN` 先剥「不要 PPT」；HTML 简报先于 ppt → HTML `profile=html`  
3. `hasConcreteTopic` 剥 `[TAG]`；实机 `skipMessageTag` → CLARIFY 会问  
4. 须交付子句换行截断 + pathHint 非贪婪捕获 → HTML hint 不再粘「不要配图」

F1-G 第二轮：`web-s_973dee55-8ffb-4809-9d6d-7fa44e316229`；截图 `ui/f1g-retest-working-light.png`、`ui/f1g-retest-sticky-expanded-{light,dark}.png`；记录 `ui/f1g-retest-findings.json`。

---

## KPI（绑命令）

| KPI | 证据 | 状态 |
|-----|------|------|
| 假 incomplete：盘上中文 md / 单槽 Index | sdmSlotMatching fixture | PASS |
| 双 HTML 防串 | 交叉认领 fail | PASS |
| 空壳仍拦 | 无 PK / 空文件 | PASS |
| 先绿后红 | dock unsettled 不 delivered | PASS |
| 校验中可打开 | dock/summary 单测 + F1-G | 单测 PASS；实机完成态链接可开预览；**unsettled 窗口未截到** |
| 双进度 | generated/accepted/total + icon | 单测 PASS；完成态折叠「成果 2/2」无长标签；incomplete 双 icon 实机窗口未截到 |
| 文案 | 流式 ≠ 核对清单 | 单测 PASS；**第二轮实机 PASS**（制作中 Composer「制作中，请稍候…」） |
| 并行闸门 | Sequential enforce 串行 | PASS |
| 辐射四线 / 三案 unit / 路径 | 上表 F2 | PASS |
| 附件不拦 / 脚本不成片 | F3 | PASS |

---

## P1-C

| 项 | 约束 | 本批 |
|----|------|------|
| GEO 并行 | 保持 shadow/off，**不 enforce** | pack=`off`，apply/dev=`shadow` |
| Judge fast-skip / outbound 分槽 / Bridge async validate / repair gap key | 延后 | **未做**（优先级低于 A/B） |

---

## 禁止项自检

- 未关 SDM / GROUND_TRUTH_RECONCILE  
- 证书/合同未本批 enforce  
- 空壳 pptx / 官图 placeholder 门未降  
- unsettled 不乐观绿  
- 多 html 槽不交叉认领  
- 并行不绕 Sequential / 不同 path 才可并发  
- 未改 lifecycle / `engineRepairOwned`  
- pack 幻灯未跳到 4  
- 未关全局 clarificationGate  
- 明确成片（10 秒广告 / 文生视频 / hf-* / tool-generate-video）仍绑 mp4  

---

## 回滚

1. `PILOTDECK_PARALLEL_WRITE_FILE=off`  
2. `PILOTDECK_HTML_FORMAL_ACCEPTANCE=off`（或保持 shadow）  
3. `PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL=0`  
4. 代码：回到 `restore-point/pre-speed-completion-20260815150314`  

apply-cloud 补键后须 **recreate nova**；勿在长任务中途切换。

---

## 第三轮：文件名锁定 + 真上传 + 三案 live（2026-08-15 18:16–18:40）

命令：`SPEED_LIVE_CASES=L2-SCRIPT,L2-ATTACH,F3-E node scripts/run-speed-completion-live.mjs`  
**exit 0**（3/3）

| 案 | 结果 | 证据 |
|----|------|------|
| L2-SCRIPT | **PASS** | 写出 `脚本.md`（不再用整句当文件名）；`acceptance=passed`。会话 `cli:…s_389f59dd`，`task-20260815-4ad6dc0d` |
| L2-ATTACH | **PASS** | pathHint=`report.html`，无「根据附件/须交付」整句。会话 `cli:…s_08469f92` |
| F3-E 真上传 | **PASS** | multipart 落到 `.tmp/chat-attachments/…/1-brief.docx`；写出 `report.html`；`acceptance=passed` |

改动对照：

| | 修改前 | 修改后 | 风险 |
|---|---|---|---|
| 须交付 `report.html` | 被任务标题扩成整句 `.html` | 点名文件名原样锁定 | 仅 generic 英文兜底（brief.md 等）仍改中文名 |
| 口播 `脚本.md` | 提示让模型用标题当文件名 | 提示「必须原样写入脚本.md」 | 未点名须交付时仍按标题起中文名 |
| 真上传 | 只用文字模拟附件 | 走工作台同一上传接口 | 测的是 API multipart，不是浏览器选文件手势 |

三案 live：`npm run test:three-case-speed-rca:live:gate` **exit 1**（1/3）。黑袍内容齐、只慢首写；GEO 文件在盘、清单未对齐。**未改门禁阈值**。

---

## 下一步（未宣称全 A / 生产 GO）

本批计划残留（文件名 / 真上传）**已修并复测**。三案 live 未全绿，另开：

1. 黑袍一文多发：首写压到 120s 内（现 138s，7/7 已齐）  
2. GEO 全案：文件已写但清单 0/8，对齐槽位/basename  
3. 观测并行 write shadow 无同 path 竞态后再考虑 pack enforce  
