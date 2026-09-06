# 对话稳定治理矩阵验收报告（2026-06-24）

## 覆盖范围

本轮覆盖计划 P0-P5 的精益闭环：会话目标、阻断分类、交付验收、resolved 交付物、恢复 owner、能力降级契约与回归门禁。

| 维度 | 本轮覆盖 | 结论 |
|---|---|---|
| 全链路 | `AgentLoop` 模块加载、final acceptance、UI summary table、resolved deliverable set、视频/HTML loading 验收 | 已纳入单元与 smoke |
| 多用户 | 保留 `test:saas:deep` / `smoke:saas-isolation` 在 `test:prelaunch:quick` | 精益门禁覆盖，实机并发留后续完整门禁 |
| 多任务 | ROG 社媒矩阵、Nike 网站成片、挪威视频、3D 网页、视觉画布、GEO requiredFiles | 已通过 profile/continuation/final acceptance 用例固化 |
| 能力中心 | 未新建第二套 registry，扩展 `deliverableCapabilityProfiles` | 符合双入口共用能力中心约束 |
| 流程模板 | `test:prelaunch:quick` 保留 `smoke:templates` | 保留既有门禁 |
| 实机 UI | Summary table 状态列、acceptance rows 单测、Playwright 真实 Chromium 渲染/播放视频 | 已覆盖本轮事故形态 |
| 并发与负载 | 保留 `test:saas:deep`、`test:multi-skill:matrix` | 快速门禁覆盖基础，负载专项留 nightly/发版前 |
| 破坏性 | optional key、坏 HTML、缺 requiredFiles、重复 blocker streak | 已有单元与 fixture |
| 特殊异常 | `继续/？？`、旧 OCR 文案、ReferenceError、内部 docs 路径、raw recovery 英文、`session_prepare` 等过程 key | 已纳入固定回归 |

## 已新增/扩展门禁

- `npm run smoke:dialogue-stability-modules`
- `npm run test:dialogue-stability:playwright`
- `npx vitest run tests/saas/deliverable-session-goal.test.ts src/agent/loop/AgentLoop.goalExtraction.test.ts tests/saas/task-continuation-policy.test.ts tests/saas/final-acceptance.test.ts tests/saas/deliverable-capability-profiles.test.ts tests/saas/user-action-blocker-streak.test.ts`
- `npm --workspace ui run test -- src/shared/validateDeliverables.test.ts src/shared/turnAcceptanceMeta.test.ts src/shared/userFacingErrors.test.ts src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx src/components/chat-v2/ProcessTimeline.test.tsx src/components/chat-v2/hooks/taskResumeCoordinator.test.ts`
- `npm run test:display-engine-alignment`

## 近期事故回归

- ROG OCR 误报：通过 optional key contract 与旧 OCR 文案 snapshot 防回归。
- Nike 网站成片过程文件：通过 acceptance meta/display alignment 防内部 docs 入成果。
- 3D 网页 ReferenceError：通过模块加载 smoke 防 import/ReferenceError 进入用户回合。
- 挪威三步演示视频：通过 task goal contract 同时要求 `markdown` 大纲、`html` 演示页、`video` 成片，并识别 `8-12 节/屏` 为最少 8 屏。
- 挪威 HTML 视频 MP4 空壳/HTML 充数：通过 `video` kind + 显式 `*.mp4` required file + 视频最小体积门槛防回归。
- 3D 网页黑屏/loading：通过 loading-only + 外部 3D/CDN 依赖 HTML 判坏防回归。
- 过程 raw key 泄漏：通过 `ProcessTimeline` 渲染层兜底隐藏 `session_prepare`/`memory_retrieve`/`router_judge`。
- raw 英文恢复错误泄漏：通过 `stripAgentRecoveryBoilerplateLines` 逐行清洗混入正文的 recovery boilerplate。
- 挪威海报问卷停住：通过偏好型 ask_user_question 自动默认继续逻辑保留。
- HTML 源码预览：保留 resolved deliverable 和 HTML adapter 既有修复，后续实机五入口继续覆盖。

## 策略冲突复盘

- 视频 vs HTML：`HTML 代码做视频` 只把 HTML 当过程载体，不把 HTML 当最终视频；如果用户同时要求“演示页/展示页/网页”，则 `html + video` 并行验收。
- 泛视频 vs MP4：用户只说“视频”时接受 `mp4/webm/mov`；用户明确说 `MP4` 时额外要求 `*.mp4`，避免 WebM 误充数。
- 报告 vs Word：只有 `docx/word/Word` 才推断 Word；“HTML 报告/动态可视化 HTML”不再因为“报告”二字误判为 docx。
- Loading 判坏 vs 正常外链：只有“存在 loading 层 + 依赖外部 3D/CDN + 没有移除 loading 或 fallback”同时满足才判坏；有 fallback 或明确 loaded/ready 逻辑的 HTML 不拦。
- 过程信息 vs 正文：过程 key 在 `ProcessTimeline` 渲染层隐藏，若异常混入助手正文，也由 `stripAgentRecoveryBoilerplateLines` 逐行清洗。

## Playwright 实机验收

- `scripts/playwright-dialogue-stability-regression.mjs` 生成更复杂的挪威世界杯三步交付 fixture。
- Chromium 实际打开深色动效 HTML，确认 loading 消失、9 屏可见、canvas 动效存在、无 console error。
- Chromium 实际打开坏 3D HTML，确认复现 loading 卡住；同一文件经 final acceptance 判 `needs_repair`。
- Chromium 用 `MediaRecorder` 录制浏览器视频并回放，确认视频可加载 metadata、非空且可播放。
- Chromium 打开假 MP4 空壳，确认浏览器播放失败；引擎验收同步判 `needs_repair`。
- 浏览器可见文本验证 raw recovery 英文和 `session_prepare` 不外露。报告输出：`artifacts/dialogue-stability-playwright/report.json`。

## 未覆盖但接受风险

- 真实多用户并发 + 长 transcript tail-read + 浏览器五入口逐项点击未在本轮立即跑全量，留给 `test:prelaunch:quick`、`test:dialogue-stability:full-chain`、发版前完整 Playwright 门禁。
- 云端生产 Redis/OSS/Nginx 组合未在本地单元测试中模拟，仍按生产门禁与云端 perf 验证执行。
