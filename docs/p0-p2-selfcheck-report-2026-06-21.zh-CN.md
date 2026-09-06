# P0–P2 路线图自检报告（2026-06-21）

**命令**：`npm run selfcheck:p0-p2`  
**JSON**：`artifacts/p0-p2-selfcheck.json`  
**说明**：静态代码探测 + 6 项关联单测；**非**端到端 PPT 实跑。

---

## 汇总

| 类别 | 数量 |
|------|------|
| ✅ done | 1（FIX-A incompleteDeliverable 续跑） |
| 🟡 partial | 8 |
| ❌ missing | 7 |
| 关联单测 | 6/6 通过（修正 runner 后） |

**结论**：深度分析路线图 **大部分尚未实施**；近期仅落地「规划停/无交付 auto_continue」相关 fix。P0 六项均需单独立项开发。

---

## P0 明细

| ID | 状态 | 说明 |
|----|------|------|
| P0-1 会话级 binding | ❌ | 仍 `first turn only`，无持久 binding |
| P0-2 validate-before-complete | 🟡 | UI/server validate 有；**AgentLoop 未门控** |
| P0-3 slug recovery | 🟡 | 调研/内容/脑爆有；**缺 PPT 专用 recovery** |
| P0-4 turn_progress→resume | 🟡 | 函数有；**未接入 UI/引擎续跑** |
| P0-5 bypass orchestrate | 🟡 | 仅 design 前缀；**nova-ppt/pd-geo 未 bypass** |
| P0-6 deliverable_repair | 🟡 | UI 就绪；**Bridge 未发射** |

## P1 明细

| ID | 状态 |
|----|------|
| P1-1 澄清门控 | ❌ |
| P1-2 Key/附件句式豁免 | ❌ |
| P1-3 跨 turn repeat guard | 🟡（仅同 turn） |
| P1-4 阶段 recovery 子预算 | ❌ |
| P1-5 prelaunch skill 实跑 | ❌ |

## P2 明细

| ID | 状态 |
|----|------|
| P2-1 续跑弱提示/进度条 | 🟡（hook 有，无 toast/进度条） |
| P2-2 memory 5s 超时 | 🟡（代码 5000ms；telemetry p95 仍满额） |
| P2-3 续接 stage hint | ❌ |

## 已落地（FIX）

| ID | 状态 |
|----|------|
| FIX-A incompleteDeliverable 引擎+UI | ✅ |
| FIX-B 脑爆升档检测接线 | ❌ |

---

## 关联单测（均应 PASS）

```bash
npm run selfcheck:p0-p2
node --import tsx tests/agent/auto-continue-policy.test.ts
npm run test:task-resilience:unit
npm run analyze:task-completion
```

---

## 建议下一步（按 ROI）

1. **P0-3** PPT tool_recovery 文案（快、直接减 HTML 顶替）
2. **P0-1** 会话级 binding（多轮 PPT 最大杠杆）
3. **P0-6 + P0-2** Bridge deliverable_repair + 引擎 validate 门控
4. **P0-5** 扩展 bypass 至 `nova-ppt-*` / `anth-pptx` / `pd-geo`
