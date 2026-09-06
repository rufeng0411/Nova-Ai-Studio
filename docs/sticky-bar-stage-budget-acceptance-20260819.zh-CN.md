# 成果栏常驻 · 未校验可点 · 阶段熔断验收（2026-08-19）

> 对应计划：成果栏常驻与阶段熔断（稳定第一修订版）；稳定修订 `.cursor/plans/成果栏稳定修订_20260819.plan.md`  
> 还原点：`restore-point/pre-sticky-stage-budget-20260819173414` @ `c8380204`  
> 裁决：**GO(shadow)** / **不得生产 GO**  
> 原因：栏常驻 L0/L1 已绿；PPT 缺席投诉误绑已收窄并经 L2 复测 **hard 5/5 · all 6/6**，`STICKY-ZHIHU` `profileId=default`（对照首跑 `ppt`）。阶段账本仅 shadow，未改仲裁。禁止把本报告写成生产 GO。

---

## 审阅冲突闭环

| # | 冲突 | 落地 |
|---|---|---|
| C1 | 磁盘 enrich 无条件标绿 | `enrichRowsWithDiskSnapshot` 制作中 / repair 中固定 `checking` + `linkable`；历史截断快照在非 in-flight 仍可绿已绑定槽 |
| C2 | extra 扫盘增槽 | **保留** `if (!validationSettled) continue` 与 `allowExtraRows:false` |
| C3 | defer 防卡顿 | transcript 扫描仍 defer；snapshot 制作中可刷新，同 key 最短 1500ms |
| C4 | 第二套 Dock | 只扩展 `frozenPipelineBundleRef` + `resolvePersistedDeliverablesDockState` |
| C5 | 快照串会话 | retain 键 = sessionId + scopeDir；切会话丢弃 |
| C6 | 证书 skip merge | 仍走 gated enrich |
| C7 | 空 freeze 覆盖 | in-flight 且 prev 有行时拒绝空 next |
| C8 | TOOL_WATCHDOG 分裂 | 代码 fallback 仍 false；pack/apply 补 `1`（observe） |

---

## 修改前 / 修改后 / 风险

| 项 | 修改前 | 修改后 | 风险 |
|---|---|---|---|
| 成果栏 | defer 窗口 `messages=[]` 裸 derive，栏可卸载 | freeze + envelope 占位 + `shouldShowStickyDeliverableBar`，交付类常驻 | 纯寒暄误显栏（已用无 manifest/无 STDA 门禁） |
| 未校验文件 | 无路径或标绿 | 槽位 enrich 可点，状态校验中 | 截断快照历史导出需非 in-flight 才允许绿已绑定槽 |
| 阶段账本 | 无 | `observeTaskStage` shadow 写 JSONL | 误接到仲裁会误杀任务（本批未接） |

---

## Flag 三处同步

| 键 | devLauncher | pack | apply-cloud | 默认 |
|---|---|---|---|---|
| `VITE_STICKY_DELIVERABLE_BAR_PERSIST` | 1 | UI build 1 | 记录 1（编译期仍以 pack 为准） | 1 |
| `PILOTDECK_TASK_STAGE_BUDGET` | shadow | shadow | shadow | 代码 unset=`off` |
| `PILOTDECK_TOOL_WATCHDOG` | 已有 1 | **补 1** | **补 1** | 代码 fallback false |
| `VITE_DEFER_DELIVERABLES_WHILE_STREAMING` | 已有 1 | 已有 1 | 不改 | 1 |

回滚：`VITE_STICKY_DELIVERABLE_BAR_PERSIST=0`；`PILOTDECK_TASK_STAGE_BUDGET=off`；`PILOTDECK_TOOL_WATCHDOG=0`（仅关观测）。

---

## 验收分级

| 级 | 命令 | 结果 |
|---|---|---|
| L0 | persist / enrich / dock / open / stageBudget / stabilityFlags vitest | **PASS**（72） |
| L1 | `npm run test:deliverable-triple-unify` | **PASS** |
| L2 | `SERVER_URL=http://127.0.0.1:7990 npm run test:sticky-stage:live` | 首跑 hard 4/4 · 6/6（ZHIHU 误绑 ppt，非硬门禁）；**复测 hard 5/5 · 6/6**，ZHIHU `profileId=default` |
| L3 | shadow observe 不改 `shouldTriggerDeliverableRepair` | 单测锁死；AgentLoop 仅旁路调用 |
| L4 | 矩阵 `kpi.jsonl` 实数 | 见下表；token 缺测记 **n/a**，未填 0 |

`useTaskFolderDiskSnapshot` 的 renderHook 用例在当前仓库对 HEAD 原实现也失败（双 React / Root 崩溃），**非本批引入**。retain 契约已抽到 `resolveRetainedSnapshotEnvelope` 纯函数单测。

`check:saas-fork`：**PASS**（854 条，含 `taskStageBudget observe`）。

---

## L2 六案实机（2026-08-19）

- Bridge：`http://127.0.0.1:7990` ready；Gateway `18789`
- 项目：`workspaces-sticky-stage-20260819`（展示名 `sticky-stage-20260819`），**禁止 teardown**
- 编排墙钟：submit 起至脚本收口 **756123ms**（约 12.6 min）
- 权威 KPI：`artifacts/sticky-stage-budget-20260819/treatment/kpi.jsonl`、`summary.json`
- 说明：`barPersist` / `unsettledClickable` 由 Gateway 侧槽位+写盘代理（未跑 Playwright 点栏截图）；`stageOverrunEvents` 本跑为 `n/a`

| 案 | 硬门禁 | 结果 | wallClockMs | ttfwMs | userTurns | repairTurns | acceptance | profileId | 槽 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| STICKY-HTML | 是 | PASS | 36906 | 28707 | 1 | 0 | passed | html | 2 | `report.html` + `data-sources.md` |
| STICKY-SCRIPT | 是 | PASS | 20406 | 14611 | 1 | 0 | passed | script-md | 2 | `脚本.md`；无 mp4 槽 |
| STICKY-PROMPT | 是 | PASS | 116563 | 102226 | 1 | 0 | null | html | 2 | 有 `report.html`；非假 passed |
| STICKY-ZHIHU | 否 | PASS | 132671 | 55001 | 1 | 0 | passed | **ppt** | 3 | 已交 `01-topics.md`/`02-longform.md`；**largeIssue**（误绑 ppt，墙钟未超 20min） |
| STICKY-GEO | 否 | PASS | 340797 | 106401 | 1 | 0 | null | geo | **8** | 本跑 **未** 再现 0/8 |
| STICKY-FLYWHEEL | 是 | PASS | 106752 | 32427 | 1 | 0 | passed | content_flywheel | 4 | 三槽 basename + `data-sources.md`；非 phantom 11 |

Token：`tokensIn`/`tokensOut` 全部 **n/a**（JSONL 未采到 usage）。

---

## 稳定修订复测（2026-08-19 晚）

计划：`.cursor/plans/成果栏稳定修订_20260819.plan.md`  
改动：`stripNegatedDeliverableMentions` 增加 `PPT_ABSENCE_COMPLAINT_SPAN`（「在 PPT 里没有展示」）。**未改** `resolveContinuationAction`。  
L0：`script-intent` + `deliverableChecklistAuthority` 56 测 PASS；L1 `test:deliverable-triple-unify` PASS。  
L2 复测目录：`artifacts/sticky-stage-budget-20260819/retest/`（编排 **796169ms**）。项目未 teardown。

| 案 | 硬 | 复测 | wallClockMs | profileId | 对照首跑 |
|---|---|---|---|---|---|
| HTML | 是 | PASS | 44221 | html | 36906 / html |
| SCRIPT | 是 | PASS | 23115 | script-md | 20406 / script-md |
| PROMPT | 是 | PASS | 192487 | html | 116563 / html |
| ZHIHU | **是** | PASS | 127594 | **default** | 132671 / **ppt** |
| GEO | 否 | PASS | 284734 | geo 槽 8 | 340797 / geo 槽 8 |
| FLYWHEEL | 是 | PASS | 121529 | content_flywheel 槽 4 | 106752 / 槽 4 |

ZHIHU 复测会话 `s_dd3f1d78-5558-4148-84ba-5b09e0e60c7e`，写出 `01-topics.md` / `02-longform.md`。`largeIssues=[]`。

---

## 对照墙钟 / 完成率 / token（不得用预期冒充实测）

基线来源：原问题会话 JSONL **未定位**；08-15 报告 + `artifacts/sticky-stage-budget-20260819/baseline/baseline.md`。

| 指标 | 基线 | 本批实测 | 说明 |
|---|---|---|---|
| 任务完成率 | F1-G HTML 51s passed；三案 live 1/3 | HTML 37s passed；六案 6/6（硬 4/4） | 栏逻辑不得抬高引擎 passed；PROMPT/GEO 的 `acceptance=null` 未当假绿 |
| 稳定性（栏卸载） | 制作中可卸 | 六案 `barPersist=true`（Gateway 代理） | 未做 Playwright 点栏卸载计数 |
| 墙钟 | 08-15 HTML ~51s；GEO 清单 0/8 | HTML 37s；GEO 341s 且槽 8 | shadow 不改控制流；GEO 本跑未复现 0/8 |
| Token | 未采本批样本 | **n/a** | 不得填 0 |

处理组目录：`artifacts/sticky-stage-budget-20260819/treatment/`。

---

## 分流

- **中小问题（已修）**：导出截断快照误伤；L2 health 假 SKIP；**「在 PPT 里没有展示」误绑 ppt**（parser 收窄，复测 `profileId=default`）。
- **大问题（未改仲裁/SDM）**：GEO 历史 0/8；阶段 enforce。见大问题文档。

---

## 宣称口径

仅可写 **GO(shadow)**。仍不得生产 GO。阶段账本保持 shadow，禁止 enforce / abort `write_file`。
