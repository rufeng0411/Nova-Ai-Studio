# Morph Recipes

Bento 签名动效：相邻页 `"transition":"morph"` + **相同 element id** → 共享元素 tween。

## 策略 A — 标题收缩（section → content）

**共享 id**：`headline`、`bar`

```
s1 cover:  headline y=460 fs=76  |  bar w=320 h=16 横条
s2 content: headline y=96  fs=40  |  bar w=16 h=450 竖条
s2.transition = "morph"
```

## 策略 B — Logo 常驻

**共享 id**：`logo`（每页同位置或角标微移）

```
s1: logo 96,520 120×48
s2..n: logo 1024,54 80×32 align right
transition morph  on s2 only; 后续可 none 或继续 morph
```

## 策略 C — KPI 数字变形

**共享 id**：`kpi-main`（countUp 仅在后页或 fade 页启用）

```
s-metrics-1: kpi-main html="42%" fs=120 center
s-metrics-2: kpi-main html="87%" fs=120 center + chart 淡入其他元素
```

## 策略 D — 三卡 rearrange

**共享 id**：`card-a`、`card-b`、`card-c`

```
s-overview: 三卡横排 y=160
s-detail: card-a 放大居中，b/c 缩小靠边或 opacity 0.3
```

## 策略 E — accent bar 扫过

**共享 id**：`bar` — 从标题下横条 morph 为左侧竖条或全宽分隔线。

## morphId 覆盖

当两元素 **id 不同** 但需配对时，设相同 `morphId`（勿改 id）：

```json
{ "id": "t-left", "morphId": "hero-title", ... }
{ "id": "t-right", "morphId": "hero-title", ... }
```

同页内 effective key（`morphId ?? id`）不得重复。

## 计数（strict ≥2 组）

每组 = 一对相邻 slides，后页 `transition:"morph"` 且与前一页 ≥1 共享 id。

**最低配**：cover→s2 morph（headline+bar）；section→detail morph（headline+bar）。

## 禁则

- morph 页上**不要**给共享 id 元素加冲突的 `enter` stagger（morph 优先）
- 不要每页随机 uuid — 用 [id-registry.md](id-registry.md)
- 数据页可用 `transition:"fade"` 打断 morph 以触发 countUp enter
