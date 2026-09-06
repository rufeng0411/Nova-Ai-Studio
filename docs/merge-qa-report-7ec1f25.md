# 上游合并评测报告 — `7ec1f25`

**日期**：2026-06-03  
**合并提交**：`ee09bd0`（`integrate/pd-upstream-7ec1f25` → `main` ff-only）  
**还原标签**：`pre-pd-merge-7ec1f25` @ `9b17b7c`（物化 WIP 后、merge 前）  
**上游范围**：`840f9ee..7ec1f25`（14 提交，11 文件）

---

## 总判定：**有条件通过**

引擎编译、核心单测、fork 登记、L3 smoke、capabilities smoke 均通过。  
3 个 Git 冲突已按双轨 recovery 方案解决。UI vitest 全量有 21 项历史失败（`MessagesPaneV2.render` 等），与本次合并无直接关联；`useAutoRecoveryContinue` 5/5 通过。Playwright P1–P4 未在本轮自动跑（需 `dev:concurrent`）。

---

## 一、上游 14 条更新影响

| 类别 | 内容 | 合并结果 |
|------|------|----------|
| 大文件修复 | `LargeFileRepair` 状态机 + `AgentLoop` 集成 | 已并入，与本地 `toolFailureRecovery` 双轨 |
| WebSocket | `connectIdRef` 消除 token 变更竞态 | 已采纳上游结构，保留 `websocket-reconnected` |
| 默认输出 | `maxOutputTokens` 8192→16384 | 已采纳（defaults + ConfigTab placeholder） |
| 流式/后台 | `normalizeStreamEvent`、`BackgroundTaskRuntime` 等 | 自动合并 |
| 二开保护 | 能力中心/Hermes/Nova/smoke | 无上游交叠，物化提交完整保留 |

---

## 二、冲突解决记录

| 文件 | 解法 |
|------|------|
| `AgentLoop.ts` | `continueWithSyntheticPrompt` + `LargeFileRepair`；`shouldInjectToolRecoveryTurn` 仅当 `!hasPendingRepair`；熔断 `MAX_CONSECUTIVE_ALL_INVALID_TURNS=3`；保留 `recovery_exhausted` |
| `WebSocketContext.tsx` | 完整 `connectIdRef` + cleanup；删除重复旧 `connect` 块 |
| `PilotDeckConfigTab.tsx` | 自动合并；placeholder `16384`；providerHub WIP 保留 |

---

## 三、验证闸门

| ID | 命令 | 结果 |
|----|------|------|
| L0-1 | `npm run build` | **PASS** |
| L0-2 | `npm test` | **PASS** 30/30 |
| L0-3 | `npm run test:ui:unit` | **PARTIAL** 88/109（21 失败为既有 render 套件） |
| L0-3+ | `useAutoRecoveryContinue.test.ts` | **PASS** 5/5 |
| L0-4 | `npm run check:saas-fork` | **PASS** 13/13 |
| L3 | smoke:templates/docx/aigeo/social-matrix | **PASS** |
| L3+ | `integration-capabilities-smoke.mjs` | **PASS** 315/315 |
| P1 | `check-white-screen.mjs` @ 5175 | **PASS** |
| P2 | `ui-regression-check.mjs` | **PASS** |
| P3 | `ui-artifact-preview-check.mjs` | **FAIL**（deliverables 面板未出现，需 LLM/网关） |
| P4 | `ui-yixiaoer-regression-check.mjs` | **PASS** |

---

## 四、物化提交链（merge 前）

1. `dc714f9` brand: Nova logo-3  
2. `f8511b7` restore: 能力中心/Hermes/smoke  
3. `061fecf` capabilities:gen  
4. `9b17b7c` process-templates 同步  

---

## 五、回滚

```powershell
git reset --hard pre-pd-merge-7ec1f25   # merge 前还原点
git reset --hard backup/main-2c881ea    # 仅 Nova-only（丢 WIP）
```
