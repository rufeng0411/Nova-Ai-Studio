# 新版 UI — 代码还原点（执行前）

> **执行前**基线：新版 UI 落地之前。  
> 同提交含工作台良品率对齐、IM 通道、企业 MCP Batch1、用户组权限。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/pre-new-ui-20260805233754` |
| **提交** | `83318ee2` |
| **时间** | 2026-08-05 23:37:54 +0800 |
| **说明** | **新版 UI 执行前** |

```bash
git show restore-point/pre-new-ui-20260805233754 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更（基线快照）

- 工作台良品率对齐展示 / brief 契约与 L3 验收编排
- IM 通道后台与 `im-notify` MCP
- 企业 MCP Batch1、MCP feature flags、写工具门控
- 用户组权限（migration 009 + Admin）
- 平台插件/通道管理页与 fork manifest 登记

### 尚未开始

- 新版 UI 主体改版（本标签之后）

## 回退

```bash
git reset --hard restore-point/pre-new-ui-20260805233754
```
