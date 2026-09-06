# Nova GEO Report System（NGRS）v1 设计规范

GEO 系列 HTML 报告/分析仪表盘的统一视觉与图表系统。用户未明确要求自定义品牌时，Agent **必须**遵循本规范。

- 机器可读配置：[`config/geo-report-design-system.json`](../config/geo-report-design-system.json)
- 图表注册表：[`config/geo-chart-catalog.json`](../config/geo-chart-catalog.json)
- 共享资源：[`skills/geo-dual-report/templates/`](../skills/geo-dual-report/templates/)

## 1. 色彩 — Graphite Insight

| Token | 值 | 用途 |
|-------|-----|------|
| `--ngrs-bg` | `#F0F1F4` | 页面底 |
| `--ngrs-card` | `#FFFFFF` | 卡片面 |
| `--ngrs-text` | `#1A1F26` | 主文案 |
| `--ngrs-muted` | `#647084` | 副标题/轴标签 |
| `--ngrs-accent` | `#0F766E` | 主强调 |
| `--ngrs-accent-soft` | `rgba(15,118,110,0.12)` | 折线填充/雷达面 |
| `--ngrs-priority-p0/p1/p2` | 红/琥珀/灰 | 行动项优先级 |

图表序列色（固定顺序）：`#0F766E` → `#4F46E5` → `#0E7490` → `#6366F1` → `#647084`

深色模式：`prefers-color-scheme: dark` 自动映射，见 `geo-report-theme.css`。

## 2. 排版与布局

- 字体栈：`Segoe UI Variable`, `PingFang SC`, `Microsoft YaHei`, system-ui
- 容器：`max-width: 1100px`；圆角 `0.625rem`
- 结构：ReportHeader → KpiGrid → ChartGrid → SectionBlocks → ActionList → ReportFooter

## 3. ChartCatalog

通过 `report-data.charts[].kind` 选用图表，**禁止**自造 Chart.js options。

```json
{
  "kind": "keywordHorizontalBar",
  "id": "kw-top",
  "title": "核心问句 Top10",
  "labels": ["问句 A", "问句 B"],
  "values": [92, 88]
}
```

- 未知 `kind` → 降级 `summaryBar`
- 兼容旧 kebab id（如 `keyword-bar`）经 alias 映射
- 每份报告 ≥ **2 张图 + 1 组 KPI**

### 按 reportType 推荐

| reportType | 推荐 kind |
|------------|-----------|
| audit | scoreGauge, dimensionRadar, severityStackedBar |
| research | keywordHorizontalBar, topicPolarArea, intentDoughnut |
| competitor | competitorGroupedBar, sovDoughnut, gapWaterfallBar |
| citability | sectionRadar, paragraphHorizontalBar, beforeAfterBar |
| technical | checklistProgressBar, severityDonut, dimensionRadar |
| monitor | engineSovBar, dimensionRadar, competitorBar, queryHitDonut |
| performance | trendLineArea, kpiSparkGrid, channelGroupedBar |
| generic | summaryBar, distributionDoughnut |

完整 kind 列表见 [`config/geo-chart-catalog.json`](../config/geo-chart-catalog.json)。

## 4. 动效（三层）

### 页面级

- 卡片 `fadeUp` 400ms + stagger 60ms
- KPI hover：`translateY(-2px)` + shadow
- `scoreGauge`：SVG 描边 1200ms
- KPI 数值 countUp 600ms（首次进入视口）
- `prefers-reduced-motion: reduce` 关闭动画

### 图表级

- Chart.js：`duration 900`、`easeOutQuart`、`delay idx×90`
- doughnut/radar：`animateRotate` + `animateScale`
- sparkline：500ms 快速绘制

### 交互级

- Hover：`mode: 'index'` + crosshair（折线/柱）
- 首屏外图表可选 IntersectionObserver 延迟绘制

**禁止**：弹跳、闪烁、粒子、3D、彩虹渐变。

## 5. 交付方式

1. 复制 [`geo-report-base.html`](../skills/geo-dual-report/templates/geo-report-base.html) 或监测模板
2. **内联** `geo-report-theme.css` 与 `geo-chart-theme.js` 以保证任务目录自包含
3. 注入 `report-data` JSON；监测类用 `monitor-data` + `geo-monitor-report.html`

## 6. themeOverride（可选）

仅当用户**明确**要求品牌色时：

```json
{ "themeOverride": { "accent": "#…", "mode": "light|dark|auto" } }
```

否则忽略，仍用 NGRS v1。
