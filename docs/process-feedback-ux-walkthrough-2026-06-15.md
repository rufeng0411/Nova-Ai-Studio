# 过程反馈 UX 走查报告（2026-06-15）

## 范围

2 用户 × 4 场景矩阵（计划 L6），本报告结合 **离线自动化** + **recovery 基线对比**；Live Gateway 长任务需 `dev:saas` + `PROCESS_NIGHTLY_LIVE=1`。

## 场景矩阵

| 用户 | 任务 | 模板/能力 | 验收要点 |
|------|------|-----------|----------|
| admin | 调研报告 | `research-report` | 无 `read_file skills/` 空转；主 UI 无禁用词 |
| admin | 内容飞轮 | `content-flywheel` | 分阶段 `write_file`；过程 dock 单一 |
| uat（模拟） | 多平台内容矩阵 | ROG 油条 / `content-matrix` | `detectContentMatrixTurn` + 执行块注入 |
| uat（模拟） | Nova 幻灯 | `nova-ppt-aesthetic-slides` | manifest 校验；导出路径不 panic |

## 自动化结果

| 层级 | 命令 | 结果 |
|------|------|------|
| L1 | `npm run test:process-ux:full` | Vitest：Copy Voice 禁用词、`ProcessClueStrip`、`RecoveryGuidanceCard`、`MessagesPaneV2`、`InformalProcessStack` |
| L2 | `npm run smoke:resilience` | 预算/出站 gate；`outboundFetchRetries` 默认 **1** |
| L3 | `npm run test:multi-skill:matrix` | 4 场景 prompt 绑定 + zh `working/recovery/process` 文案 |
| L4 | `npm run test:multi-user:sim` | 需 Gateway；默认 SKIP，设 `PROCESS_NIGHTLY_LIVE=1` |
| L5 | `ui/e2e/saas/process-ux-live.spec.ts` | Playwright：无恐慌文案、dock 存在、无内联 clue |

## Recovery 基线对比

| 指标 | 文案改造前快照 | 当前（同日志切片） |
|------|----------------|-------------------|
| 样本数 | 13 | 13 |
| `tool_recovery` | 7 次，avg budget 9 | 7 次，avg budget 9 |
| `model_error` | 6 次，avg budget 7 | 6 次，avg budget 7 |

> 说明：P0/P1 代码变更（Gateway `budgetRemaining` 透传、soft_fetch/auto_continue 去重、出站/Router 默认退避收紧）需 **同 prompt 重跑 Live 任务** 后 `recovery-events.jsonl` 才会体现 P50 下降。离线矩阵与 Vitest 已覆盖「少触发」逻辑与文案合规。

快照文件：

- 改造前：`docs/recovery-baseline-pre-copy-2026-06-14.json`
- 当前：`docs/recovery-baseline-2026-06-15.json`

## Copy Voice 检查表

- [x] 主 live 行无 `(attempt/max)` — `MessagesPaneV2.getLiveStatusStep`
- [x] Pill：`调整中` / `继续推进` — `ProcessClueStrip` + `chat.json`
- [x] 耗尽卡片：`这一步还需要一点时间` — `RecoveryGuidanceCard`
- [x] Bridge `errorHints` 去除「自动换方案重试」
- [x] 引擎 `DEFAULT_ERROR_LABELS_ZH/EN` 柔和化
- [x] Vitest 禁用词扫描 — `userFacingErrors.copy.test.ts`

## 建议后续 Live 验收

```bash
npm run dev:saas
npm run test:recovery-beijing-ai-report:run
npm run recovery:baseline
PROCESS_NIGHTLY_LIVE=1 npm run test:process-resilience:nightly
```

对比同一 prompt 两次运行的 `recovery-events.jsonl` 与 `turn-timing.jsonl` 中 `recovery_attempt` 计数。

## 门禁

- `test:prelaunch:quick` 已接入：`test:process-ux:full`、`smoke:resilience`、`test:multi-skill:matrix`
- 全量夜间：`npm run test:process-resilience:nightly`
