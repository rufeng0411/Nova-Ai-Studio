# Layout Recipes（1280×720）

安全区：`x≥96`，`x+w≤1184`，`y` 常用 54–640。所有坐标基于 **1280×720**。

## 1. `cover-hero`

全幅背景 + scrim + 大标题。封面必配 ken-burns 或 ambient。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| bg-image | 0 | 0 | 1280 | 720 |
| scrim | 0 | 0 | 1280 | 720 |
| kicker | 96 | 420 | 600 | 28 |
| headline | 96 | 460 | 1000 | 180 |

## 2. `title-only`

章节分隔；ghost 页码可选。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| kicker | 96 | 200 | 400 | 28 |
| headline | 96 | 240 | 1000 | 120 |
| accent-bar | 96 | 380 | 320 | 12 |

## 3. `headline-body`

标准内容页；morph 时 headline/bar 保 id。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| kicker | 96 | 54 | 500 | 26 |
| headline | 96 | 96 | 900 | 72 |
| body | 96 | 190 | 700 | 420 |
| accent-bar | 96 | 170 | 120 | 8 |

## 4. `split-text-image`

左文右图（或镜像）。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 96 | 520 | 80 |
| body | 96 | 200 | 520 | 400 |
| image | 680 | 80 | 504 | 560 |

## 5. `two-column`

双栏要点；栏宽各 ~480。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 54 | 1088 | 64 |
| col-left | 96 | 150 | 480 | 500 |
| col-right | 608 | 150 | 480 | 500 |

## 6. `three-up-cards`

三卡片等宽；card 用 shape + 内 text。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 54 | 900 | 64 |
| card-1 | 96 | 160 | 340 | 480 |
| card-2 | 470 | 160 | 340 | 480 |
| card-3 | 844 | 160 | 340 | 480 |

## 7. `chart-full`

单 chart 占主视觉。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| kicker | 96 | 54 | 400 | 26 |
| headline | 96 | 88 | 800 | 56 |
| chart | 96 | 170 | 1088 | 480 |

## 8. `chart-split-caption`

chart + 右侧解读。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| chart | 96 | 140 | 720 | 480 |
| caption | 860 | 180 | 280 | 400 |

## 9. `table-pricing`

对比表居中。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 54 | 800 | 56 |
| table | 200 | 140 | 880 | 480 |

## 10. `kpi-row`

3–4 个 KPI + countUp。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 54 | 800 | 56 |
| kpi-1..4 | 96/380/664/948 | 200 | 260 | 200 |

## 11. `timeline-flow`

水平步骤 + dash-march 连线。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 54 | 800 | 56 |
| step-nodes | 96–1000 | 280 | 各 140×140 | |
| connector | line 贯穿 | y≈350 | | |

## 12. `closing-cta`

收束 + 联系方式；可 morph logo。

| 元素 | x | y | w | h |
|------|---|---|---|---|
| headline | 96 | 220 | 1000 | 100 |
| sub | 96 | 340 | 700 | 80 |
| logo | 96 | 520 | 120 | 48 |
| accent-bar | 96 | 200 | 200 | 8 |

## 节奏建议

`anchor`（cover/section）→ `dense`（chart/table）→ `breathing`（title-only）交替；见 outline schema。
