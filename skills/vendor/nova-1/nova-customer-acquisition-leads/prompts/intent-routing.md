# Intent Routing (Agent 对话层)

对齐 Nova `skillTypology.ts`：判断用户消息是**提交获客任务**、**配置咨询**还是**闲聊/FAQ**。

## Submit task (`should_submit`)

满足任一即视为可执行获客意图：

- 强动词：找客户、拓客、获客、找线索、招标、采购、外包、众包、求购…
- 弱动词 + 长度 ≥6
- 长度 ≥6 且含主题词：项目、采购、招标、线索、外包、软件、开发、数字化…

**Portable Skill**：进入 Phase A，规范化 `keyword` = 用户原文（trim）。

## Do NOT submit

| 模式 | 示例 | Agent 动作 |
|---|---|---|
| 闲聊 | 你好、谢谢 | 简短回应 + 引导给出关键词 |
| 配置咨询 | 怎么设置关键词和渠道 | 解释渠道见 channels/README，勿假装已跑任务 |
| FAQ | 政府采购是什么、怎么导出 | 产品说明，不启动流水线 |
| 过短 | ≤2 字 | 追问具体行业/地域/需求 |

## Infer data_sources (optional)

| 信号 | 推荐 channel_id |
|---|---|
| 政府/政采/国企/投标 | `gov_bidding`, `gov_ggzy`, `state_owned`, `supply_chain` |
| 外包/众包/猪八戒 | `outsourcing`, `gov_bidding`, `supply_chain` |
| C 端/小红书/同城店 | `social`, `local_life`, `forum_bbs` |
| B2B/1688/供应链 | `supply_chain`, `private_bidding`, `overseas_b2b` |
| 无明确信号 | 默认 `gov_bidding`, `supply_chain`, `outsourcing` |

## Bound skill note

用户已在「智能获客」语境时，**勿**因句中无「获客」二字而判为纯闲聊；与 Nova `customerAcquisition` 标签行为一致。
