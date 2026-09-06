# 过程时间线 UX 实机验收报告

**日期**：2026-06-14  
**Commit**：工作区未提交改动（过程展示 UX 升级批次）  
**环境**：Windows 10 · Node 22 · UI 语言 zh-CN  
**自动化**：`npm run test:process-ux:full` ✅ · Playwright `process-ux-live` 需本地 `dev:saas` 运行时执行

## 目标矩阵（G1–G12）

| ID | 目标 | 结果 | 证据 |
|----|------|------|------|
| G1 | 策略 A 单点 Timeline | **PASS（单测）** | `MessagesPaneV2.render.test.tsx` strategy A 用例 |
| G2 | 左轨 12px muted 统一 | **PASS（单测/代码）** | `ProcessTimeline` + `INFORMAL_PROCESS` token |
| G3 | 默认最近 5 步 | **PASS（单测）** | `processTimelineBuilder.test.ts` slice |
| G4 | 无 tool_recovery 泄漏 | **PASS（Bridge+builder）** | bridge 固定「调整中」；P-UX5 spec |
| G5 | 思考中文优先 | **PASS（策略+UI）** | `saasCoreStrategy` + builder 英文过滤单测 |
| G6 | Copy Voice recovery | **PASS（既有）** | `RecoveryGuidanceCard` / 弱提示 copy 测试 |
| G7 | 完成后展开链保留 | **PASS（单测）** | `InformalProcessStack.test.tsx` + render 展开用例 |
| G8 | ProcessActivitySummary | **PASS（组件）** | live Timeline 挂载 ActivitySummary |
| G9 | PhaseRail 弱化 | **PASS（代码）** | `ProcessPhaseRail` muted 样式 |
| G10 | ClueStrip live 下线 | **PASS（单测/spec）** | P-UX2/P-UX6 |
| G11 | 成果预览 | **SKIP** | 本次未改 Deliverable 管线；沿用既有回归 |
| G12 | 欢迎态 | **PASS（spec）** | P-UX7 |

**G 结论**：G1–G7 自动化/代码审查 PASS；G11 待发版前与 `test:prelaunch:quick` 一并走查。

## 稳定性矩阵（S1–S12）

| ID | 类别 | 结果 | 说明 |
|----|------|------|------|
| S1 | 工具失败换路 | **SKIP** | 需 Gateway 实机长任务 |
| S2 | recovery 预预算 | **SKIP** | 需实机 |
| S3 | Stale 卡住 | **SKIP** | 需 90s+ 实机 |
| S4 | autoRecoveryContinue | **SKIP** | 需实机 |
| S5 | WS 抖断 | **SKIP** | 需 DevTools 实机 |
| S6 | 长任务性能 | **SKIP** | 需实机录屏 |
| S7 | 刷新/重进 | **SKIP** | 需实机 |
| S8 | 备选交付降级 | **SKIP** | 需实机 |
| S9 | processUx 回滚 | **PASS（代码）** | `resolveClientProcessUxConfig` localStorage=0 |
| S10 | 并发切会话 | **SKIP** | 需实机 |
| S11 | 自动化回归 | **PASS** | `test:process-ux:full` 全绿 |
| S12 | SaaS 存储 | **SKIP** | 未改存储层 |

**S 结论**：核心自动化 S11 PASS；实机项请在 staging 按 `scripts/run-process-timeline-acceptance.mjs` Step 3 勾选。

## 前后对比

- 进行中：单点 `ProcessTimeline` 左轨，dock 仅阶段轨+计时（有 inline 时）。
- 完成后：折叠「已完成 N 步 · Xm」，展开见编号列表与 MessageRowV2 详情。

截图目录（待实机补充）：`artifacts/process-timeline-acceptance/`

## 已知问题

- 无 P0 阻塞。

## 发版结论

**可进入 staging 实机补验**（G11 + S1–S8/S10/S12）；自动化门禁已通过。
