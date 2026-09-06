# ask_user_question 接线规范

本文件用于把 Open Design 的交互式发现流程，映射到 PilotDeck 的 `ask_user_question` 工具。

## A. 首轮 brief 问卷

目标：一次收集核心约束，避免来回追问。

建议问题集合：

1. `What are we making?`（单选）
2. `Who is this for?`（单选或文本化选项）
3. `Visual tone`（多选，最多 2）
4. `Brand context`（单选：方向/品牌规范/参考对齐）
5. `Scale`（单选分档）

## B. 方向选择器（带 preview）

当品牌上下文为“Pick direction”时，再发一次 `ask_user_question`：

- `question`: `Choose visual direction`
- `multiSelect`: `false`
- 选项为 5 个方向（Editorial / Modern minimal / Human / Tech utility / Brutalist）
- 每个 option 可带 `preview`，内容可放：
  - 方向关键词
  - 主色与强调色
  - 字体组合

## C. 结果使用规则

- 首轮问卷结果用于任务路由（选择 `od-*` 表面技能）。
- 方向问卷结果用于 token 与字体绑定。
- 用户提供品牌规范时，跳过方向选择器，执行 `brand-spec-protocol.md`。

## D. 失败回退

- 若用户拒绝问卷：使用“最小问题集”（输出类型 + 品牌上下文 + 规模）后继续。
- 若用户未给品牌信息：默认 `modern-minimal` 并显式告知可随时切换。

