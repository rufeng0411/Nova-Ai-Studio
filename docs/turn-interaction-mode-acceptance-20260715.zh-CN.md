# 对话 / 执行二分意图 — 验收报告（2026-07-15）

## 范围

本报告记录 **Binary Intent Gate**（`dialogue` / `execute` / `clarify`）首次落地结果，覆盖 P0–P3 计划项。

## Feature flags

| 开关 | 开发默认 | 生产默认 | 说明 |
|------|----------|----------|------|
| `PILOTDECK_BINARY_INTENT_GATE_SHADOW` | `1`（`devLauncherCore`） | `0`（`pack.mjs`） | 仅写遥测，不改变路由 |
| `PILOTDECK_BINARY_INTENT_GATE` | `1`（`devLauncherCore`） | `0`（`pack.mjs`） | 开启后生效三态硬行为 |
| `VITE_PILOTDECK_BINARY_INTENT_GATE` | `1`（`devLauncherCore`） | `0` | UI per-turn 门控 |

回滚：将 `PILOTDECK_BINARY_INTENT_GATE=0` 并 recreate 容器；已持久化的 `turn_interaction_mode` 仍可作为 cold-resume / repair 的安全 veto。

## 已实现模块

### P0 — 判定器与 shadow

- `src/saas/intent/resolveCurrentIntent.ts`：确定性优先级规则，无额外 LLM
- `src/saas/intent/resolveCurrentIntent.test.ts`：金标用例（马斯克聊聊、分析一下、继续、混合句等）
- `src/saas/intent/turnInteractionModeTelemetry.ts`：`binary_intent_gate_shadow` / `binary_intent_gate_applied` 遥测
- `src/saas/resilience/stabilityFlags.ts`：双开关

### P1 — 引擎接线

- `TurnRunner`：`recordAcceptedInput` 之后、SDM 之前判定；`clarify` 早退；`dialogue/clarify` 跳过 SDM/STDA
- `TranscriptEntry` + `JsonlTranscriptWriter`：`turn_interaction_mode`（`version:1`，同 `turnId` 幂等）
- `AgentLoop`：`dialogue` 强制 `tools=[]` + `toolChoice:none`；跳过 skill catalog；continuation 读 mode
- `PromptAssembler` / `DefaultContextRuntime`：`includeSkillCatalog` 门控
- `taskContinuationPolicy`：非 `execute` 禁止 repair / auto-continue
- `capabilitySessionBinding`：仅本回合 pending 绑定，不再每回合重放 stored
- `pilotdeck-bridge.js`：执行中竞态提交拒绝，不静默 abort

### P2 — 前端与记忆

- `readSessionMessages` + `messages.js`：透传 `turnInteractionMode` / `latestTurnInteractionMode`
- `ui/src/shared/turnInteractionUiPolicy.ts`：live dock / repair / composer strip 门控
- `ChatInterfaceV2` / `MessagesPaneV2`：接入 per-turn UI policy
- `IntentClarificationOptions` + `MessageRowV2`：轻量双选项 chips
- i18n：`chat.intentClarification.*`（中英文）
- cold-resume：`interaction_mode_not_execute` 抑制

### P3 — 灰度与打包

- `devLauncherCore.mjs`：dev shadow 默认开
- `pack.mjs`：生产双开关默认 `0`
- `config/pilotdeck-core-fork.manifest.json`：登记核心接线

## 验收命令（按依赖顺序）

```bash
npx vitest run src/saas/intent/resolveCurrentIntent.test.ts
npx vitest run src/saas/resilience/stabilityFlags.test.ts
npx vitest run ui/src/shared/turnInteractionUiPolicy.test.ts
npx vitest run ui/src/shared/capabilitySessionBinding.test.ts
npm run test:p0-p2:full
npm run test:sdm:acceptance
npm run test:goal-loop:acceptance:full
npm run test:process-ux
npm run smoke:capability-hub
npm run test:deliverable-triple-unify
npm run test:prelaunch:quick
```

## 金标预期（gate 开启后）

| 场景 | 期望 mode | 工具 | SDM 变更 |
|------|-----------|------|----------|
| 纯聊天 / 脑爆 | dialogue | 0 | 否 |
| 显式能力 / 模板 / 生成导出 | execute | 原链路 | 是 |
| 「帮我分析一下」等歧义 | clarify | 0 | 否 |
| 执行中并发提交 | 拒绝 + 保留草稿 | — | — |

## 已知限制

1. **灰度默认关**：生产部署后行为与旧路由一致，须先开 shadow 观察遥测再开 gate。
2. **UI 门控需双开**：Gateway `PILOTDECK_BINARY_INTENT_GATE=1` 时建议同步 `VITE_PILOTDECK_BINARY_INTENT_GATE=1` 打包 UI。
3. **流程模板显式绑定**：`isProcessTemplate` 未接入 `CapabilityBindingContext`，模板执行仍主要靠 goal 文案与现有 profile 链识别。

## 结论

**代码已落地，生产默认 OFF（零行为变更）**。开发环境默认 **gate + UI 门控 ON**（shadow 遥测同步开启），便于本地验证纯聊天不闪现「使用工具」过程区。
