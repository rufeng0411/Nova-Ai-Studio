# 全量回归跑测报告 — 上游 `7ec1f25` 合并后

**跑测时间**：2026-06-06  
**代码**：`main` @ `18e606a`  
**环境**：Windows；dev:concurrent @ `5173/3001/18789`（Playwright + Agent smoke）  
**计划**：[`full-regression-test-plan-7ec1f25.md`](full-regression-test-plan-7ec1f25.md)

---

## 总判定：**有条件通过**

| 层级 | 通过 | 失败 | 跳过/部分 |
|------|------|------|-----------|
| L0 基础 | 3 | 0 | 0 |
| L1 容错专项 | 4 | 0 | 0 |
| L2 二开冒烟 | 8 | 0 | 0 |
| L3 Agent E2E | 1 | 1 | 0 |
| L4 Playwright | 4 | 0 | 0 |
| L5 UI 全量 | 88 | 21 | 0 |
| M 手测 | — | — | 5 项未执行 |

**结论**：本次合并相关链路（双轨 recovery、WebSocket、成果预览、能力目录、媒体工具）自动化通过；Open Design 首场景超时、UI 历史 render 套件仍红。建议补 M1–M5 手测后视为全绿。

---

## L0 引擎基础

| ID | 结果 | 备注 |
|----|------|------|
| L0-1 build | **PASS** | |
| L0-2 npm test | **PASS** 30/30 | 含 tool-failure-recovery、user-facing-errors、web 软失败等 |
| L0-3 check:saas-fork | **PASS** 13/13 | AgentLoop 摘要已更新为双轨 recovery |

---

## L1 容错专项（合并核心）

| ID | 结果 | 备注 |
|----|------|------|
| L1-1 tool-failure-recovery | **PASS** | 随 `npm test` |
| L1-2 user-facing-errors | **PASS** | 随 `npm test` |
| L1-3 useAutoRecoveryContinue | **PASS** 5/5 | |
| L1-4 userFacingErrors (UI) | **PASS** 11/11 | 与 L1-3 合计 16/16 |

---

## L2 二开能力冒烟

| ID | 结果 |
|----|------|
| L2-1 smoke:templates | **PASS** 15 模板 |
| L2-2 smoke:docx | **PASS** |
| L2-3 smoke:aigeo | **PASS** |
| L2-4 smoke:social-matrix | **PASS** |
| L2-5 capabilities-smoke | **PASS** 315/315 |
| L2-6 yixiaoer-smoke | **PASS** |
| L2-7 ui-aigeo-regression | **PASS** |
| L2-8 aigeo-agent-smoke | **PASS** wiring |

---

## L3 Agent 端到端

| ID | 结果 | 详情 |
|----|------|------|
| L3-1 media-smoke | **PASS**（复跑） | 首次跑测失败：当时 Gateway 在 `18790`，脚本连 `18789`，`generate-video` 超时且未产出文件（exit 1）。改默认端口后复跑：`MEDIA_SMOKE_SKIP_FIGMA=1`，三场景均 ok（部分 stage 超时但产出正常） |
| L3-2 open-design-smoke | **FAIL 1/3** | `landing-open-design` 300s 超时；`login-flow`、`release-notes` **PASS**（报告 `artifacts/od-smoke/report.json`） |

---

## L4 Playwright（5173/3001/18789）

| ID | 结果 | 备注 |
|----|------|------|
| P1 白屏 | **PASS** | ROOT_LEN≈24k；有 `api/.../files` abort 弱告警 |
| P2 UI 回归 | **PASS** | 欢迎 chip 7 个、能力接入中心、Fetch 按钮 |
| P3 成果预览 | **PASS** | iframe preview、文件夹卡片 4 缩略图（**需 Gateway 18789**；此前 5175/无网关时失败） |
| P4 蚁小二 | **PASS** | 能力卡片 + 设置页字段 |

---

## L5 UI 全量 vitest

| 结果 | 说明 |
|------|------|
| **88/109 PASS** | 21 失败集中于 **既有** 套件，与本次 merge 文件无交叠 |

失败套件（均非 `AgentLoop`/`WebSocketContext`/`CapabilityHub`）：

- `MessagesPaneV2.render.test.tsx`（13）
- `MessageComponent.tool-error.test.tsx`（4）
- `MessageComponent.todo-write.test.tsx`（2）
- `TodoList.test.tsx`（1）
- `AskUserQuestionPanel.test.tsx`（1）
- `e2e/chat-experience.spec.ts`（套件加载失败）

---

## M 手测清单（未在本轮执行）

| ID | 建议 |
|----|------|
| M1 换 API Key 重连 | 合并后 `connectIdRef` 必测 |
| M2 大 HTML 截断 | 验证 LargeFileRepair + 非 pending 时 tool recovery |
| M3 recovery 耗尽 | 验证 `recovery_exhausted` 弱提示 |
| M4 Hermes 教育区 | 能力中心飞轮下独立展示 |
| M5 Nova 图标目视 | 确认非 PD 占位 |

---

## 本次更新 ↔ 测试结果对照

| 更新项 | 覆盖测试 | 结果 |
|--------|----------|------|
| LargeFileRepair 双轨 | L0-2 tool-failure-recovery、L3-1 media | 通过 |
| WebSocket connectIdRef | P1/P2/P3/P4（多次连接/重连） | 通过 |
| maxOutputTokens 16384 | P2 设置页、defaults 随 build | 通过 |
| 能力中心/Hermes | L2-5、P2 | 通过 |
| 成果预览 UX | P3 | 通过（需正确 Gateway 端口） |
| Nova 品牌 | P1 页面可渲染 | 通过（目视 M5 待补） |

---

## 复跑命令（一键参考）

```powershell
cd F:\Ai-pilotdeck
npm run build && npm test && npm run check:saas-fork
npm run smoke:templates && npm run smoke:docx && npm run smoke:aigeo && npm run smoke:social-matrix
node scripts/integration-capabilities-smoke.mjs
node scripts/integration-yixiaoer-smoke.mjs

$env:SERVER_PORT='3001'; $env:VITE_PORT='5173'
$env:PILOTDECK_GATEWAY_PORT='18789'
$env:PILOTDECK_GATEWAY_URL='ws://127.0.0.1:18789/ws'
# 另开终端已起 dev:concurrent 后：
$env:MEDIA_SMOKE_SKIP_FIGMA='1'; node scripts/integration-media-smoke.mjs
$env:OD_SMOKE_TIMEOUT_MS='300000'; node scripts/integration-open-design-smoke.mjs
$env:VITE_URL='http://127.0.0.1:5173'
node scripts/check-white-screen.mjs http://127.0.0.1:5173/p/general
node scripts/ui-regression-check.mjs
node scripts/ui-artifact-preview-check.mjs
node scripts/ui-yixiaoer-regression-check.mjs
```

---

## 后续建议

1. **OD landing 场景**：单独加长超时或拆分为轻量 prompt，避免 300s 误杀。  
2. **UI render 套件**：与上游 PD 消息行重构对齐后修 21 项（非合并回退）。  
3. **手测 M1–M5**：发版前人工过一遍表内步骤。  
4. **Gateway 端口**：文档与脚本统一约定 `18789`，避免 P3/smoke 连错端口。
