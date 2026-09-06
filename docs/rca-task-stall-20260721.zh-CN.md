# 任务推进停滞 — 深度根因分析（2026-07-21）

> **版本**：v3 执行闭环  
> **案例**：8 个 admin tenant 实会话（`config/sessions/task-stall-8.json`）  
> **编排**：`npm run test:task-stall:rca`

---

## 一、执行摘要

| 指标 | 基线（07-21） | P0 后目标 | 状态 |
|------|--------------|-----------|------|
| 侧栏 rank>10 点击消失 | 100%（PS5pro） | 0% | **已修**（preview pin） |
| 取消完成 → turn_accepted | 0%（仅 localStorage） | 100% | **已修**（unpause-session） |
| ghost queued >5min | 未审计 | 0 | **已修**（repair 定时 + pump） |
| queued 合成续跑误入队 | 高 | 0 | **已修**（server 拒 synthetic） |
| 8 案 deep link 可加载 | 未测 | ≥6/8 | **见 session-resolve.json** |
| 四线 P0 mismatch | 未测 | 0 | **见 four-line-audit** |
| 用户手输「继续」比例 | 估 >40% | ≤15% | **待 live 回放** |
| export 校验中误标 missing | 有 | 0 | **已修**（validationSettled gate） |
| 电商 T2 展示 .py 槽 | 有 | 0 | **已有**（deliverableDisplayPolicy） |

---

## 二、根因五层与验证状态

| 层 | 根因 | 典型案例 | 验证 | 优先级 | 修复 |
|----|------|----------|------|--------|------|
| **L0** | 模型 402/403、Gateway 断连 | 全任务无流式 | **INCONCLUSIVE**（需 curl 探针） | P0 预检 | 排除后再改 UI |
| **L1** | preview 10 条无 pin；optimistic 斜体+queued | PS5pro 点击消失 | **VERIFIED** | P0-1 | `resetProjectSessionPreviewForSwitch(pin)` |
| **L2** | M7 终态门控；取消完成仅 localStorage | 需手输「继续」 | **VERIFIED** | P0-2 | `unpause-session` WS |
| **L2** | queued 合成续跑重复入队 | 斜体+排队卡死 | **VERIFIED** | P0-4 | server 拒 synthetic + policy 分流 |
| **L3** | frozen pipeline / defer / dock 环 | 卡顿、export「校验中」 | **VERIFIED**（部分） | P0-5/7 | dock 等值 + export gate |
| **L3.5** | pathHint basename 不一致 | Nike 世界杯 document.docx | **VERIFIED** | P0-6 | tier0 fuzzy basename |
| **L3.5** | needs_repair ∧ passed 分裂 | 巴西电商/UX 审查 | **VERIFIED** | PR-B | goal-loop + SDM |

### 类型 archetype 分布

| 类型 | 含义 | 会话 |
|------|------|------|
| A | 写盘/交付失败 | 4e3acadc, 6e266035 |
| B | 验收/SDM 分裂 | bea3205a |
| C | 成功误报终态 | 658b3150 |
| D | 长任务槽膨胀 | 1e766a51 |
| E | passed 仍干预 | 49280983, ac8f7470, fdb48220 |

---

## 三、P0 修复清单

### PR-A（侧栏 / 队列 / 终态）

| ID | 改动 | 文件 | 验收 |
|----|------|------|------|
| P0-1 | Pin 选中 session | `applySelectProjectAndSession.ts` | vitest + E2E #1 |
| P0-2 | unpause-session | `turnAcceptanceService.js`, `SidebarV2.tsx` | `unpauseSession.test.mjs` |
| P0-3 | queued repair 5min | `AppShellV2.tsx` | repair WS smoke |
| P0-4 | queued 仅拒 synthetic | `staleSessionPausePolicy.ts`, `turnAcceptanceService.js` | staleSessionPausePolicy.test |
| P0-5 | dock 防环 | `RightWorkspaceRailContext.tsx` | maxDepth=0 adversarial |

### PR-B（SDM / 展示）

| ID | 改动 | Flag |
|----|------|------|
| P0-6 | pathHint fuzzy | `VITE_SDM_FUZZY_PATHHINT=1` |
| P0-7 | export 前 validationSettled | `VITE_REQUIRE_VALIDATION_SETTLED=1` |
| P0-8 | .py 不进 T2 | `deliverableDisplayPolicy`（已有） |

---

## 四、KPI 数据来源

| 产出 | 命令 |
|------|------|
| `artifacts/task-stall-rca/case-kpi.json` | `npm run test:task-stall:rca -- --parse-only` |
| `artifacts/task-stall-rca/session-resolve.json` | `npm run test:task-stall:rca -- --check-sessions` |
| `artifacts/task-stall-rca/stress-summary.json` | `npm run test:task-stall:rca -- --stress --gate` |
| `artifacts/task-stall-rca/preflight.log` | `npm run test:task-stall:rca -- --all` |
| `artifacts/task-stall-rca/bisect-report.md` | 见 §五 |

---

## 五、bisect 结论（摘要）

| 点 | commit | #1 pin | #4 unmark | #7 manual | 结论 |
|----|--------|--------|-----------|-----------|------|
| A | `3b6354ef` | PASS | N/A | 低干预 | 无 preview 裁剪回归 |
| B | `c0e69fa9` | **FAIL** | N/A | 中 | session-switch 引入裁剪无 pin |
| C | HEAD + P0 | **PASS** | **PASS** | 低 | M7 + unpause 闭合 L2 |

完整表见 [`artifacts/task-stall-rca/bisect-report.md`](../artifacts/task-stall-rca/bisect-report.md)。

---

## 六、发版 GO/NO-GO

**GO** 条件（§0.2）：

- [x] PR-A 单测 + pin/unpause/repair
- [x] parse-only ≥6/8 或 skip 有文档
- [ ] live E2E #1–4 绿（需 dev:saas）
- [ ] `test:prelaunch:quick` 全绿
- [ ] stress wedged=0

**NO-GO**：

- 模型 403 未排除仍合 UI
- PR-B 先于 PR-A

---

## 七、后续 P1

- SDM 具名 pathHint、campaign ADD profile
- pipeline flush 与 `test:four-line-audit --tenant tenant-admin` 扩展
- 8 案 fixture replay 纳入 `test:goal-loop:acceptance:full`

---

*生成：task-stall RCA v3 执行计划 · 2026-07-21*
