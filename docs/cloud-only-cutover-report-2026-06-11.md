# Phase 2 全云端文件存储 — Cutover 报告

> 日期：2026-06-11  
> DATA_ROOT：`.saas-dev-data`

## 实施摘要

| 阶段 | 状态 |
|------|------|
| 2.1 cloud-only 解析与 provision | ✅ |
| 2.2 syncHub 退役 | ✅ |
| 2.3 文件 API 安全加固 | ✅ |
| 2.4 迁移脚本 + dev 数据 | ✅ |
| 2.5a SaaS 一键建项 | ✅ |
| 2.5b UI 减法 + 只读文件 Tab | ✅ |
| 2.6 测试与文档 | ✅（隔离测试全绿；Live 需 dev:saas） |

## 迁移结果

见 `docs/cloud-only-migration-report-2026-06-11.md`：

- Workspaces promoted: 3
- `local-bindings` 已归档至 `_archive_local-bindings/`

## 自动化验收

| 命令 | 结果 |
|------|------|
| `node scripts/integration-saas-storage-comprehensive.mjs` | 15/15 隔离 PASS（Live 无服务时跳过） |
| `node scripts/integration-saas-folder-scenarios.mjs` | 7/7 隔离 PASS |
| `node ui/server/saas/storage/paths.test.mjs` | PASS |
| `npm run brand:check` | PASS |
| `npm run check:saas-fork` | 4 条历史缺 marker（非本次引入） |

## 双轨确认

- **单机版**：`ProjectCreationWizard`、完整 `FilesV2` CRUD、`browse-filesystem` 不变
- **SaaS**：仅 `cloud-storage`；建项仅名称；文件 Tab 只读+下载；无同步 UI

## 上线前清单

1. 生产跑 `DATA_ROOT=/var/lib/nova npm run migrate:cloud-only`
2. 确认 `_archive_local-bindings` 保留 7 天后清理
3. 启动后跑 Live 段测试（`dev:saas` + `test:saas:storage`）
