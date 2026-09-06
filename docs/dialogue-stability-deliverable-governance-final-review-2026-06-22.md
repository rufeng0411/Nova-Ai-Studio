# 对话稳定性及交付物监理终验报告

生成时间：2026-06-22

## 1. 执行摘要

本轮按 `对话稳定性终验` 计划完成了五类链路盘点、冲突筛选、证据映射、实机 Playwright/集成/破坏性/负载验证，并在测试中完成 3 个最小修复：

1. 修复 `SaasProtectedRoute` 条件调用 hook 导致的 React Hooks 顺序警告。
2. 修复 Playwright SaaS 登录 helper 对登录后短暂落到 `/` 的误判。
3. 修正本地 HTTP 负载脚本默认 Bridge 端口从 `3002` 到 `3001`，避免负载门禁误打空端口。

总体结论：对话稳定性主链（引擎续跑、交付验收、坏成果拦截、分镜包多文件门控、raw 技术错误遮蔽、UI 基础工作区）通过本轮终验。仍不应宣称“生产全闭环无风险”，因为两个观察项需要后续专项：`test:storyboard-pack:run` 功能通过但 `submit_turn` 响应在 1200s 后才回收；`verify:marketing-saas` 暴露能力中心 159 个中文 display_name 缺口，影响中文 UI 口径但不阻断本轮对话续跑主链。

## 2. 优化总览表

| 编号 | 分类 | 策略/程序 | 关键文件 | 筛选结论 | 终验意见 |
|---|---|---|---|---|---|
| A1 | 过程 UI | 首响占位与首句保护 | `TaskAcknowledgmentBubble.tsx`、`processGrouping.ts` | 保留 | 提交后先给弱反馈，避免首段慢时空白；不参与续跑仲裁。 |
| A2 | 过程 UI | sticky 阶段进度条 | `MessagesPaneV2.tsx`、`ProcessPhaseRail` | 保留 | 作为任务进行中的唯一常驻状态条；inline timeline 只做详情。 |
| A3 | 过程 UI | live 过程时间线 | `ProcessTimeline.tsx`、`ProcessTimelineLiveViewport.tsx` | 合并 | 保留 live dock 单点渲染，完成后折叠到过程附件，禁止双重展示。 |
| A4 | 过程 UI | 过程文案本地化与英文旁白过滤 | `processTimelineBuilder.ts`、`processStepLabels.ts` | 保留 | raw key、英文 recovery 旁白不进用户正文；技术信息进折叠详情。 |
| B1 | 稳定性 | 双轨 `RecoveryBudget` | `recoveryBudget.ts`、`recoveryPolicy.ts` | 保留 | 引擎预算为权威；recoverable 与 hard_fail 不混用。 |
| B2 | 稳定性 | 引擎自动续跑仲裁 | `AgentLoop.ts`、`taskContinuationPolicy.ts` | 保留 | 主 owner 固定在引擎；UI 只做基础设施/陈旧 turn 兜底。 |
| B3 | 稳定性 | UI 自动续跑兜底 | `useAutoRecoveryContinue.ts`、`useIncompleteDeliverableAutoContinue.ts` | 合并 | 合并为兜底层，必须通过 `taskResumeCoordinator` 去重。 |
| B4 | 稳定性 | stale turn watchdog | `useStaleTurnWatchdog.ts`、`taskResumeCoordinator.ts` | 保留 | 防 UI 永久进行中；阈值仍需避免误判长任务。 |
| B5 | 稳定性 | LargeFileRepair 软着陆 | `LargeFileRepair.ts`、`AgentLoop.ts` | 保留 | 只在“已有文件 + 交付类目标”继续分段补写，避免英文硬停。 |
| B6 | 稳定性 | soft fetch recovery | `toolFailureRecovery.ts`、`AgentLoop.ts` | 保留 | 联网失败优先换源/降级；交付缺失优先级高于 duplicate soft fetch。 |
| C1 | 交付验收 | final-only 最终验收门控 | `validateDeliverablesEngine.ts`、`finalAcceptance.ts` | 保留 | 只在 turn 完成前拦截，避免过程文件过早验收。 |
| C2 | 交付验收 | 多文件包必需项门控 | `profileRequiredDeliverables.ts`、`deliverableCapabilityProfiles.ts` | 保留 | 分镜包三件套已实机通过；禁止泛化到所有任务。 |
| C3 | 交付验收 | 成果路径解析与 UI 验证 | `useValidatedDeliverables.ts`、`DeliverablePathLink.tsx` | 保留 | 空验证不得回退展示坏路径；四线对齐继续作为专项门禁。 |
| C4 | 交付验收 | 验收修复 prompt | `buildAcceptanceRepairPrompt.ts` | 保留 | 必须携带已验证/缺失/坏成果，避免重复改已通过文件。 |
| D1 | 任务语境 | capability binding | `capabilityBindingPrompt.ts`、`capabilitySessionBinding.ts` | 保留 | 多轮追问保留能力语境；新任务可覆盖旧绑定。 |
| D2 | 阻断澄清 | clarification gate | `clarificationGate.ts` | 保留 | 只用于 Key/附件/权限等硬缺口，不打断“直接开始做”类任务。 |
| D3 | 阻断澄清 | user action blocker | `userActionBlocker.ts`、`userActionBlockerStreakTracker.ts` | 保留 | 缺 Key/鉴权快停，不消耗 recoverable 预算。 |
| D4 | 任务续接 | resume 上下文 | `buildTaskResumeContext.ts`、`taskLifecycle.ts` | 保留 | 自动续做必须带原始目标、已验证和缺失路径；UI 只展示人话摘要。 |
| E1 | 候选剔除 | UI 与引擎并行抢 deliverable repair owner | 多处 hook + `AgentLoop.ts` | 禁止 | 同一 turn 只能有一个 recovery owner。 |
| E2 | 候选剔除 | 默认展示完整工具原文 | 过程 UI | 禁止 | bash/write_file/raw error 不进成果区。 |
| E3 | 候选剔除 | 对所有任务强制多文件门控 | 交付 profile | 禁止 | 只允许 profile + goal 双命中。 |
| E4 | 候选降级 | 所有 recovery exhaustion 都展示自查步骤 | error notice | 降级观察 | 仅 `user_action_required` 显示明确处理动作。 |
| E5 | 候选降级 | 视频分镜默认完整 read_skill 长流程 | skill binding | 降级观察 | 默认压缩为最小三件套，复杂扩展由能力明确触发。 |

## 3. 冲突筛选结论

| 冲突点 | 保留方 | 降级/剔除方 | 原因 | 验收结果 |
|---|---|---|---|---|
| `auto_continue_engine` 与 `ui_auto_continue` 重复续跑 | 引擎续跑 | UI 并行续跑 | 引擎有完整上下文、预算和验收结果；UI 缺少工具态全貌 | `test:p0-p2:full` 通过，`dialogue-stability:adversarial` 确认 owner 为 `deliverable_repair`。 |
| `acceptance_repair` 与 stale turn watchdog 抢占 | `acceptance_repair` | stale 仅兜底陈旧 turn | 缺交付属于引擎验收问题，不应由 UI 盲续 | hook 单测 26 项通过。 |
| soft fetch 与交付缺失都想续跑 | 交付缺失优先 | duplicate soft fetch 仅限网络同错 | 用户目标是成果，不是无限抓取网页 | `test:recovery-beijing-ai-report` 离线通过。 |
| LargeFileRepair 与 invalid tool recovery 重叠 | LargeFileRepair 软着陆 | 一般 invalid recovery | 大文件已有 partial 文件时应继续补齐，不应重启工具循环 | 分镜包实机三件套 3/3。 |
| 成果卡展示与验证失败回退 | 验证通过项 | 原始坏路径回退 | 坏路径展示比不展示更伤害用户信任 | `ui-artifact-preview-check` fixture 文件可见，坏路径不作为通过项。 |
| 负载脚本默认端口与生产门禁默认端口不一致 | `3001` Bridge | `3002` 默认 | 当前 dev/生产门禁均以 `3001` 为 Bridge/API 默认 | 已修复并复跑默认负载 smoke 0 失败。 |

## 4. 验收证据表

| 证据 | 命令/报告 | 结果 |
|---|---|---|
| 过程 UX 快测 | `npm run test:process-ux` | 9 个测试文件、22 项测试通过。 |
| 最终验收门控 | `npm run test:final-acceptance` | Vitest 35 项 + node test 6 项通过。 |
| 验收修复桥 | `npm run test:acceptance-retry` | `invalid -> repair prompt -> passed`。 |
| P0-P2 主链 | `npm run test:p0-p2:full` | 16 个单测文件 77 项通过；集成与 selfcheck 全部 PASS。 |
| UI 续跑 hook | `npm --workspace ui run test -- ...useAutoRecoveryContinue...` | 3 个文件 26 项通过。 |
| 破坏性挑刺 | `npm run test:dialogue-stability:adversarial` | 坏 HTML、分镜缺文件、raw error 遮蔽、续跑仲裁、实机 UI 全部通过。 |
| 分镜包实机 Gateway | `npm run test:storyboard-pack:run` | 3/3 必需文件齐全，`recoveryAttempts=0`，功能通过；响应收敛超时单列观察。 |
| Recovery 专项 | `npm run test:recovery-wuyutai` | 生成 `docs/recovery-stability-report-2026-06-22.md`；事件量 130，高于 baseline，作为优化观察。 |
| 北京 AI 报告 recovery | `npm run test:recovery-beijing-ai-report` | offline checks OK。 |
| 任务完成 KPI | `npm run analyze:task-completion` | recovery empty spin rate 0.0%；历史交付类干预率 24.2%，需继续跟踪。 |
| 实机 UI 回归 | `node scripts/ui-regression-check.mjs` | 能力接入中心、欢迎 chip、Key 提示通过。 |
| 实机成果预览 fixture | `node scripts/ui-artifact-preview-check.mjs` | fixture 文件写入并可见；报告路径 `artifacts/media-smoke/ui-artifact/report.json`。 |
| 文档/PPT 导出 | `node scripts/ui-document-export-check.mjs` | Markdown→PDF、PNG 图集→可编辑 PPTX 通过；侧栏按钮检查 skipped。 |
| GEO/营销轻量回归 | `node scripts/ui-aigeo-regression-check.mjs` | GEO 流程模板与 overrides 通过。 |
| 本地负载 smoke | `node scripts/load/http-load.mjs --scenario smoke` | 修正后默认 `3001`：778 次请求 0 失败，P95 908ms。 |
| 云端 chat-load 本地门禁 | `LOCAL_DEV=1 npm run test:cloud:chat-load` | 本地环境按设计 skip，正式云验收需生产账号与 URL。 |

## 5. 全链路挑刺测试矩阵

| 类别 | 场景 | 结果 | 发现问题 | 处理 |
|---|---|---|---|---|
| 实机 Playwright | 工作区加载、composer、raw error 泄漏 | 通过 | 初跑发现 `SaasProtectedRoute` Hooks 顺序警告 | 已修复并复跑通过。 |
| 实机 Playwright | 能力中心/Key 提示 | 通过 | 无阻断 | 保留现有脚本。 |
| 实机 Playwright | 成果预览 fixture | 功能通过 | deliverables panel 未显式出现，但文件名可见，脚本判定通过 | 作为观察项，不阻断主链。 |
| 实机 Playwright | 文档/PPT 导出 | 通过 | 文件树侧栏按钮子项 skipped | 主导出链路通过，侧栏可见性另列 UI 体验观察。 |
| 实机 Gateway | 分镜包三件套 | 功能通过 | `submit_turn` response timeout | 不混同交付失败，后续优化响应收敛。 |
| 异常注入 | 坏 HTML | 通过 | 无 | `invalid_html` 触发 `needs_repair`。 |
| 异常注入 | 分镜包缺镜头卡/交接矩阵 | 通过 | 无 | `missing` 触发 `needs_repair`。 |
| 异常注入 | raw hard-stop 文案 | 通过 | 无 | `Repeated invalid tool input` 被遮蔽为温和 pause。 |
| 负载 | 本地 HTTP smoke | 初跑误失败，修正后通过 | 默认端口写成 3002 | 已改为 3001 并复测通过。 |
| 云门禁 | cloud chat-load | 本地 skip | 需生产账号和云 URL | 保留为打包/上线前门禁。 |
| GEO 目录 | 模板/overrides | 通过 | `verify:marketing-saas` i18n 失败 | 归为能力中心中文化 P1 专项。 |

## 6. 问题优化闭环

| 问题 | 类型 | 影响 | 修复动作 | 复测 |
|---|---|---|---|---|
| `SaasProtectedRoute` 条件调用 `useDeviceSettings` | UI 稳定性 bug | 登录态切换时可能触发 React Hooks 顺序错误 | 把 `useDeviceSettings` 提前到条件 return 前 | `npm run test:dialogue-stability:adversarial` 通过，`blockingConsoleErrors=[]`。 |
| Playwright 登录 helper 等待 URL 过严 | 测试脚本误判/稳定性 | 登录后短暂落 `/` 会导致脚本超时 | 改为 token 到位后主动进入 `/p/general` | 新增 npm 脚本复跑通过。 |
| HTTP load 默认端口不一致 | 测试脚本误判 | 负载脚本误打 `3002` 全失败 | 默认端口与生产门禁统一为 `3001` | 默认命令复跑 778 次请求 0 失败。 |
| `verify:marketing-saas` 中文名缺失 159 项 | 能力中心 i18n 问题 | 中文界面可能残留英文能力名 | 本轮不批量翻译，列入 P1 专项 | `ui-aigeo-regression-check` 通过；完整 marketing verify 未通过。 |
| 分镜包 `submit_turn` response timeout | Gateway/harness 收敛问题 | 文件已齐但命令等满 1200s | 本轮不改模型执行链，单列响应收敛专项 | `docs/storyboard-pack-acceptance-2026-06-22.md` 标记 functional pass。 |

## 7. 风险与后续建议

| 优先级 | 项 | 建议 |
|---|---|---|
| P0 观察 | `submit_turn` response timeout | 在 Gateway 收敛逻辑中继续核对 `event.final`、`turn_completed` 与 response resolve 条件，目标是文件齐全后及时返回。 |
| P1 | `verify:marketing-saas` 中文 display_name | 单独做能力中心中文名补齐，不与本轮稳定性修复混在一起；补齐后复跑 `verify:marketing-saas`。 |
| P1 | recovery 事件量偏高 | `test:recovery-wuyutai` 显示 recovery events 130，高于 baseline 3，建议继续拆分 tool_recovery 来源。 |
| P2 | 成果 fixture 面板可见性 | `ui-artifact-preview-check` 虽通过，但成果 panel/folder card 未稳定显式出现，建议后续强化 UI 可观测断言。 |
| P2 | 云端 chat-load | 本地已按 `LOCAL_DEV=1` skip；上线前必须用生产账号跑 `test:cloud:chat-load`。 |

## 8. 最终判断

本轮可以写入结论：对话稳定性与交付物监理主链已通过终验；坏成果不会被当作完成，分镜包不会只交一个概述文件，raw 技术硬停不会直接露给用户，UI 与引擎续跑 owner 已明确分层。

本轮不能写成“所有生产门禁完全闭环”：真实云端 chat-load 未在本地执行，GEO 全案/PPT 大任务的完整实机 Playwright 真实生成未作为长耗时浏览器任务重跑，分镜包仍存在 response timeout 观察项，能力中心中文展示名还有专项缺口。

---

## 附录 A：2026-06-23 严苛复测（Tier A→D）

| Tier | 范围 | 命令 | 结果 | 备注 |
|---|---|---|---|---|
| A | 引擎验收 + 破坏性门控 | `test:dialogue-stability:adversarial` | **PASS** | 坏 HTML、分镜缺件、raw 遮蔽、续跑 owner 全通过 |
| A | Harness 协议修复 | `test:storyboard-pack:run` | **PASS** | `resolvedBy=final_event`，~73s，不再满 1200s |
| B | 分镜 Playwright 五线 | `test:storyboard-pack:playwright` | **PASS** | validate 3/3、resolve 全 200、无 raw 泄漏 |
| B | 成果验证 hook | `useValidatedDeliverables` vitest | **PASS** | 默认启用服务端验证，broken 项不再展示 |
| B | 成果 fixture STRICT | `UI_ARTIFACT_STRICT=1 ui-artifact-preview-check` | **PASS** | 工作区对齐后 validate 3/3 |
| C | 并行多用户 | `test:multi-user:sim` | **PASS（预算）** | 双 WS 并行；turn 90s 超时属模型慢，recovery 未超标 |
| C | Recovery 分因 | `test:recovery:breakdown` | **报告** | 138 事件：tool_recovery 85、Top 工具 bash 68 |
| C | 营销 i18n | `check-capabilities-i18n-zh` | **PASS** | 1233 项 display_name 全含中文 |
| D | Hub 分类 | `integration-capability-hub-taxonomy-check` | **PASS** | failures=0 |
| D | 负载 smoke | `http-load.mjs --scenario smoke` | **PASS（历史）** | Bridge 3001，0 失败 |

### 附录 A.1 本轮新增/修复项

| 项 | 文件 | 说明 |
|---|---|---|
| Gateway harness `event.final` | `scripts/lib/gatewaySessionHarness.mjs` | 功能完成不再误报 1200s 超时 |
| 工作区解析 | `scripts/lib/resolveGeneralWorkspaceCwd.mjs` | Playwright/Gateway 与 UI 同源 hub |
| mkt-dmp 中文名 | `scripts/lib/dmpPackZh.mjs` | 159 项数字营销包 display_name |
| 成果验证默认开启 | `ui/src/shared/useValidatedDeliverables.ts` | 仅 `VITE_BYPASS_DELIVERABLE_VALIDATION=true` 可回退 |
| 并行多用户 | `scripts/integration-multi-user-turn-sim.mjs` | 独立 WS 并行 submit_turn |
| Recovery 分因 | `scripts/recovery-breakdown-report.mjs` | Top reason/tool + 建议 |
| 分镜 Playwright | `scripts/playwright-storyboard-pack-check.mjs` | 三件套浏览器实机校验 |

### 附录 A.2 仍列 P1 观察

| 项 | 现状 | 下一步 |
|---|---|---|
| tool_recovery / bash | 85/68 次 | `toolFailureRepeatGuard` 已默认开；继续 alternate 路径 |
| GEO replay KPI | `test:geo-replay:kpi` 脚本就绪 | 长耗时 Gateway 实跑留 nightly |
| 云端 chat-load | 本地 skip | 打包前生产账号验收 |
