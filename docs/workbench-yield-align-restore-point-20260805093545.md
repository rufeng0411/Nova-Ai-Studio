# 工作台良品率对齐展示策略 — 代码还原点（执行前）

> **执行前**基线：工作台良品率对齐展示策略（深度分析 + 落地计划）落地之前。  
> 同提交含 Showcase 打包同步与 Windows tar `deploy/marketing` 漏目录修复。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/pre-workbench-yield-align-20260805093545` |
| **提交** | `54da83ce` |
| **时间** | 2026-08-05 09:35:45 +0800 |
| **说明** | **工作台良品率对齐展示策略（深度分析 + 落地计划）执行前** |

```bash
git show restore-point/pre-workbench-yield-align-20260805093545 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更（基线快照）

### 发版 / Showcase

- `pack.mjs`：overlay → `deploy/marketing/showcase` 同步；Windows bsdtar 强制并入 `app/deploy/marketing`；附 `showcase-data.tar.gz` + `sync-showcase-data.sh`
- 案例缩略图并入 `deploy/marketing/showcase/media/**`
- 营销路径 / catalog / viewer 与合规文案预览同批修正

### Flag 基线（执行前快照）

| Flag | pack 默认 | apply-cloud-perf | devLauncher |
|------|-----------|------------------|-------------|
| `PILOTDECK_SEQUENTIAL_DELIVERABLES` | `0` | （未注入） | `1` |
| `PILOTDECK_GOAL_QUALITY_CONTRACT` | `shadow` | `off` | `enforce` |
| `PILOTDECK_CAPABILITY_SCOPE_V2` | `shadow` | `shadow` | `enforce` |
| `PILOTDECK_OFFICIAL_MEDIA_V2` | `off` | `off` | `enforce` |

### 尚未开始（本标签时刻）

- 工作台良品率对齐展示策略的深度分析结论落地与 UI/策略代码改动（本标签之后）

## 回退

```bash
git reset --hard restore-point/pre-workbench-yield-align-20260805093545
```

## 验收速记

- `git show restore-point/pre-workbench-yield-align-20260805093545 --stat` 可见 pack / marketing / thumbs
- 线上已发 `nova-20260803.5503`；本标签为后续良品率工作本地/仓内基线
