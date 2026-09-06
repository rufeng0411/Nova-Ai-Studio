# 任务驱动对话链路深度分析总报告

**版本**：1.0 | **日期**：2026-06-21  
**方法**：106 会话 JSONL 扫描 + 五重视角 memo + 5 场景走查 + 机制冲突矩阵 + PPT 案例 closure

---

## 执行摘要（决策层）

Nova 对话**链路稳定性**（resilience smoke、catalog、infra 续跑）已具备，但**任务完成率** especially PPT 类（**5.6%**）与用户「还要我打继续」的投诉一致。核心矛盾不是单点 bug，而是三套机制叠加：

1. **core-strategy** 要求「别停、别问继续、自动试」  
2. **续跑栈** 在 recovery_pause 有效，但对 **turn success 无交付** 长期漏判（近期已补 incompleteDeliverable）  
3. **澄清层缺失**，缺附件/Key 时模型 **猜参 + HTML 顶替** 而非问一句  

**优先投入（P0）**：会话级 capability binding、validate 驱动完成、slug 分支 tool_recovery、turn_progress 全链路续跑、Hub 能力 bypass 编排。

**目标 KPI（6 个月）**：交付类零干预完成率 **40%+**（基线 ~10%）；PPT 完成率 **60%+**（基线 5.6%）；用户干预率 **<8%**（基线 16–22%）。

---

## 1. 用户证据与 KPI

详见 [`task-completion-analysis-baseline-2026-06-21.zh-CN.md`](task-completion-analysis-baseline-2026-06-21.zh-CN.md)。

| 指标 | 基线 |
|------|------|
| 交付类干预率 | 21.6% |
| PPT .pptx 完成率 | 5.6% |
| TTFT p95 | 37.6s |
| memory_retrieve p95 | 5.0s |

**典型用户原声路径**：选 PPT 能力 → 附件 → 看步骤跑完 → **无文件** → 「继续，为什么停了」→ 仍 HTML/规划。

---

## 2. 架构与机制冲突

详见 [`analysis-memos/conflict-matrix-v1.zh-CN.md`](analysis-memos/conflict-matrix-v1.zh-CN.md)。

高冲突：**勿停 × 应澄清 × 泛化 recovery**。产品需裁决：何时允许 **1 条** structured 提问（Key/附件/页数）。

架构目标态：显式任务状态机 **Intake → Executing → Validating → Done**，阶段 checkpoint 再进入下一阶段（对标 Cursor/Devin/LangGraph，见 research-report-recovery）。

---

## 3. 分视角问题清单（摘要）

| 视角 | 文档 | Top-3 问题 |
|------|------|------------|
| 产品 | [product memo](analysis-memos/product-task-completion-memo.zh-CN.md) | 完成定义、试一下落差、过程误读 |
| 架构 | [architecture memo](analysis-memos/architecture-task-chain-memo.zh-CN.md) | success≠交付、binding 丢失、resume 未接线 |
| 研发 | [engineering memo](analysis-memos/engineering-task-chain-memo.zh-CN.md) | 测试盲区、recovery 文案、repeat guard 缺口 |
| 体验 | [ux memo](analysis-memos/ux-user-task-chain-memo.zh-CN.md) | 假完成、假卡住、越修越偏 |
| 前端 | [frontend memo](analysis-memos/frontend-task-chain-memo.zh-CN.md) | 续跑不可见、validate 闪没、stage 不同步 |

---

## 4. 案例 Closure

[`analysis-memos/ppt-interrupt-case-closure.zh-CN.md`](analysis-memos/ppt-interrupt-case-closure.zh-CN.md) — 沧海 24 页 PPT：

- turn1 **success** 仅 HTML；6× tool_recovery 误导  
- fix 后预期：`shouldAutoContinueAfterIncompleteDeliverableStop` + UI hook  
- 验收：replay 零用户「继续」且 `.pptx` verified  

---

## 5. 五场景走查

[`analysis-memos/scenario-walkthrough-5.zh-CN.md`](analysis-memos/scenario-walkthrough-5.zh-CN.md)

---

## 6. 优先级路线图

### P0（完成率杠杆，4–6 周）

| # | 项 | 影响面 | 风险 | 验收 | Fork |
|---|-----|--------|------|------|------|
| P0-1 | **会话级 capability binding** | 多轮 PPT/调研 | 中 | Hub 二轮 replay | UI+引擎 |
| P0-2 | **validate-before-complete** | 假完成 | 低 | validate API + 引擎门控 | 是 |
| P0-3 | **tool_recovery 按 slug** | 空转 HTML | 低 | anth-pptx 单测 | 是 |
| P0-4 | **turn_progress → resume** | 续跑丢上下文 | 中 | buildTaskResumeContext 集成 | 是 |
| P0-5 | **Hub bypass orchestrate** | 错工具 | 中 | nova-ppt/geo 路由测 | 是 |
| P0-6 | **Bridge deliverable_repair** | 缺文件续跑 | 低 | integration 脚本 | Bridge |

### P1（减试错/减干预，6–10 周）

| # | 项 |
|---|-----|
| P1-1 | 澄清门控：缺不可替代输入 → 1 条 ask（非 recovery 循环） |
| P1-2 | auto_continue 豁免「需用户 Key/附件」句式 |
| P1-3 | 跨 turn repeat guard（read_skill 同类） |
| P1-4 | Recovery 子预算按流程模板阶段 |
| P1-5 | prelaunch +3 skill 实跑（open-design, anth-docx, pd-geo） |

### P2（体验/性能）

| # | 项 |
|---|-----|
| P2-1 | 续跑弱提示 + 阶段进度条 |
| P2-2 | memory_retrieve 5s 超时 / 首 turn 跳过 |
| P2-3 | 续跑 turn 续接 stage hint（不重复 prepare 文案） |

每项实施 **单独立项**，带 prelaunch 切片，不与本分析文档混提交。

---

## 7. 验收与监控方案

### 7.1 日常命令

```bash
npm run analyze:task-completion          # KPI 扫描
npm run test:task-resilience:acceptance  # 离线门禁
npm run test:recovery-beijing-ai-report  # 调研 recovery
node --import tsx tests/agent/auto-continue-policy.test.ts
```

### 7.2 监控指标（建议写入 telemetry）

| 指标 | 采集点 |
|------|--------|
| task_completion_rate_by_slug | turn_deliverable_meta + validate |
| user_intervention_count | JSONL user 消息关键词 |
| auto_continue_count | recovery_events.jsonl |
| recovery_empty_spin_rate | recovery 后无新 artifact |
| ttft_first_visible_p95 | turn-timing.jsonl |

### 7.3 发布门禁（建议）

- 交付类 PPT 冒烟：1 条附件 docx → `.pptx` verified  
- 干预率回归：抽样 10 会话 ≤ 基线  
- `analyze:task-completion` 纳入 `test:prelaunch:quick` 可选切片  

---

## 8. 风险与边界

- 本报告 **不含** 换模型/prompt A/B（另立项）  
- dev 样本含 e2e/smoke，**生产 telemetry 需单独拉取**  
- transcript 分析已脱敏路径，勿提交用户附件内容  

---

## 9. 附录：文档索引

| 文档 | 用途 |
|------|------|
| [baseline](task-completion-analysis-baseline-2026-06-21.zh-CN.md) | KPI + 20 条标注 |
| [conflict-matrix-v1](analysis-memos/conflict-matrix-v1.zh-CN.md) | 机制冲突 |
| [ppt-closure](analysis-memos/ppt-interrupt-case-closure.zh-CN.md) | PPT 案例 |
| [scenario-5](analysis-memos/scenario-walkthrough-5.zh-CN.md) | 场景走查 |
| [product/arch/eng/ux/fe memos](analysis-memos/) | 五重视角 |
| [conversation-resilience-spec.md](conversation-resilience-spec.md) | 实现权威 |
| [task-soft-resume-spec.zh-CN.md](task-soft-resume-spec.zh-CN.md) | 软续跑 |

---

**分析计划状态**：Phase A/B/C 已完成。改进实施请按 P0→P1→P2 单独立项跟踪。
