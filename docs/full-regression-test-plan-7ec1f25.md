# 全量回归测试计划 — 上游 `7ec1f25` 合并后

**基准**：`main` @ `18e606a`（含物化 WIP + merge `ee09bd0`）  
**还原点**：`pre-pd-merge-7ec1f25` @ `9b17b7c`  
**跑测日期**：2026-06-06  
**报告**：[`full-regression-test-report-7ec1f25.md`](full-regression-test-report-7ec1f25.md)

---

## 一、本次更新范围（测什么）

### A. 上游 14 提交（`840f9ee..7ec1f25`）

| 模块 | 变更 | 测试重点 |
|------|------|----------|
| `LargeFileRepair` + `AgentLoop` | 大文件截断续写、熔断与 repair 状态机 | 工具 recovery 单测、长 HTML write_file、双轨不抢回合 |
| `WebSocketContext` | `connectIdRef`、token 变更重连 | 白屏、对话列表、改 API Key 后重连 |
| 默认 `maxOutputTokens` | 8192→16384 | 设置页 placeholder、模型 defaults |
| 流式/客户端 | `normalizeStreamEvent`、`GatewayBrowserClient` | 对话流式、Gateway 握手 |
| `formatValidationError` | 工具校验文案 | 无效工具参数提示 |

### B. 物化二开（merge 前提交）

| 模块 | 测试重点 |
|------|----------|
| Nova 品牌 | favicon/wordmark 资源存在、页面可加载 |
| 能力中心 + Hermes Edu | catalog 315 条、smoke 0 缺失、UI 卡片 |
| `useAutoRecoveryContinue` | UI 单测 5/5、recovery 事件 |
| smoke 脚本修补 | P2 New Chat、P3 preview iframe、capabilities repo-only |
| providerHub | 能力接入中心、拉取模型列表 |

---

## 二、影响面矩阵（间接波及）

| 链路 | 上游改动 | 二开叠加 | 必测 |
|------|----------|----------|------|
| 对话→工具→截断 | LargeFileRepair | toolFailureRecovery | L0 单测 + media smoke |
| 对话→断线 | connectIdRef | websocket-reconnected、autoRecovery | P1/P2 + 手测换 token |
| 成果预览 | write_file 路径 | deliverables 面板、iframe | P3 |
| 能力发现 | — | CapabilityHub、Hermes 区 | capabilities smoke + P2 |
| 媒体生成 | stream 小修 | generate_* 工具 | media smoke |
| Open Design | — | od-* 技能链 | OD agent smoke |
| GEO / 蚁小二 / 模板 | — | 既有 L2 整合 | 各 smoke + P4 |

---

## 三、测试分层与命令

### L0 引擎基础（必过）

| ID | 命令 | 对应能力 |
|----|------|----------|
| L0-1 | `npm run build` | 全仓 TS 编译 |
| L0-2 | `npm test` | 引擎 30 项单测 |
| L0-3 | `npm run check:saas-fork` | fork 标记 13 条 |

### L1 容错专项（本次合并核心）

| ID | 命令 | 说明 |
|----|------|------|
| L1-1 | `npm test`（含 `tool-failure-recovery`） | 工具 recovery 注入逻辑 |
| L1-2 | `npm test`（含 `user-facing-errors`） | 温和提示文案 |
| L1-3 | `npx vitest run useAutoRecoveryContinue.test.ts` | 自动续跑 UI 钩子 |
| L1-4 | `npx vitest run userFacingErrors.test.ts` | UI 侧错误映射 |

### L2 二开能力冒烟（静态/脚本）

| ID | 命令 |
|----|------|
| L2-1 | `npm run smoke:templates` |
| L2-2 | `npm run smoke:docx` |
| L2-3 | `npm run smoke:aigeo` |
| L2-4 | `npm run smoke:social-matrix` |
| L2-5 | `node scripts/integration-capabilities-smoke.mjs` |
| L2-6 | `node scripts/integration-yixiaoer-smoke.mjs` |
| L2-7 | `node scripts/ui-aigeo-regression-check.mjs` |
| L2-8 | `node scripts/integration-aigeo-agent-smoke.mjs` |

### L3 Agent 端到端（需 Gateway `18789`）

前置：`npm --workspace ui run dev:concurrent`（`SERVER_PORT=3001` `VITE_PORT=5173` `PILOTDECK_GATEWAY_PORT=18789`）

| ID | 命令 | 环境变量 |
|----|------|----------|
| L3-1 | `node scripts/integration-media-smoke.mjs` | `MEDIA_SMOKE_SKIP_FIGMA=1` |
| L3-2 | `node scripts/integration-open-design-smoke.mjs` | `OD_SMOKE_TIMEOUT_MS=300000` |

### L4 Playwright 实机（需 dev:concurrent）

| ID | 命令 | 说明 |
|----|------|------|
| P1 | `node scripts/check-white-screen.mjs http://127.0.0.1:5173/p/general` | 白屏/根节点 |
| P2 | `VITE_URL=5173 node scripts/ui-regression-check.mjs` | 欢迎 chip、能力接入中心 |
| P3 | `VITE_URL=5173 node scripts/ui-artifact-preview-check.mjs` | 成果 iframe、文件夹卡片 |
| P4 | `VITE_URL=5173 node scripts/ui-yixiaoer-regression-check.mjs` | 蚁小二能力区 |

### L5 UI 全量单测（基线）

| ID | 命令 | 说明 |
|----|------|------|
| L5-1 | `npm run test:ui:unit` | 109 项；已知 21 项 `MessagesPaneV2.render` 等历史失败 |

### M 手测清单（自动化未覆盖）

| ID | 场景 | 步骤 |
|----|------|------|
| M1 | 换模型池 API Key | 设置→保存→观察会话列表不空、无重复连接错乱 |
| M2 | 大 HTML 截断 | 对话要求 write 超长 HTML，观察续写而非 tool 死循环 |
| M3 | recovery 耗尽 | 断网或坏 Key 触发 5 次 recovery 后弱提示 + 可发「继续」 |
| M4 | 能力中心 Hermes 区 | 飞轮下方独立「教育学习」区、卡片可「试一下」 |
| M5 | Nova 图标 | 侧栏/标签页为 logo-3 蓝标（非 PD 文字） |

---

## 四、通过门槛

- **发布门槛**：L0 全绿 + L1 全绿 + L2 全绿 + P1/P2/P4 绿 + P3 绿（需 Gateway 18789）
- **有条件通过**：L3-2 任一场景超时、L5 历史失败套件未修、M 手测未做

---

## 五、环境约定

```powershell
cd F:\Ai-pilotdeck
$env:SERVER_PORT='3001'
$env:VITE_PORT='5173'
$env:PILOTDECK_GATEWAY_PORT='18789'
$env:PILOTDECK_GATEWAY_URL='ws://127.0.0.1:18789/ws'
npm --workspace ui run dev:concurrent
```

Agent smoke 脚本硬编码 `ws://127.0.0.1:18789/ws`；勿仅用 `18790` 端口起 Gateway。
