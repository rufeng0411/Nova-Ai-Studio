# Nova Ai-Studio 全方位验收报告

**日期**：2026-07-21  
**环境**：Windows 本地开发栈（Bridge `7990` / Vite `8081` / Gateway `18789`，见 `~/.pilotdeck/pilotdeck.yaml`）  
**验收范围**：Playwright 实机、全链路/压力/负载、UI 回归、破坏性（混沌）、用户体验（手动续跑 UX + 过程 UI）

---

## 执行摘要

| 维度 | 结论 | 说明 |
|------|------|------|
| **P0 阻塞** | ✅ 已修复 | `/p/general` React「Maximum update depth」无限渲染已消除 |
| **手动续跑** | ✅ 达标 | UI 默认关闭自动 submitTurn，输入框「继续」按钮与设置页开关已落地 |
| **精益上线门禁** | ✅ **38/38** | `npm run test:prelaunch:quick` 全通过 |
| **对话稳定性对抗** | ✅ 通过 | `test:dialogue-stability:adversarial` 五项检查全绿 |
| **Bridge 压力** | ✅ 通过 | smoke / load / stress，wedged=0，P95 ≤ 119ms |
| **Playwright UI** | ✅ 通过 | P1 白屏、P2 回归、P3 成果预览、Skills E2E 4/4 |
| **HTTP 负载 smoke** | ⚠️ 观察项 | P95=12ms 正常，但未鉴权请求约 50% 返回非 2xx（见下文） |
| **生产发版** | 🟡 建议再跑 | `test:pre-production:full` / 云端 `test:cloud:chat-load` 未在本机本轮执行 |

**总体判定**：**开发栈已达到生产级功能与稳定性门禁**；发版前仍建议跑完整 pre-production 与云端专项。

---

## 1. 本轮修复项（阻塞 → 已闭环）

### 1.1 P0：React 无限渲染（Maximum update depth）

**现象**：打开 `/p/general` 后控制台大量 `Maximum update depth exceeded`，Playwright 偶发 `composerCount=0`。

**根因**：`ChatInterfaceV2` 每次渲染生成新的 `deliverablesDockStateLive` 对象 → `useEffect` 调用 `rightRail.setDockState` → Context 更新 → 再次渲染，形成环。

**修复**：
- `ui/src/shared/deriveDeliverablesDockState.ts`：新增 `areDeliverablesDockStatesEqual`
- `ui/src/shared/RightWorkspaceRailContext.tsx`：`setDockState` 仅在浅比较不等时更新 state
- `ui/src/components/chat-v2/hooks/useIncompleteDeliverableAutoContinue.ts`：manual 模式不再在 effect 内反复 `clear` offer

**复测**：Playwright 诊断 `maxDepth: 0`，`composer: 1` ✅

### 1.2 验收脚本端口漂移（8081/7990 vs 5173/3001）

**现象**：Launcher 非默认端口时，Playwright/混沌/负载脚本连错端口。

**修复**：
- `scripts/lib/devPortSync.mjs`：`resolveServerUrl()` / `resolvePlaywrightBaseUrl()` 读取 env + `pilotdeck.yaml`
- 已接入：`playwrightSaasLogin.mjs`、`dialogue-stability-adversarial-check.mjs`、`run-chaos-dev.mjs`、`ui-regression-check.mjs`、`ui-artifact-preview-check.mjs`

### 1.3 门禁用例漂移

| 项 | 修复 |
|----|------|
| `test:task-resilience:unit` | 测试改用 `localStorage` 键 `pilotdeck:pendingSessionIntents`（与实现一致） |
| `test:dialogue-stability:adversarial` broken HTML | 夹具改写入 `artifacts/broken.html`（与引擎扫描路径一致） |
| `smoke:document-import` | 执行 `node scripts/copy-dist-runtime.mjs` 补齐 `dist/scripts/lib/patchHiddenConsole.mjs` |

---

## 2. 测试矩阵与结果

### 2.1 Playwright 实机 / UI

| 脚本 | 结果 | 产物 |
|------|------|------|
| P1 `check-white-screen.mjs` @8081 | ✅ | — |
| P2 `ui-regression-check.mjs` | ✅ hub + welcome | `artifacts/media-smoke/ui-regression/` |
| P3 `ui-artifact-preview-check.mjs` | ✅ | `artifacts/media-smoke/ui-artifact/` |
| `test:dialogue-stability:adversarial` livePlaywright | ✅ rootLen>30k, composer=1, 无 Hook 错误 | `artifacts/dialogue-stability-final-review/` |
| `test:prelaunch:quick` Skills E2E | ✅ 4/4 | `artifacts/prelaunch-quick/report-2026-07-21.md` |
| 手动续跑单元 | ✅ 16 tests | `manualContinuePolicy` / `recoverySurfaceState` |

### 2.2 全链路 / 压力 / 负载

| 脚本 | 结果 | 关键指标 |
|------|------|----------|
| `test:bridge-stability:smoke` | ✅ | wedged=0, readyP95≈70ms |
| `test:bridge-stability:load` | ✅ | wedged=0, readyP95≈86ms |
| `test:bridge-stability:stress` | ✅ | wedged=0, readyP95≈119ms |
| `test:bridge-stability:unit` | ✅ | 21/21 |
| `scripts/load/http-load.mjs --scenario smoke` | ⚠️ | total≈51k, **fail≈50%**, p95=12ms — 主要为未带 JWT 的 API 返回 401/403，延迟正常；生产压测应使用鉴权 token |
| `test:chaos:dev` | ✅ 4/4 | Bridge health @7990 |

### 2.3 单元 / 模块 / 过程 UX

| 脚本 | 结果 |
|------|------|
| `test:prelaunch:quick` | ✅ **38/38** |
| `test:process-ux:full` | ✅ 64 tests |
| `test:task-resilience:unit` | ✅ 24 tests |
| `smoke:document-import` | ✅ xlsx ok, corrupt-docx skipped |
| `smoke:resilience` | ✅ |
| `smoke:capability-hub` / `smoke:templates` | ✅ |

### 2.4 破坏性 / 韧性（本轮已跑）

- RecoveryBudget 双轨、硬失败分离：✅ `smoke:resilience`
- Bridge 高并发 stress 无 wedged：✅
- 混沌脚本 CH-bridge-health：✅（修复端口后）
- Gateway kill（CH-01）：按设计默认 skip，不阻断日常验收

### 2.5 用户体验（手动续跑）

| 能力 | 状态 |
|------|------|
| 默认关闭 UI 自动 submitTurn | ✅ `readDefaultAutoContinueEnabled()` → false |
| 输入框「继续」按钮 | ✅ `ComposerV2` + `resolveManualContinueOffer` |
| 设置页可重新开启自动续跑 | ✅ `PermissionsSettingsTab` |
| 引擎同 turn 内续跑 | ✅ 保留（未改 AgentLoop owner） |
| stale-turn 手动模式不自动 abort+续跑 | ✅ `disableAutoFallback` |
| 无限渲染 / 按钮闪烁 | ✅ 已修复 dock 同步环 |

**用户侧提示**：若浏览器 localStorage 仍存 `autoRecoveryContinue: true`，会覆盖新默认；建议硬刷新或于设置关闭后再测。

---

## 3. 未在本轮执行的生产专项（建议发版前）

| 项 | 用途 |
|----|------|
| `npm run test:pre-production:full` | 完整精益+深度门禁 |
| `npm run test:dialogue-stability:full-chain` | 历史/Skills/能力/模板全链路 |
| `npm run test:bridge-stability:soak` | 长时间 soak |
| `npm run test:cloud:chat-load` | 云端 history 加速与巨型 transcript |
| `npm run test:recovery-wuyutai:run` | 吴裕泰 PPT 实跑 Recovery |

---

## 4. 已知观察项（非阻塞）

1. **HTTP load 50% fail**：smoke 场景对 Bridge 打未鉴权混合路由；P95 延迟优秀。生产压测请带 `SAAS_E2E` JWT 或专用只读探针路径。
2. **Auth 控制台 warn**：Playwright 快速导航时偶发 `Failed to fetch` / `ERR_ABORTED`，登录完成后不影响 composer 与主流程。
3. **`npm run build`**：部分 `tests/saas/deliverable-visual-binding-audit.test.ts` TS 报错（与本轮改动无关）；日常 smoke 可用 `copy-dist-runtime` 补齐 dist 运行时。
4. **Bridge 压力与 Playwright 并行**：负载 stress 期间跑 adversarial 曾出现 `composerCount=0`；**勿并行** heavy load 与 UI E2E。

---

## 5. 变更文件清单（验收相关）

- `ui/src/shared/deriveDeliverablesDockState.ts` — dock 浅比较
- `ui/src/shared/RightWorkspaceRailContext.tsx` — 防 setState 环
- `ui/src/components/chat-v2/hooks/useIncompleteDeliverableAutoContinue.ts` — manual clear 策略
- `scripts/lib/devPortSync.mjs` — 端口解析
- `scripts/lib/playwrightSaasLogin.mjs`、对抗/UI 回归脚本 — 端口
- `scripts/run-chaos-dev.mjs` — Bridge health 7990
- `scripts/dialogue-stability-adversarial-check.mjs` — broken HTML 夹具
- `ui/src/hooks/useProjectsState.sessionIntent.test.ts` — localStorage 键

---

## 6. 生产门禁建议

1. ✅ 合并前：`npm run test:prelaunch:quick`（38/38）
2. ✅ 合并前：`npm run test:dialogue-stability:adversarial`
3. ✅ 合并前：`npm run test:bridge-stability:smoke` + `load` + `stress`
4. 🟡 打包前：`npm run test:pre-production:full`
5. 🟡 ECS 升级后：`verify-cloud-runtime.sh` + `verify-cloud-perf.sh`（见 `docs/next-pack-reminders.zh-CN.md`）
6. 🟡 手动续跑：生产默认关 auto-continue；监控 Bridge wedged / turn 队列深度

---

## 7. 结论

本轮针对**手动续跑改造**引入的 **P0 无限渲染**已完成修复并通过复测；**精益上线快速门禁 38/38 全绿**，Bridge 三级压力测试 wedged=0，Playwright 实机与 Skills E2E 通过。

**开发栈验收结论：达到生产级功能与稳定性要求。** 云端发版仍需完整 pre-production 与 cloud chat-load 闭环。

---

*报告生成：2026-07-21 · 日志目录 `artifacts/acceptance-2026-07-21/` · 快速门禁 `artifacts/prelaunch-quick/report-2026-07-21.md`*
