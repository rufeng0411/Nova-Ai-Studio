# 机制冲突矩阵 v1：core-strategy × 续跑 × 澄清

**版本**：v1 | 2026-06-21  
**范围**：任务驱动对话中「别停/自动续跑」与「该问就问/快停」的系统性张力

---

## 1. 三方机制摘要

| 机制 | 来源 | 核心指令 |
|------|------|----------|
| **A. core-strategy** | [`saasCoreStrategy.ts`](../src/context/prompt/saasCoreStrategy.ts) | 勿停、勿让用户打「继续」、自动换路重试（~8–12 次） |
| **B. 续跑栈** | AgentLoop auto_continue + UI 三钩子 | 规划停/infra/recovery_pause → 合成 user 消息开新 turn |
| **C. 澄清** | capabilityBinding 礼仪 + plan 模式 ask_user | 「缺关键输入时再提问」；dontAsk 模式 **禁止**提问 |

---

## 2. 冲突矩阵

|  | **B 续跑（应继续）** | **B 续跑（不应继续）** | **C 应澄清** | **C 不应澄清** |
|--|---------------------|------------------------|--------------|----------------|
| **A 勿停** | ✅ 瞬态网络、soft_fetch、合法多步 | ⚠️ 硬失败仍 tool_recovery | ⚠️ 缺 Key 仍 blind retry | ✅ 已明确参数 |
| **场景** | PPT 装依赖后规划停 | Key/欠费应 1 次快停 | 无附件却要生成 PPT | 附件已解析在消息中 |
| **现状** | fix 后 incompleteDeliverable | HardFail 部分生效 | **无 structured 澄清层** | core-strategy 压倒礼仪 |
| **用户感受** | 少打「继续」 | 干等 8 轮 | 猜默认值/ HTML 顶替 | 体验好 |

### 2.1 高冲突格（P0 产品决策）

| # | 冲突 | 表现 | 建议裁决 |
|---|------|------|----------|
| **X1** | A×C | 无附件/页数/风格仍开做 | **允许 1 条 bundled 澄清**（非 recovery 循环） |
| **X2** | A×B | 「拿不到信息」触发 auto_continue | 区分 **需用户输入** vs **可换源**；前者走澄清 |
| **X3** | B×C | recovery 合成消息禁止向用户提问 | 耗尽后 **允许 1 条**「请提供 API Key/附件」 |
| **X4** | A×B | tool_recovery 文案泛化（HTML/mobile） | 按 **capability slug** 分支 recovery |
| **X5** | B×完成定义 | success 无交付仍结束 turn | **validate-before-complete** 引擎门控 |

---

## 3. 决策规则草案（分析输出，待产品确认）

```
IF 硬失败(auth/billing/config) → 快停 + 澄清 Key（1 次）
ELIF 缺不可替代输入(附件/页数/主题) AND 非「直接开始做」→ 澄清（1 条）
ELIF 规划 narration AND userGoal 含交付物 AND 无 verified 文件 → auto_continue（B）
ELIF 同 tool+input 失败 ≥2 → 停 recovery，换策略或澄清
ELSE 正常执行
```

---

## 4. 与 AGENTS.md 原则对齐

| 原则 | 冲突矩阵项 | 当前差距 |
|------|------------|----------|
| 不让用户帮系统找 bug | X2, X4 | recovery 仍偏调试 |
| 稳定续跑 | B + incompleteDeliverable | 已补，待 replay 验证 |
| 为用户解决问题 | X1 | 缺澄清层 |
| 8 次合计上限 | A + B 叠乘 | 合法长任务仍可能耗尽 |

---

## 5. 验证方法

- 单测：[`auto-continue-policy.test.ts`](../tests/agent/auto-continue-policy.test.ts) 扩展 X2 句式
- Replay：沧海 PPT、北京 AI 调研各 1 次
- 人工：产品确认 X1/X3 是否允许「一条提问」
