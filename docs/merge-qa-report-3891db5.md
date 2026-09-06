# 上游合并评测报告 — `3891db5`

**日期**：2026-06-10  
**合并提交**：`bbd4ffa`（`integrate/pd-upstream-3891db5` → `main` ff-only）  
**还原标签**：`pre-pd-merge-3891db5` @ `4081905`  
**上游范围**：`7ec1f25..3891db5`（51 提交）  
**本地基线**：`5858343`（隔离/记忆/能力）+ `c67b1bd`（PG/Nova/OCR）+ Phase0 预检 commit

---

## 总判定：**有条件通过**

引擎编译、核心单测、fork 登记（80 条）、L2 smoke、SaaS PG 47/47、SaaS 隔离、记忆 continuity 均通过。  
22 个 Git 冲突已按 v3 手册解决（双轨 recovery + basePermissionMode + shared-WS ping + PG fork 保留）。  
Playwright P2/P4 因 dev 端口 5173 占用未完整跑通；vitest `useAutoRecoveryContinue` 缺 `@testing-library/dom` 为环境依赖问题。

---

## 一、合并前预检（Phase 0）

| 项 | 结果 |
|----|------|
| `npm run build` | PASS |
| `npm test` | PASS 38/38 |
| `check:saas-fork` | PASS 80/80（补 5 处 document 工具 marker） |
| `brand:check` | PASS |
| `capabilities:gen` + `smoke:capability-hub` | PASS |
| `smoke:project-memory` | PASS 3/3 |
| `smoke:document` | PASS |
| `smoke:saas-isolation` | PASS（修复 `await aggregateRouterUsage`） |
| `test:saas:pg-validation` | PASS 47/47 |

---

## 二、冲突解决记录（22 文件）

| 文件 | 解法摘要 |
|------|----------|
| `AgentLoop.ts` | 保留双轨 recovery + 合并 `basePermissionMode` / `applyPermissionOverrides` |
| `InProcessGateway.ts` / `protocol/types.ts` | fork 脱敏 + tenant transcript + 上游 `basePermissionMode` |
| `WebSocketContext.tsx` | **保留 shared 单例** + 30s ping + clearInterval |
| `vite.config.js` | SaaS define/strictPort + `timeout:0` on `/ws` |
| `pilotdeck-bridge.js` | fork 租户/成果路径 + `basePermissionMode` 透传 |
| `pilotdeckConfig.js` | 顶层 `proxy.url` + `telemetry`；保留 PG/文档 env |
| `parseMemoryConfig.ts` | 上游 flat schedule + fork `projectContinuity` |
| `webSearch.ts` | bocha + softFailure + 上游友好未配置提示 |
| `useChatComposerState.ts` | `permission-response`（#196） |
| `ChatInterfaceV2` / `ExitPlanModePanel` | B4 plan UI + fork 布局/主题 |
| `PilotDeckConfigTab` | 去 proxyPort；proxy.url + telemetry + fork tools |
| 其余 UI/i18n | 能力中心 + Always-On badge + telemetry 键合并 |

自动合并已验证：`PlanTodoState.ts`（#204 软提醒）、`readFile.ts`、`proxy.ts`、`index.js` ping 忽略。

---

## 三、integrate 闸门（Phase 5–6）

| ID | 命令 | 结果 |
|----|------|------|
| L0 | build / test / fork / brand | PASS |
| L2 | templates/docx/aigeo/social-matrix/document/capability-hub/project-memory | PASS |
| L2 | capabilities smoke | PASS（`missingInCatalog=19` 为 catalog 滞后，非 merge 回归） |
| S1 | test:saas:invariants | PASS 4/4 |
| S2 | vitest server/saas | PARTIAL 4/5（`usage.test.js` vitest 无法 bundle `node:test`） |
| S2+ | `node --test` usage+billing | PASS 3/3 |
| S3 | deep-isolation-pilothome | PASS 2/2 |
| S4 | smoke:saas-isolation | PASS 11/11 |
| S5 | test:saas:deep | PASS |
| S8 | pg-validation | PASS 47/47 |
| P1 | white-screen @ 5173 | PASS |
| P2/P4 | ui-regression / yixiaoer | **FAIL**（5173 端口占用，client 未起） |
| L1 | userFacingErrors vitest | PASS 12/12 |
| L1 | useAutoRecoveryContinue | **FAIL**（缺 `@testing-library/dom`） |

---

## 四、回滚

```powershell
git checkout main
git reset --hard pre-pd-merge-3891db5
```

PG 专项：见 [`saas-pg-phase1-runbook.md`](saas-pg-phase1-runbook.md) `restore-point/pre-pg-phase1`。
