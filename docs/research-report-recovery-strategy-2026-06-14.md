# 调研报告 Recovery 策略与长对话对标（2026-06-14）

## 1. 北京 AI 转型报告失败复盘

| 现象 | 根因 |
|------|------|
| 调研前半段完成，无图表/Word | 模型走 `df-deep-research` → `read_file skills/` → `anth-docx` 长链，未写中间 md |
| Recovery 8 次用尽 | `auto_continue` 在「规划中」与 `tool_recovery`（HTML 导向文案）叠加消耗 |
| 界面长期「仍在思考」 | 终局失败被 `autoRecoveryContinue` 掩盖（已修 MessageRowV2） |
| 硬错误未快停 | `shouldFastFailClassification` 仅接在 **model 流**，工具 Key 错误仍走 tool_recovery |

## 2. 已做优化为何本次未生效

| 机制 | 设计意图 | 本次缺口 |
|------|----------|----------|
| RecoveryBudget ≤8 | 单 turn 总上限 | 多步交付（调研+图+Word）**合法步骤 > 8**；预算偏紧 |
| ToolFailureRepeatTracker | 同工具同输入 ≥2 次阻断 | 模型换参数读不同 skill 文件，未触发 |
| autoContinueStrict 默认 false | 安全 rollout | 「接下来生成图表」仍触发 auto_continue |
| capability-binding | Nova PPT 等 Hub 试用 | **流程模板**无执行绑定，仍按 relatedSkills 自由发挥 |
| turn_stage_hint | 阶段心跳 | Recovery 期间 Live 文案未随 stage 切换 |
| tool_recovery 文案 | 落地页/HTML | 调研报告场景未给 export_document 路径 |

## 3. 行业长对话怎么处理（对标）

| 产品/模式 | 做法 | 可借鉴 |
|-----------|------|--------|
| **Cursor / Claude 分步** | 计划可见、子目标可交付；失败在子目标内恢复 | 阶段产物强制落盘（01/03 md）再下一阶段 |
| **Devin / 任务代理** | Checkpoint + 状态机；上下文压缩与工具结果摘要 | `turn_stage_hint` + 禁止 skills/ 空转 |
| **OpenAI Deep Research** | 检索与写作分离；终稿结构化输出 | web_search → 单文件综述，再 export |
| **LangGraph / 工作流** | 有向图节点，节点失败局部重试 | 流程模板绑定执行路径，非仅预填 prompt |
| **Circuit breaker** | 同依赖连续失败开路 | ToolFailureRepeatTracker + HardFailStreak |

**结论**：长任务靠 **阶段 checkpoint + 路径收敛 + 分层预算**，不是靠单轮无限对话或统一 8 次重试。

## 4. 本次落地（引擎 + 模板）

### 4.1 路径收敛

- `config/process-templates.json` `research-report`：第三步改为 `export_document`；prompt 明确 `01/03.md` 目录。
- `src/saas/processTemplateExecutionPrompt.ts`：检测调研报告 turn，注入 `<research-report-execution>`（禁止 read_file skills/）。
- `buildToolRecoveryUserMessage`：调研场景专用恢复文案。

### 4.2 减少 Recovery 触发

- `shouldAutoContinueAfterAssistantText`：**工具成功后**若助手输出「接下来/下一步」等规划语，**不再** auto_continue（此前仅 strict 模式）。
- 调研执行绑定减少 skill 链失败 → 更少 tool_recovery。

### 4.3 分层重试策略

| 类型 | 判定 | 策略 | 默认上限 |
|------|------|------|----------|
| **硬失败** | `model_auth` / `model_billing` / `config` | 立即终局 + `recovery_exhausted` | **1** 次确认 |
| **硬失败（网关）** | `gateway_unreachable` | `HardFailStreakTracker` 连续同类 | **3** 次 |
| **可恢复** | 瞬态网络、工具换路、soft_fetch、auto_continue | recoverable lane | **12** 次（可配置） |
| **UI auto_continue** | recovery_pause 后新 turn | 共享 recoverable 剩余 | 同上 |

配置（`tools.resilience`）：

```yaml
recoverableMaxPerTurn: 12
hardFailMaxPerTurn: 3
maxRecoveryBudgetPerTurn: 8   # 仅当未设 recoverable 时作为兼容上限
```

实现：`RecoveryBudget` 双轨、`worstHardFailFromToolResults` + `AgentLoop` 工具结果快停。

### 4.4 建议上限（分析）

- **单步工具**（一次 web_search）：recoverable 3–4 足够。
- **标准三合一**（调研+图+Word）：recoverable **10–12**（每阶段 2–3 次换路 + 1–2 次 auto_continue）。
- **全量飞轮长任务**：recoverable **12–16**；超过 16 应拆 turn 或子会话，而非再加 recovery。
- **硬失败**：永不与 recoverable 混计；Key/欠费 **1** 次即停，避免用户干等 8 轮。

## 5. 验收

```bash
npm run test:recovery-beijing-ai-report
npm run smoke:resilience
npm run test:process-ux
```

`RUN_LIVE=1` 可在 dev:saas 下用流程模板「调研报告交付」填北京 AI 主题做全链路实测。

## 6. 后续（可选 Phase 2）

- [ ] `autoContinueStrict` 默认 true（需吴裕泰/Nova PPT 回归）
- [ ] 流程模板 ID → 执行绑定（与 capability-binding 同级）
- [ ] Recovery 期间 Live 文案跟随 `turn_stage_hint`
- [ ] `recovery-events.jsonl` 按 reason/tier 分桶报表
