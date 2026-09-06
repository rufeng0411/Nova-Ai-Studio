# NGRS v1 GEO 报告设计系统 — 代码还原点

> Nova GEO Report System（NGRS）v1：Graphite Insight 主题、ChartCatalog 注册表、双交付 HTML 模板统一与 smoke 门禁。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-geo-report-design-system-20260713234629` |
| **提交** | `02d9d456` |
| **时间** | 2026-07-13 23:46:29 +0800 |
| **说明** | NGRS v1、geo-chart-catalog、主题 CSS/JS、报告模板瘦身 |

```bash
git show restore-point/post-geo-report-design-system-20260713234629 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **设计系统**：`config/geo-report-design-system.json` + `docs/geo-report-design-system.zh-CN.md`（Graphite Insight 色板、排版、结构）
- **图表目录**：`config/geo-chart-catalog.json`；`geo-chart-theme.js` 禁止自造 Chart.js options
- **共享主题**：`geo-report-theme.css`；`geo-dual-report` / `geo-monitor-report` 模板瘦身并接入 NGRS
- **门禁**：`smoke:geo-report-design`；`smoke:geo-dual-report` / `smoke:geo-monitor-report` 扩展校验
- **manifest**：`geo-dual-report.manifest.json` 对齐双交付结构

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-geo-report-design-system-20260713234629
```

### 从还原点开实验分支

```bash
git checkout -b experiment/ngrs-v1 restore-point/post-geo-report-design-system-20260713234629
```

### 只还原某个文件

```bash
git checkout restore-point/post-geo-report-design-system-20260713234629 -- path/to/file
```

## 关联文档

- [`geo-report-design-system.zh-CN.md`](./geo-report-design-system.zh-CN.md)
- [`geo-hub-admin-guide.zh-CN.md`](./geo-hub-admin-guide.zh-CN.md)
- [`geo-hub-deliverable-derivation-restore-point-20260713225501.md`](./geo-hub-deliverable-derivation-restore-point-20260713225501.md)（上一还原点）
