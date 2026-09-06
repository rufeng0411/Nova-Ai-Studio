# 新版 UI — 代码还原点（执行后 · 还需优化）

> **执行后**快照：工作台 1.1-Beta 新版 UI 首版已落地，**布局/样式仍需继续优化**。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-new-ui-20260807225313` |
| **提交** | `66059468` |
| **时间** | 2026-08-07 22:53:13 +0800 |
| **说明** | **新版 UI 执行后（还需优化）** |

```bash
git show restore-point/post-new-ui-20260807225313 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- 并行入口 `/app-1.1-beta`、`/m/app-1.1-beta`（`WorkbenchBetaShell` + tokens/Tour）
- AppShell / Sidebar / Chat chrome 与 Beta surface 接线
- Flag / pack / e2e isolation / fixtures / 验收文档
- MdBrowser 导出与 IM 通道帮助等同批

### 待续

- 左栏与全套布局样式深度改版（用户已点名，尚未闭环）
- Beta UX 精修与 cutover 评估

## 回退

```bash
git reset --hard restore-point/post-new-ui-20260807225313
```

对照执行前：`restore-point/pre-new-ui-20260805233754`
