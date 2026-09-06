# 交付汇总表 SDM 回归 — 代码还原点

> 交付汇总表与 SDM hydrate/行匹配/Modric 实机回归全绿后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-deliverable-summary-sdm-2026-07-04` |
| **提交** | `f24be326` |
| **说明** | SDM hydrate、汇总行匹配、部分交付、Modric REG-06~09 回归 |

```bash
git show restore-point/post-deliverable-summary-sdm-2026-07-04 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **Bridge**：`messages.js` SDM hydrate、`pilotdeck-bridge` 事件透传
- **汇总行**：`buildDeliverableSummaryRows` kind-only / acceptance / verifiedPaths 匹配
- **UI**：`DeliverableSummaryTable` 部分交付态、`useSessionStore` manifest 缓存
- **引擎**：`sessionDeliverableManifest` 编译加固、`AgentLoop` repair 事件
- **验收**：`run-deliverable-summary-regression.mjs`、MOD-01~05 + REG-06~09 全绿

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-deliverable-summary-sdm-2026-07-04
```

### 从还原点开实验分支

```bash
git checkout -b experiment/deliverable-summary restore-point/post-deliverable-summary-sdm-2026-07-04
```

### 只还原某个文件

```bash
git checkout restore-point/post-deliverable-summary-sdm-2026-07-04 -- path/to/file
```
