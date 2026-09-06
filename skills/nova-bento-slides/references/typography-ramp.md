# Typography Ramp（1280×720）

基于 `theme.fontFamily`；**strict ≤2 字体族**。字重可用 400–900，不算第二字体。

## Display / 标题

| 角色 | fontSize | fontWeight | lineHeight | 用途 |
|------|----------|------------|------------|------|
| hero | 72–88 | 800–900 | 1.0–1.05 | 封面主标题 |
| h1 | 48–56 | 800 | 1.06 | 章节标题 |
| h2 | 36–40 | 700–800 | 1.1 | 内容页标题 |
| h3 | 28–32 | 700 | 1.15 | 卡片标题 |

## Body / 标签

| 角色 | fontSize | fontWeight | lineHeight | 用途 |
|------|----------|------------|------------|------|
| body | 20–24 | 400–500 | 1.35–1.5 | 正文要点 |
| body-sm | 16–18 | 400 | 1.4 | 注释、表内 |
| kicker | 12–14 | 700 | 1 | 全大写/字间距 3–4 |
| caption | 14–16 | 500 | 1.3 | chart 旁解读 |

## KPI / 数据

| 角色 | fontSize | fontWeight | fx |
|------|----------|------------|-----|
| kpi-hero | 96–120 | 900 | countUp |
| kpi-md | 48–64 | 800 | countUp 可选 |
| kpi-label | 14–16 | 600 | — |

## 页码 / 元数据

| 角色 | fontSize | 用法 |
|------|----------|------|
| page | 12–13 | `{{page:2}}` 右上 |
| ghost | 200–300 | 半透明装饰 `{opacity:0.05}` |

## 颜色

- 标题：`theme.color`
- 正文：`theme.color` 或 85% 不透明
- 次要：`theme.color` @ 60%
- 强调：`theme.accent`（kicker、链接感文字）
- 深底白字：`#FFFFFF` / `#F2F0EA`

## letterSpacing

- kicker / 全大写：`3–4`
- 正文：默认 0

## 约束

- 单行标题宽度不足时减 fontSize，勿超 1184
- chart/table 内 fontSize 16–18 与 body-sm 对齐
