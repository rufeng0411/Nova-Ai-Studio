# 代码还原点总表（Registry）

> **维护约定**：新建还原点前须先提交干净工作区；打标签后在本表追加一行，并（可选）写独立说明 `docs/*-restore-point-*.md`。  
> **命名规则（2026-07-10 起）**：`restore-point/<pre|post>-<主题>-YYYYMMDDHHmmss`（精确到秒，同日可多个）；说明文档同名后缀 `docs/<主题>-restore-point-YYYYMMDDHHmmss.md`。  
> **硬回退前**：确认无未推送重要提交；`git reset --hard` 会丢弃还原点之后的本地提交。

**当前 HEAD**：`290d1454`  
**最新可用还原点**：`restore-point/post-mid-ask-breaker-skills-20260820075057`（**任务中间主动提问+熔断+二次修复+skills**）

---

## 星标还原点（Star）

| Star | 标签 | Star 别名 | 提交 | 时间 | 说明 | 详细文档 |
|------|------|-----------|------|------|------|----------|
| ★ 部分案例上传 | `restore-point/post-partial-showcase-upload-20260804063414` | `star/partial-showcase-upload` | `d0145ae8` | 2026-08-04 06:34:14 | **部分案例上传** — Showcase 案例上架与预览 UX | [`partial-showcase-upload-restore-point-20260804063414.md`](./partial-showcase-upload-restore-point-20260804063414.md) |
| ★ 企业合规 | `restore-point/post-cn-enterprise-compliance-20260802233012` | `star/cn-enterprise-compliance` | `d1e241c8` | 2026-08-02 23:30:12 | **企业合规** — Hub/Skills 首包与 VAP 加固同批 | [`cn-enterprise-compliance-restore-point-20260802233012.md`](./cn-enterprise-compliance-restore-point-20260802233012.md) |
| ★ 准备加固vap | `restore-point/post-vap-hardening-prep-20260802154147` | `star/vap-hardening-prep` | `95b66a43` | 2026-08-02 15:41:47 | **准备加固vap** — Showcase/营销基线与四线补强 | [`vap-hardening-prep-restore-point-20260802154147.md`](./vap-hardening-prep-restore-point-20260802154147.md) |
| ★ 蒸馏问题修复-1 | `restore-point/post-distill-fix-1-20260731231925` | `star/distill-fix-1` | `169c92eb` | 2026-07-31 23:19:25 | **蒸馏问题修复-1** — 调研/蒸馏四线与加戏死循环 | [`distill-fix-1-restore-point-20260731231925.md`](./distill-fix-1-restore-point-20260731231925.md) |
| ★ 预览模板+新首页 | `restore-point/post-preview-template-homepage-20260731000320` | `star/preview-template-homepage` | `31ad76c0` | 2026-07-31 00:03:20 | **预览模板+新首页** — Preflight 预览资产与营销首页迭代 | [`preview-template-homepage-restore-point-20260731000320.md`](./preview-template-homepage-restore-point-20260731000320.md) |
| ★ 预览模板 | `restore-point/post-preview-template-20260730233622` | `star/preview-template` | `03a45def` | 2026-07-30 23:36:22 | **预览模板** — Preflight Studio 接线与营销站 | [`preview-template-restore-point-20260730233622.md`](./preview-template-restore-point-20260730233622.md) |
| ★ Grok 4.5 | `restore-point/post-grok-45-preflight-experiment-20260730184135` | `star/grok-45-experiment` | `2eaa31fc` | 2026-07-30 18:41:35 | **grok 4.5 开始实验** — Preflight Studio 与产品记忆同步 | [`grok-45-experiment-restore-point-20260730184135.md`](./grok-45-experiment-restore-point-20260730184135.md) |
| ★ Bento | `restore-point/post-nova-bento-slides-20260729080833` | `star/bento` | `b5832404` | 2026-07-29 08:08:33 | **Nova Bento 幻灯** — SuperPreview 编辑器、Hub 置顶、写盘门控 | [`nova-bento-slides-restore-point-20260729080833.md`](./nova-bento-slides-restore-point-20260729080833.md) |
| ★ 智谱 | `restore-point/post-zhipu-demo-stable-20260728210731` | `star/zhipu-demo-stable` | `2873c348` | 2026-07-28 21:07:31 | **智谱演示稳定版本** — Skills Nova-fit、Hub 可见性、SDM/PPT 加固 | [`zhipu-demo-stable-restore-point-20260728210731.md`](./zhipu-demo-stable-restore-point-20260728210731.md) |

> 快速回退：`git reset --hard star/partial-showcase-upload` · `git reset --hard star/cn-enterprise-compliance` · `git reset --hard star/vap-hardening-prep` · `git reset --hard star/distill-fix-1` · `git reset --hard star/preview-template-homepage` · `git reset --hard star/preview-template` · `git reset --hard star/grok-45-experiment` · `git reset --hard star/bento` · `git reset --hard star/zhipu-demo-stable`

---

## 一、功能里程碑还原点（推荐日常使用）

| # | 标签 | 提交 | 时间 | 说明 | 详细文档 |
|---|------|------|------|------|----------|
| 0 | `restore-point/post-mid-ask-breaker-skills-20260820075057` | `290d1454` | 2026-08-20 07:50:57 | **任务中间主动提问+熔断+二次修复+skills** — goalKindSanitize / 熔断加固 / anth+ppt-master | [`mid-ask-breaker-skills-restore-point-20260820075057.md`](./mid-ask-breaker-skills-restore-point-20260820075057.md) |
| 0 | `restore-point/post-mid-task-ask-breaker-20260820003550` | `87710ea4` | 2026-08-20 00:35:50 | **任务中间主动提问+熔断** — 贵意图澄清问一次 + 阶段预算熔断 | [`mid-task-ask-breaker-restore-point-20260820003550.md`](./mid-task-ask-breaker-restore-point-20260820003550.md) |
| 1 | `restore-point/pre-expensive-intent-clarify-20260819203348` | `c8380204` | 2026-08-19 20:33:48 | **贵意图冲突保险丝问一次前** — 点名文件 vs 祈使演示稿问一次专项启动前 | [`expensive-intent-clarify-restore-point-20260819203348.md`](./expensive-intent-clarify-restore-point-20260819203348.md) |
| 0 | `restore-point/pre-sticky-stage-budget-20260819173414` | `c8380204` | 2026-08-19 17:34:14 | **成果栏常驻/阶段账本前** — defer 空窗、未校验可点、shadow 熔断专项启动前 | [`sticky-bar-stage-budget-restore-point-20260819173414.md`](./sticky-bar-stage-budget-restore-point-20260819173414.md) |
| 0 | `restore-point/pre-speed-completion-20260815150314` | `c8380204` | 2026-08-15 15:03:14 | **速度/完成度加固前** — SDM/成果栏/并行与附件意图专项启动前 | [`speed-completion-restore-point-20260815150314.md`](./speed-completion-restore-point-20260815150314.md) |
| 0 | `restore-point/pre-perf-speed-20260815062033` | `cc507126` | 2026-08-15 06:20:33 | **性能提速优化前** — Hub 排序/展示与 Showcase 基线，提速专项启动前 | [`perf-speed-restore-point-20260815062033.md`](./perf-speed-restore-point-20260815062033.md) |
| 1 | `restore-point/post-new-ui-20260807225313` | `66059468` | 2026-08-07 22:53:13 | **新版 UI 执行后（还需优化）** — 工作台 1.1-Beta 首版落地，布局样式待续精修 | [`new-ui-restore-point-20260807225313.md`](./new-ui-restore-point-20260807225313.md) |
| 1 | `restore-point/pre-new-ui-20260805233754` | `83318ee2` | 2026-08-05 23:37:54 | **新版 UI 执行前** — 工作台良品率/IM/企业 MCP/用户组基线 | [`new-ui-restore-point-20260805233754.md`](./new-ui-restore-point-20260805233754.md) |
| 1 | `restore-point/pre-workbench-yield-align-20260805093545` | `54da83ce` | 2026-08-05 09:35:45 | **工作台良品率对齐展示策略执行前** — 深度分析+落地计划前基线（含 Showcase 打包同步） | [`workbench-yield-align-restore-point-20260805093545.md`](./workbench-yield-align-restore-point-20260805093545.md) |
| 1 | `restore-point/post-partial-showcase-upload-20260804063414` ★ 部分案例上传 | `d0145ae8` | 2026-08-04 06:34:14 | **部分案例上传** — Showcase 案例上架与预览 UX | [`partial-showcase-upload-restore-point-20260804063414.md`](./partial-showcase-upload-restore-point-20260804063414.md) |
| 1 | `restore-point/post-cn-enterprise-compliance-20260802233012` ★ 企业合规 | `d1e241c8` | 2026-08-02 23:30:12 | **企业合规** — Hub/Skills 首包与 VAP 加固同批 | [`cn-enterprise-compliance-restore-point-20260802233012.md`](./cn-enterprise-compliance-restore-point-20260802233012.md) |
| 2 | `restore-point/post-vap-hardening-prep-20260802154147` ★ 准备加固vap | `95b66a43` | 2026-08-02 15:41:47 | **准备加固vap** — Showcase/营销基线与四线补强 | [`vap-hardening-prep-restore-point-20260802154147.md`](./vap-hardening-prep-restore-point-20260802154147.md) |
| 3 | `restore-point/post-distill-fix-1-20260731231925` ★ 蒸馏问题修复-1 | `169c92eb` | 2026-07-31 23:19:25 | **蒸馏问题修复-1** — 调研/蒸馏四线与加戏死循环 | [`distill-fix-1-restore-point-20260731231925.md`](./distill-fix-1-restore-point-20260731231925.md) |
| 4 | `restore-point/post-preview-template-homepage-20260731000320` ★ 预览模板+新首页 | `31ad76c0` | 2026-07-31 00:03:20 | **预览模板+新首页** — Preflight 预览资产与营销首页迭代 | [`preview-template-homepage-restore-point-20260731000320.md`](./preview-template-homepage-restore-point-20260731000320.md) |
| 5 | `restore-point/post-preview-template-20260730233622` ★ 预览模板 | `03a45def` | 2026-07-30 23:36:22 | **预览模板** — Preflight Studio 接线与营销站 | [`preview-template-restore-point-20260730233622.md`](./preview-template-restore-point-20260730233622.md) |
| 6 | `restore-point/post-grok-45-preflight-experiment-20260730184135` ★ Grok 4.5 | `2eaa31fc` | 2026-07-30 18:41:35 | **grok 4.5 开始实验** — Preflight Studio 与产品记忆同步 | [`grok-45-experiment-restore-point-20260730184135.md`](./grok-45-experiment-restore-point-20260730184135.md) |
| 7 | `restore-point/post-bento-path-team-workspace-20260729232200` | `2de7705c` | 2026-07-29 23:22:00 | Bento 预览分流、成果路径解析与团队协作 Sketch 扩展 | [`bento-path-team-workspace-restore-point-20260729232200.md`](./bento-path-team-workspace-restore-point-20260729232200.md) |
| 8 | `restore-point/post-nova-bento-slides-20260729080833` ★ Bento | `b5832404` | 2026-07-29 08:08:33 | **Nova Bento 幻灯** — SuperPreview 编辑器、Hub 置顶与写盘门控 | [`nova-bento-slides-restore-point-20260729080833.md`](./nova-bento-slides-restore-point-20260729080833.md) |
| 9 | `restore-point/post-chat-surface-sidebar-sdm-20260728225739` | `38cfb380` | 2026-07-28 22:57:39 | 对话 Surface 分层、侧栏注意力与 SDM 槽位匹配加固 | [`chat-surface-sidebar-sdm-restore-point-20260728225739.md`](./chat-surface-sidebar-sdm-restore-point-20260728225739.md) |
| 10 | `restore-point/post-zhipu-demo-stable-20260728210731` ★ 智谱 | `2873c348` | 2026-07-28 21:07:31 | **智谱演示稳定版本** — Skills Nova-fit、Hub 可见性与 SDM/PPT 加固 | [`zhipu-demo-stable-restore-point-20260728210731.md`](./zhipu-demo-stable-restore-point-20260728210731.md) |
| 11 | `restore-point/pre-skills-nova-fit-20260727233726` | — | 2026-07-27 23:37:26 | Skills Nova-fit G0 基线（matrix/flywheel/Cyber/GEO/PPT 批次前） | [`skills-nova-fit-restore-point-20260727233726.md`](./skills-nova-fit-restore-point-20260727233726.md) |
| 11 | `restore-point/post-four-line-sticky-summary-20260727233332` | `bafe064e` | 2026-07-27 23:33:32 | 四线 Sticky 成果汇总条与对话内成果指针同源 | [`four-line-sticky-summary-restore-point-20260727233332.md`](./four-line-sticky-summary-restore-point-20260727233332.md) |
| 12 | `restore-point/post-rail-sync-model-pool-20260727205149` | `2a264013` | 2026-07-27 20:51:49 | 侧栏切换成果同步、右栏 Rail 与模型池冗余 Key | [`rail-sync-model-pool-restore-point-20260727205149.md`](./rail-sync-model-pool-restore-point-20260727205149.md) |
| 13 | `restore-point/post-hf-studio-p0prime-speed-20260727104347` | `ff0769c1` | 2026-07-27 10:43:47 | HF Studio SuperPreview、P0′ 提速与四线/模型池加固 | [`hf-studio-p0prime-speed-restore-point-20260727104347.md`](./hf-studio-p0prime-speed-restore-point-20260727104347.md) |
| 14 | `restore-point/post-hyperframes-html-studio-hub-20260726103904` | `e828565e` | 2026-07-26 10:39:04 | HyperFrames 视频引擎、HTML Studio 与 Hub 批次扩展 | [`hyperframes-html-studio-hub-restore-point-20260726103904.md`](./hyperframes-html-studio-hub-restore-point-20260726103904.md) |
| 15 | `restore-point/post-sdm-goal-add-dock-export-20260724155156` | `4fa9d36a` | 2026-07-24 15:51:56 | SDM 目标追加累加、Dock 扩展与导出/续跑加固 | [`sdm-goal-add-dock-export-restore-point-20260724155156.md`](./sdm-goal-add-dock-export-restore-point-20260724155156.md) |
| 16 | `restore-point/post-deliverable-trust-ux-20260723162129` | `18d07142` | 2026-07-23 16:21:29 | 成果 Trust UX、验收 scope 过滤与 ES9 repair 四案 | [`deliverable-trust-ux-restore-point-20260723162129.md`](./deliverable-trust-ux-restore-point-20260723162129.md) |
| 17 | `restore-point/post-terminal-cold-resume-20260723050510` | `e39c9259` | 2026-07-23 05:05:10 | 终态会话冷续跑门控、侧栏执行态与切换成果同步 | [`terminal-cold-resume-restore-point-20260723050510.md`](./terminal-cold-resume-restore-point-20260723050510.md) |
| 18 | `restore-point/post-deliverable-false-complete-20260722132737` | `b17df418` | 2026-07-22 13:27:37 | 成果假完成加固、ES9 五案与 SDM 槽位匹配 | [`deliverable-false-complete-restore-point-20260722132737.md`](./deliverable-false-complete-restore-point-20260722132737.md) |
| 19 | `restore-point/post-task-stall-unpause-20260722094150` | `38e75922` | 2026-07-22 09:41:50 | 任务卡死 RCA、侧栏解暂停与执行态同步 | [`task-stall-unpause-restore-point-20260722094150.md`](./task-stall-unpause-restore-point-20260722094150.md) |
| 20 | `restore-point/post-stability-trust-terminal-20260721230151` | `822906e8` | 2026-07-21 23:01:51 | 稳定性 Trust 终态门控、续跑收敛与交付预览快路径 | [`stability-trust-terminal-restore-point-20260721230151.md`](./stability-trust-terminal-restore-point-20260721230151.md) |
| 21 | `restore-point/post-session-switch-ux-20260720223049` | `c0e69fa9` | 2026-07-20 22:30:49 | 侧栏会话切换加速、滚动恢复与预取门控 | [`session-switch-ux-restore-point-20260720223049.md`](./session-switch-ux-restore-point-20260720223049.md) |
| 22 | `restore-point/post-trust-stack-four-line-20260720210106` | `3b6354ef` | 2026-07-20 21:01:06 | Trust Stack 四线对齐、对话成果同步与 G700 评估 | [`trust-stack-four-line-restore-point-20260720210106.md`](./trust-stack-four-line-restore-point-20260720210106.md) |
| 23 | `restore-point/post-visual-asset-platform-20260720095342` | `b9af8a91` | 2026-07-20 09:53:42 | 视觉素材平台 VAP、成果绑定闭环与 G700 视觉验收 | [`visual-asset-platform-restore-point-20260720095342.md`](./visual-asset-platform-restore-point-20260720095342.md) |
| 24 | `restore-point/post-mingdi-g700-governance-20260719161743` | `6e829ab2` | 2026-07-19 16:17:43 | 鸣镝 G700 四线成果治理、官方素材链与质量验收链 | [`mingdi-g700-governance-restore-point-20260719161743.md`](./mingdi-g700-governance-restore-point-20260719161743.md) |
| 25 | `restore-point/post-hub-pinned-sections-20260715154906` | `1b3ccaa0` | 2026-07-15 15:49:06 | 能力中心置顶分区、展开更多与不可替代性审计 | — |
| 26 | `restore-point/post-compute-steady-state-train0-20260714082139` | `7d682eeb` | 2026-07-14 08:21:39 | 算力稳态 Train-0、Turn 队列、P0-4 校验 | [`compute-steady-state-train0-restore-point-20260714082139.md`](./compute-steady-state-train0-restore-point-20260714082139.md) |
| 27 | `restore-point/post-geo-report-design-system-20260713234629` | `02d9d456` | 2026-07-13 23:46:29 | NGRS v1 报告设计系统、ChartCatalog、主题模板 | [`geo-report-design-system-restore-point-20260713234629.md`](./geo-report-design-system-restore-point-20260713234629.md) |
| 28 | `restore-point/post-geo-hub-deliverable-derivation-20260713225501` | `c4d5daba` | 2026-07-13 22:55:01 | GEO Tab、成果派生、会话生命周期、Turn 队列 | [`geo-hub-deliverable-derivation-restore-point-20260713225501.md`](./geo-hub-deliverable-derivation-restore-point-20260713225501.md) |
| 29 | `restore-point/post-sdm-baseline-pipeline-gate-20260712123526` | `e5f3e94e` | 2026-07-12 12:35:26 | SDM 冻结、槽位匹配、侧栏切换管线门控 | [`sdm-baseline-pipeline-gate-restore-point-20260712123526.md`](./sdm-baseline-pipeline-gate-restore-point-20260712123526.md) |
| 30 | `restore-point/post-prompt-v2-checklist-tombstone-20260712003107` | `6c0d8b62` | 2026-07-12 00:31:07 | 提示词 v2、成果清单权威、会话墓碑、0710-T2 | [`prompt-v2-checklist-tombstone-restore-point-20260712003107.md`](./prompt-v2-checklist-tombstone-restore-point-20260712003107.md) |
| 31 | `restore-point/post-session-task-directory-stda-20260711083021` | `589c8cc6` | 2026-07-11 08:30:21 | STDA 会话任务目录、路径守卫、scopeDir 四线、0710-T1 | [`session-task-directory-stda-restore-point-20260711083021.md`](./session-task-directory-stda-restore-point-20260711083021.md) |
| 32 | `restore-point/post-0709-stability-hardening-20260710092903` | `427a89b9` | 2026-07-10 09:29:03 | 0709 续跑加固、模板契约、browser-compat | [`0709-stability-hardening-restore-point-20260710092903.md`](./0709-stability-hardening-restore-point-20260710092903.md) |
| 33 | `restore-point/post-deliverable-triple-unify-2026-07-09` | `1db5e094` | 2026-07-09 | UDC 交付三端统一、任务文件夹 API、0709-live | [`deliverable-triple-unify-restore-point-2026-07-09.md`](./deliverable-triple-unify-restore-point-2026-07-09.md) |
| 34 | `restore-point/post-rog-phase8-2-2026-07-08` | `db915cb1` | 2026-07-08 | ROG P8-2：交付 Dock、视频 env、Gateway 构建修复 | [`rog-phase8-2-restore-point-2026-07-08.md`](./rog-phase8-2-restore-point-2026-07-08.md) |
| 35 | `restore-point/post-rog-phase8-2026-07-07` | `99adc1ff` | 2026-07-07 | ROG P5–8：吴裕泰批次交付修复闭环验收全绿 | [`rog-phase8-restore-point-2026-07-07.md`](./rog-phase8-restore-point-2026-07-07.md) |
| 36 | `restore-point/post-goal-loop-phase4-2026-07-05` | `252c65d3` | 2026-07-05 | Goal Loop P4：交付门控、SDM 同源、汇总表契约 | [`goal-loop-phase4-restore-point-2026-07-05.md`](./goal-loop-phase4-restore-point-2026-07-05.md) |
| 37 | `restore-point/post-deliverable-summary-sdm-2026-07-04` | `f24be326` | 2026-07-04 | 交付汇总表 SDM hydrate、Modric 回归全绿 | [`deliverable-summary-sdm-restore-point-2026-07-04.md`](./deliverable-summary-sdm-restore-point-2026-07-04.md) |
| 38 | `restore-point/post-sdm-phase3-2026-07-03` | `40d44ac1` | 2026-07-03 | SDM Phase 3：会话交付清单、媒体 TTS/ASR、汇总 UI | [`sdm-phase3-restore-point-2026-07-03.md`](./sdm-phase3-restore-point-2026-07-03.md) |
| 39 | `restore-point/post-goal-loop-phase2-2026-07-02` | `c1f7b18e` | 2026-07-02 | Goal Loop P2：交付汇总门控、turn 墙钟、Skills 深评验收 | [`goal-loop-phase2-restore-point-2026-07-02.md`](./goal-loop-phase2-restore-point-2026-07-02.md) |
| 40 | `restore-point/post-word-super-preview-2026-07-02` | `d52a3e97` | 2026-07-02 | Word/PPT 超级预览：分页、留白、左栏缩略图 | [`word-super-preview-restore-point-2026-07-02.md`](./word-super-preview-restore-point-2026-07-02.md) |
| 41 | `restore-point/pre-stability-codex-grade-2026-06-26` | `5254a81f` | 2026-06-25 | Codex 级稳定性 P0 大改前基线（feature flag 默认 OFF） | — |
| 42 | `restore-point/pre-history-messages-accel-2026-06-20` | `832e9a47` | 2026-06-20 | 云端对话 history 加速（SANITIZE/TAIL_READ/CACHE）前 WIP | [`history-messages-accel-restore-point-2026-06-20.md`](./history-messages-accel-restore-point-2026-06-20.md) |
| 43 | `pre-skills-batch-2026-06-19` | `a4e07f97` | 2026-06-19 | Skills/MCP 三批次安装前基线 | [`skills-batch-restore-point-2026-06-19.md`](./skills-batch-restore-point-2026-06-19.md) |
| 44 | `restore-point/pre-conversation-catalog-2026-06-16` | `7a37fa76` | 2026-06-16 | SaaS `conversation_catalog` PG 化前基线 | [`conversation-catalog-spec.md`](./conversation-catalog-spec.md) §8 |
| 45 | `restore-point/pre-pg-phase1` | `58583434` | 2026-06-09 | PostgreSQL 控制面切换前 | [`saas-pg-phase1-runbook.md`](./saas-pg-phase1-runbook.md) |

---

## 二、SaaS 大版本检查点

| # | 标签 | 提交 | 日期 | 说明 | 详细文档 |
|---|------|------|------|------|----------|
| 9 | `checkpoint/post-saas-v2.1` | `c8528475` | 2026-06-07 | SaaS v2.1 Phase -1～3 + L5 验收完成 | [`saas-v2.1-completion.md`](./saas-v2.1-completion.md) |
| 10 | `restore-point/pre-saas-2026-06-06` | `3ca4deae` | 2026-06-06 | SaaS Phase -1 开工前基线（**仍有效**） | [`saas-restore-point.md`](./saas-restore-point.md) |
| 11 | `restore-point/pre-saas-2026-06-02` | `79972bc2` | 2026-06-04 | ⚠️ **已过时**，请用 #10 | [`saas-restore-point.md`](./saas-restore-point.md) |

---

## 三、上游 PilotDeck 合并还原点

| # | 标签 | 提交 | 日期 | 上游 commit | 说明 | QA 报告 |
|---|------|------|------|-------------|------|---------|
| 11 | `pre-pd-merge-non-im-1a575e21` | `c77ac7e6` | 2026-06-13 | `1a575e21` | 选择性 cherry-pick（排除 IM 整块） | [`merge-qa-report-non-im-1a575e21.md`](./merge-qa-report-non-im-1a575e21.md) |
| 12 | `pre-pd-merge-3891db5` | `4081905e` | 2026-06-10 | `3891db5` | 第四次上游合并前 | [`merge-qa-report-3891db5.md`](./merge-qa-report-3891db5.md) |
| 13 | `pre-pd-merge-7ec1f25` | `9b17b7c0` | 2026-06-06 | `7ec1f25` | 第三次上游合并前 | [`merge-qa-report-7ec1f25.md`](./merge-qa-report-7ec1f25.md) |
| 14 | `pre-pd-merge-33394d1` | `afcc3627` | 2026-06-03 | `33394d1` | 第一次上游合并前 | [`merge-qa-report-3c1ca3b.md`](./merge-qa-report-3c1ca3b.md) |
| 15 | `restore-point/pre-merge-2026-06-03` | `afcc3627` | 2026-06-03 | — | 与 #14 **同提交**（别名标签） | — |

---

## 四、发版 / 上游同步标签（非还原专用）

| 标签 | 提交 | 日期 | 说明 |
|------|------|------|------|
| `v260623` | `3a92a898` | 2026-06-23 | 合并上游 PR #271（cron run-now 修复） |
| `v0.1.0` | `d910662e` | 2026-06-10 | 上游 OpenBMB v0.1.0 合并点 |

---

## 五、常用命令

```bash
# 查看某还原点
git show restore-point/post-goal-loop-phase2-2026-07-02 --no-patch --format="%H %s %ci"

# 硬回退（丢弃之后所有提交）
git reset --hard restore-point/post-goal-loop-phase2-2026-07-02

# 从还原点开实验分支
git checkout -b experiment/my-branch restore-point/post-goal-loop-phase2-2026-07-02

# 只还原单个文件
git checkout restore-point/post-goal-loop-phase2-2026-07-02 -- path/to/file
```

---

## 六、新建还原点 SOP

1. **提交**：工作区干净，`git status` 无未跟踪/未提交重要改动  
2. **打标签**（命名：`restore-point/<pre|post>-<主题>-YYYYMMDDHHmmss`，取功能提交本地时间到秒）  
   ```bash
   TS=$(git log -1 --format=%cd --date=format:%Y%m%d%H%M%S)
   git tag -a "restore-point/post-<主题>-${TS}" -m "<一句话说明>"
   ```  
3. **写说明**：`docs/<主题>-restore-point-${TS}.md`（复制既有模板）  
4. **更新本表**：在「一、功能里程碑」顶部插入新行（**时间列**写 `YYYY-MM-DD HH:mm:ss`）  
5. **推送**（需用户明示）：`git push origin <tag>`

---

## 变更日志

| 日期 | 操作 |
|------|------|
| 2026-08-02 23:30:12 | 新增 ★ 企业合规 `restore-point/post-cn-enterprise-compliance-20260802233012` + `star/cn-enterprise-compliance` @ `d1e241c8`（**企业合规**） |
| 2026-08-02 15:41:47 | 新增 ★ 准备加固vap `restore-point/post-vap-hardening-prep-20260802154147` + `star/vap-hardening-prep` @ `95b66a43`（**准备加固vap**） |
| 2026-07-31 23:19:25 | 新增 ★ 蒸馏问题修复-1 `restore-point/post-distill-fix-1-20260731231925` + `star/distill-fix-1` @ `169c92eb`（**蒸馏问题修复-1**） |
| 2026-07-31 00:03:20 | 新增 ★ 预览模板+新首页 `restore-point/post-preview-template-homepage-20260731000320` + `star/preview-template-homepage` @ `31ad76c0`（**预览模板+新首页**） |
| 2026-07-30 23:36:22 | 新增 ★ 预览模板 `restore-point/post-preview-template-20260730233622` + `star/preview-template` @ `03a45def`（**预览模板**） |
| 2026-07-30 18:41:35 | 新增 ★ Grok 4.5 `restore-point/post-grok-45-preflight-experiment-20260730184135` + `star/grok-45-experiment` @ `2eaa31fc`（**grok 4.5 开始实验**，含 Preflight 迭代） |
| 2026-07-29 23:22:00 | 新增 `restore-point/post-bento-path-team-workspace-20260729232200` @ `2de7705c` |
| 2026-07-29 08:08:33 | 新增 ★ Bento `restore-point/post-nova-bento-slides-20260729080833` + `star/bento` @ `b5832404` |
| 2026-07-28 22:57:39 | 新增 `restore-point/post-chat-surface-sidebar-sdm-20260728225739` @ `38cfb380` |
| 2026-07-28 21:07:31 | 新增 ★ `restore-point/post-zhipu-demo-stable-20260728210731` + `star/zhipu-demo-stable` @ `2873c348`（**智谱演示稳定版本**） |
| 2026-07-27 23:33:32 | 新增 `restore-point/post-four-line-sticky-summary-20260727233332` @ `bafe064e` |
| 2026-07-27 20:51:49 | 新增 `restore-point/post-rail-sync-model-pool-20260727205149` @ `2a264013` |
| 2026-07-27 10:43:47 | 新增 `restore-point/post-hf-studio-p0prime-speed-20260727104347` @ `ff0769c1` |
| 2026-07-26 10:39:04 | 新增 `restore-point/post-hyperframes-html-studio-hub-20260726103904` @ `e828565e` |
| 2026-07-24 15:51:56 | 新增 `restore-point/post-sdm-goal-add-dock-export-20260724155156` @ `4fa9d36a` |
| 2026-07-23 16:21:29 | 新增 `restore-point/post-deliverable-trust-ux-20260723162129` @ `18d07142` |
| 2026-07-23 05:05:10 | 新增 `restore-point/post-terminal-cold-resume-20260723050510` @ `e39c9259` |
| 2026-07-22 13:27:37 | 新增 `restore-point/post-deliverable-false-complete-20260722132737` @ `b17df418` |
| 2026-07-22 09:41:50 | 新增 `restore-point/post-task-stall-unpause-20260722094150` @ `38e75922` |
| 2026-07-21 23:01:51 | 新增 `restore-point/post-stability-trust-terminal-20260721230151` @ `822906e8` |
| 2026-07-20 22:30:49 | 新增 `restore-point/post-session-switch-ux-20260720223049` @ `c0e69fa9` |
| 2026-07-20 21:01:06 | 新增 `restore-point/post-trust-stack-four-line-20260720210106` @ `3b6354ef` |
| 2026-07-20 09:53:42 | 新增 `restore-point/post-visual-asset-platform-20260720095342` @ `b9af8a91` |
| 2026-07-19 16:17:43 | 新增 `restore-point/post-mingdi-g700-governance-20260719161743` @ `6e829ab2`；总表补录 `post-hub-pinned-sections-20260715154906` |
| 2026-07-14 08:21:39 | 新增 `restore-point/post-compute-steady-state-train0-20260714082139` @ `7d682eeb` |
| 2026-07-13 23:46:29 | 新增 `restore-point/post-geo-report-design-system-20260713234629` @ `02d9d456` |
| 2026-07-13 22:55:01 | 新增 `restore-point/post-geo-hub-deliverable-derivation-20260713225501` @ `c4d5daba` |
| 2026-07-12 12:35:26 | 新增 `restore-point/post-sdm-baseline-pipeline-gate-20260712123526` @ `e5f3e94e` |
| 2026-07-12 00:31:07 | 新增 `restore-point/post-prompt-v2-checklist-tombstone-20260712003107` @ `6c0d8b62` |
| 2026-07-11 08:30:21 | 新增 `restore-point/post-session-task-directory-stda-20260711083021` @ `589c8cc6` |
| 2026-07-10 09:29:03 | 新增 `restore-point/post-0709-stability-hardening-20260710092903` @ `427a89b9`；命名规则改为秒级时间戳 |
| 2026-07-09 | 更新 `restore-point/post-deliverable-triple-unify-2026-07-09` 锚定至 `1db5e094`（含还原点文档） |
| 2026-07-09 | 新增 `restore-point/post-deliverable-triple-unify-2026-07-09` @ `d1179a95` |
| 2026-07-08 | 更新 `restore-point/post-rog-phase8-2-2026-07-08` 锚定至 `db915cb1`（含 AGENTS/还原点文档） |
| 2026-07-07 | 新增 `restore-point/post-rog-phase8-2026-07-07` @ `99adc1ff` |
| 2026-07-05 | 新增 `restore-point/post-goal-loop-phase4-2026-07-05` @ `252c65d3` |
| 2026-07-04 | 新增 `restore-point/post-deliverable-summary-sdm-2026-07-04` @ `f24be326` |
| 2026-07-03 | 新增 `restore-point/post-sdm-phase3-2026-07-03` @ `40d44ac1` |
| 2026-07-02 | 初版总表；收录 17 个标签；最新 `post-goal-loop-phase2-2026-07-02` |
