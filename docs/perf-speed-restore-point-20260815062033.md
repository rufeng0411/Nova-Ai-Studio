# 性能提速优化 — 代码还原点（执行前）

> **执行前**基线：性能提速优化专项启动之前。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/pre-perf-speed-20260815062033` |
| **提交** | `cc507126` |
| **时间** | 2026-08-15 06:20:33 +0800 |
| **说明** | **性能提速优化前** |

```bash
git show restore-point/pre-perf-speed-20260815062033 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更（基线快照）

- 能力中心排序 / 置顶 / 可见性与 `hubCapabilityPresentation`
- catalog / i18n / Hub 缓存与 Showcase viewer 同批
- pack / cloud runtime 小幅同步

### 尚未开始

- 性能提速专项（本标签之后）

## 回退

```bash
git reset --hard restore-point/pre-perf-speed-20260815062033
```
