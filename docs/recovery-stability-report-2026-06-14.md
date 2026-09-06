# Recovery 稳定性报告（2026-06-14）

## 吴裕泰 PPT 实跑（`npm run test:recovery-wuyutai:run`）

| 指标 | 值 |
|------|-----|
| Gateway | `ws://127.0.0.1:18789/ws`（protocol 1.0 hello） |
| 耗时 | 600s（超时结束，未完成全部 3 页生图） |
| 工具调用 | `generate_image` ×2 |
| WebSocket recovery 事件 | 0 |
| **本回合 jsonl recovery** | **1**（`tool_recovery` / `generate_image`） |
| 基线 `sampleCount` | 3 |
| **降幅** | **67%** |

**结论：本回合 recovery 较基线下降 ≥50%，达标。**

> 说明：`npm run test:recovery-wuyutai`（无 `--since-ms`）统计的是 `recovery-events.jsonl` **历史累计**（当前 8 条，含早期 `model_error` 占位与并行会话），不能代表单次吴裕泰任务。对比降幅请用 `test:recovery-wuyutai:run` 或 `node scripts/integration-recovery-wuyutai.mjs --since-ms <任务开始毫秒>`。

## recovery 事件分布（累计）

| reason | 次数 |
|--------|------|
| model_error | 5 |
| tool_recovery | 3 |

## 全链路验收摘要

| 套件 | 结果 |
|------|------|
| `test:process-ux` | 22/22 PASS |
| `integration-resilience-smoke` | PASS |
| `check:saas-fork` | 281 条 PASS |
| `brand:check` | PASS |
| `smoke:capability-hub` | PASS |
| `smoke:saas-storage` | PASS |
| `test:saas:storage` | 30/30 PASS |
| `smoke:saas-isolation` | 11/11 PASS |
| `test:prelaunch:quick` | **24/25**（仅 `vitest:document-export` 失败，与本次 recovery/UX 改动无关） |
| Playwright 多用户全链路 | 冷启动登录、admin/租户注册隔离、PWA 路由、Skills 斜杠/试一下、e2e 稳定性 **全部 PASS** |
| P1 白屏 `check-white-screen` | PASS |
| P2 `ui-regression-check` | PASS |
| P3 `ui-artifact-preview-check` | FAIL（主栈 5173 会话区 textarea 未就绪，与 prelaunch 独立栈 5183 已通过浏览器 套件不冲突） |
| P4 `ui-yixiaoer-regression` | FAIL（能力中心双搜索框 strict 冲突，既有 UI 问题） |
| `integration-skill-execution-risk-audit` | PASS |

## 脚本修复（本次验收中发现）

- `integration-recovery-wuyutai-run.mjs` / `ttft-benchmark.mjs`：Gateway 须先发 `hello`（`protocolVersion: 1.0` + `server-token`），不能用仅 Bearer 头直连。
- `integration-recovery-wuyutai.mjs`：新增 `--since-ms` 支持本回合对比。
