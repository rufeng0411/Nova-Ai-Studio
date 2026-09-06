# 任务/对话完成稳定性：对标 Codex/Cursor 的可行性计划

> 日期：2026-06-25 ｜ 状态：待评审（暂未动引擎核心代码） ｜ 范围：`src/agent/loop`、`src/saas/resilience`、`src/saas/taskState`、`src/saas/final-acceptance`、UI 续跑钩子
>
> 定位：把「任务流 / 对话流」做到 **Codex / Cursor 级的任务完成稳定性**——任务一定跑完、不半途自断、不原地打转、不幻造交付物、断连可续。本计划接续本轮已交付的两块（只读空转熔断 `noProgressReadRepeatTracker`、WS 断连续跑补发 `shouldRefireTurnCompleteAfterReconnect`），只补真实缺口。

---

## 一、Codex/Cursor 级稳定的 6 条本质能力

| # | 本质能力 | Codex/Cursor 做法 | 一句话 |
|---|---|---|---|
| 1 | 确定性「完成」判据 | 有明确验收标准，达标才算完 | 不是「模型不说话了」就叫做完 |
| 2 | 进度感知的循环 | 每步必须有新进展，否则熔断 | 原地打转立刻被掐 |
| 3 | 生成退化自愈 | 检测重复/跑飞，截断重写 | 表格不会复读 100 行 |
| 4 | 质量验收（不止存在） | 跑测试/构建证明对 | 文件不光「在」，还得「对」 |
| 5 | 长任务上下文压缩 | 旧工具输出摘要化省 token | 不会烧 330 万 token |
| 6 | 崩溃可续、不丢目标 | 进度落盘，重启从断点续 | 断连/重启都接着干 |

## 二、现状盘点（已有底子）

| 已具备 | 模块 | 状态 |
|---|---|---|
| 双轨恢复预算（可恢复 12 / 硬失败 3） | `src/saas/resilience/recoveryBudget.ts` | 强 |
| 任务态状态机 | `src/saas/taskState/taskExecutionStateMachine.ts` | 有 |
| 软续跑（从 JSONL 重建 `<task-resume>`） | `src/session/resume/buildTaskResumeContext.ts` | 有 |
| 目标契约 + 终验 | `taskGoalContract.ts` / `final-acceptance/finalAcceptance.ts` | 有 |
| 失败重复 / 跨 turn 失败熔断 | `toolFailureRepeatTracker.ts` / `crossTurnToolFailureTracker.ts` | 有 |
| 只读空转熔断（本轮新增） | `src/agent/loop/noProgressReadRepeatTracker.ts` | 刚上 |
| WS 断连续跑补发（本轮新增） | `useAutoRecoveryContinue.shouldRefireTurnCompleteAfterReconnect` | 刚上 |
| 循环硬上限 | `AgentLoop.ts` `maxTurns` | 有 |
| docx 泛词去幻觉（本轮新增） | `taskGoalContract.ts` | 刚上 |
| 研究类去 mockup 噪音（本轮新增） | `processTemplateExecutionPrompt.ts` / `recoveryHints.ts` | 刚上 |

## 三、差距矩阵（真实缺口 ↔ 实际事故）

| 缺口 | 现状证据 | 对应事故 |
|---|---|---|
| 无生成退化检测 | `finalAcceptance.ts` 只查路径存在/坏链 | 「浙江省体彩中心」整列复读 100 行 |
| 空转只覆盖只读工具 | 新熔断器只认 read_file 等只读签名 | write/edit 空转、思考打转仍能溜 |
| 完成判据没接进循环 | `decideLoopContinuation.ts` 仅判「有没有工具调用」 | 模型不说话即结束、用户不回复就停 |
| 验收只看存在不看质量 | 终验无内容质量门 | 文件在但空/占位/跑题仍算过 |
| 无 in-turn 上下文压缩 | 循环全量携带 tool_result | 16 轮连读烧 330 万 token / 12 分钟 |
| 续跑依赖 JSONL（可被截断） | 软续跑扫 transcript；TAIL_READ 截断丢头是已知 P0 | 断连后目标丢失、重复已完成步骤 |

## 四、改进清单（做什么 / 好处 / 难度 / 风险）

> ⭐ = P0 必做，直接对应近期真实事故。

| 项 | 做什么 | 好处 | 难度 | 风险 & 缓解 |
|---|---|---|---|---|
| **C 生成退化熔断** ⭐ | 流式层检测重复 n-gram/行/表格行，超阈值截断重写一次；终验扫 .md/.html 表格退化 → `needs_repair` 定向重写 | 直接灭「复读表格」 | 中 | 模板合法重复误杀 → 高阈值 + 结构启发式 |
| **B 通用空转预算** ⭐ | 把只读熔断升级为 `ProgressLedger`：每轮须有新进展（新交付/新工具目标/计划步进），N 轮零进展 → 提示 → 收尾 | 灭 write/edit/思考打转 | 中 | 慢步骤误判 → 长单工具豁免 + 先提示后终止 |
| **H 完成门接入循环** ⭐ | 模型想停时先跑终验比对契约+计划；未达标且可修 → 引擎接管续跑（而非结束） | 灭「不说话就停 / 用户不回不续」 | 中（多为接线） | 修复死循环 → 受 B + 预算 + maxTurns 三重封顶 |
| **A 引擎计划账本** | 由契约派生有序步骤（调研→草稿→写交付→自检），每步 pending/done/verified；循环据此判去留 | 「完成」变确定性、不漏步 | 中-高 | 开放任务过死 → 允许动态改计划 |
| **D 质量验收** | 终验加廉价质量门：非空、无纯占位、表格列数一致、无退化、最小长度；代码类可挂 typecheck/lint | 文件「在且对」 | 中 | 过严藏好成果 → 软展示 + 温和修，绝不硬隐藏可解析文件 |
| **G 进度账本落盘（软）** | 每 turn 写极小 `turn-progress.json`（目标+计划+已验交付），续跑优先读它而非扫 JSONL | 断连/截断也不丢目标 | 中 | 额外写盘 → 极小、原子写；**不做** mid-turn 硬 checkpoint（沿用既定方针） |
| **F 单工具超时看门狗** | 每个工具调用软 deadline，超时取消并换备选/跳过 | 灭「卡某步整任务挂」 | 中 | 误杀长工具（视频生成）→ 按工具配 deadline |
| **E 上下文压缩** | 累计 token 超阈值时，旧 tool_result 摘要化（留路径+关键结论，丢原文） | 长任务不烧爆 token | 高 | 丢必要细节 → 留结构化摘要 + 可按需重读 |

## 五、分期路线图 + 出口门禁

| 阶段 | 含项 | 工期估 | 出口门禁 |
|---|---|---|---|
| **P0 止血** | C + B + H | ~1.5 周 | 新增退化/空转/完成门 fixture 回放绿；`test:dialogue-stability:full-chain` + `test:recovery:*` 全过 |
| **P1 加固** | A + D + G + F | ~3 周 | `test:p0-p2:full` 扩展；断连截断续跑专项；`analyze:task-completion --gate` 干预率下降 |
| **P2 长任务** | E +（可选）校验子代理 | ~4 周 | 长上下文 token 上限专项；`test:cloud:chat-load` 不退化 |

## 六、好处汇总

| 维度 | 现在 | 改造后 |
|---|---|---|
| 任务完成率 | 长任务易半途自断 | 接近 Codex/Cursor「必跑完」 |
| Token/耗时 | 可烧 330 万 token / 12 分钟空转 | 空转秒级熔断，长任务压缩省钱 |
| 成果质量 | 可能复读/占位/跑题 | 退化自愈 + 质量门拦截 |
| 断连体验 | 可能要用户打「继续」 | 自动续跑、目标不丢 |
| 可观测 | 散点 | 计划账本 + 进度账本，过程可回溯可验收 |

## 七、计划内冲突审阅（与既定方针的边界）

| 既定方针 | 本计划是否冲突 | 处置 |
|---|---|---|
| 基础设施软续跑，**不做 mid-turn 硬 checkpoint** | G 项可能被误读为硬 checkpoint | G 仅写「软」进度账本，**只在新 turn 构建 resume 提示时读取**，不做同 turn 硬快照，严守方针 |
| 自动恢复期间不让用户帮忙排查、不展示「重试」字样 | B/H/C 的提示文案 | 全部走 synthetic 注入模型侧 + 温和用户文案，纳入 `AGENT_RECOVERY_BOILERPLATE_PATTERNS` 过滤 |
| 不过严隐藏可解析成果 | D 质量门 | 质量门只降级为 `needs_repair`/软展示，绝不硬隐藏有 `resolvedPath` 的文件 |
| 需用户介入时禁止自动续跑 | H 完成门接管续跑 | H 仅在「可恢复 + 可修」时接管；命中 `userActionBlocker`/`clarificationGate` 一律让位 |
| 多文件交付门控仅 profile+goal 双命中 | A 计划账本派生步骤 | 计划账本沿用 `deliverableCapabilityProfiles`，不泛化到所有任务 |

## 八、发版门禁（怎么证明做到了）

复用现有套件：`test:dialogue-stability:full-chain`、`test:recovery-wuyutai` / `test:recovery-beijing-ai-report`、`test:p0-p2:full`、`analyze:task-completion --gate`、`test:pre-production`。

**新增对抗 fixture（并入全链路矩阵）：**
1. 退化复读：表格/段落同行重复 N 次 → 必须被截断/重写或标 `needs_repair`。
2. 写循环空转：连续 write 同一空内容/同路径 → 必须 nudge→terminal。
3. 长上下文烧 token：超长 tool_result 累积 → 必须触发压缩、token 不超上限。
4. 断连截断续跑：JSONL 头被 tail 窗口截断 → 必须从 `turn-progress.json` 恢复目标、不重复已完成步骤。

## 九、fork 登记预案（合并上游保护）

- 所有改动处加 `PD-SAAS-FORK` 注释，登记 `config/pilotdeck-core-fork.manifest.json`；新逻辑优先放 `src/saas/`、`src/agent/loop/` 既有 fork 区。
- 落地后跑 `npm run check:saas-fork` 与 `npm run brand:check`。
- 每项 PR 合并后跑对应门禁切片；全部合并、打包前跑综合验收，报告 `docs/task-completion-stability-acceptance-YYYYMMDD.md`。

## 十、建议下一步

P0 三项（C 退化熔断 + B 通用空转预算 + H 完成门接入）即可把近期「复读/空转/不续」全部止血，性价比最高、风险可控。等指令开工。
