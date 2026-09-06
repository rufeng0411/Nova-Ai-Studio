# SaaS 会话目录 `conversation_catalog` 规范

> PD-SAAS-FORK · 权威设计文档 · 2026-06-16

## 1. 目标

在 **SaaS 模式**下，将会话**目录层**（侧栏、搜索、分页、删改元数据）收敛到 PostgreSQL/SQLite 控制库的 `conversation_catalog` 表；**JSONL 仅承载消息正文**，`readSessionMessages` 读路径不变。

单机/OSS（`!PILOTDECK_SAAS_MODE`）**零改动**。

## 2. 数据分层

| 层级 | 权威源 | 内容 |
|------|--------|------|
| 目录 | `conversation_catalog` | session_id、项目归属、标题/摘要、时间戳、软删、`transcript_rel_path` |
| 正文 | 磁盘 JSONL | accepted_input、tool、turn_result 等 |

## 3. Feature Flags

| 变量 | 默认 | 说明 |
|------|------|------|
| `SAAS_CONVERSATION_CATALOG_SHADOW` | `0` | `1` 启用影子写入（Phase 1，UI 仍读磁盘） |
| `SAAS_CONVERSATION_CATALOG` | `0` | `1` 侧栏/搜索/消息路径读 PG（Phase 2+） |
| `SAAS_CONVERSATION_CATALOG_GRAY_PCT` | `100` | 读切换灰度百分比（按 userId % 100） |
| `SAAS_CONVERSATION_CATALOG_STOP_JSONL_METADATA` | `0` | `1` SaaS 停写 JSONL `session_metadata`（Phase 5） |
| `SAAS_MULTI_ECS_NO_SHARED_STORAGE` | `0` | `1` 强制关闭 catalog 读（多 ECS 无共享盘） |

## 4. Schema

主表 **`conversation_catalog`**（勿与 JWT `sessions` 混淆）。

辅表：`conversation_catalog_path_history`、`conversation_catalog_outbox`。

迁移：`ui/server/saas/db/migrations/003_conversation_catalog.sql` + SQLite 内联 DDL。

## 5. 读写路径

- **写**：Bridge `session_created` / `turn_completed` → debounced UPSERT → 失败入 outbox
- **读**：`projects.js` `listSessionsForProjectKey` → PG → 降级磁盘
- **消息**：`messages.js` → catalog `transcript_rel_path` → `readWebSessionMessages`
- **删**：PG soft delete → 删 jsonl → `markPurged`
- **Reconcile**：登录节流 5min → 扫 orphan jsonl → UPSERT

## 6. 回滚

- 代码：`git checkout restore-point/pre-conversation-catalog-2026-06-16`
- 读：`SAAS_CONVERSATION_CATALOG=0`
- 数据 Phase 1：`TRUNCATE conversation_catalog`

## 7. DR 附录（联合备份）

| 项 | RPO | RTO | 操作 |
|----|-----|-----|------|
| PG 控制库 | 24h（日备） | 30min | `pg_dump pilotdeck_saas` |
| DATA_ROOT 租户 | 24h | 1h | tar `tenants/`（含 jsonl） |
| 联合演练 | 季度 | — | 同窗口 dump + tar → restore → 登录打开历史对话 |

**注意**：catalog 行可自 jsonl backfill 重建；**jsonl 正文不可丢**。

## 8. 代码还原点

- 标签：`restore-point/pre-conversation-catalog-2026-06-16` @ `7a37fa76`

## 9. 验收

见计划 §10：`npm run test:saas:conversation-catalog`、`npm run smoke:conversation-catalog`。
