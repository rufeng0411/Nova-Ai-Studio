# Conversation Catalog QA Report — 2026-06-16

## 实施范围

- Phase 0：规范文档、feature flags、性能基线
- Phase 1：`003_conversation_catalog` 迁移、CatalogStore、Bridge 影子 UPSERT、backfill
- Phase 2：读路径切换（`SAAS_CONVERSATION_CATALOG=1`）、缓存指纹、messages 403/路径
- Phase 3：删改 PG 先行、purge_pending
- Phase 4：reconcile worker、遥测
- Phase 5：PG 搜索、JSONL metadata 停写 flag

## 自动化结果

| 套件 | 结果 |
|------|------|
| `catalogStore.test.mjs` | PASS (3/3) |
| `tests/session/session-list.test.ts` | PASS (3/3) |
| `npm run smoke:conversation-catalog` | PASS |
| `npm run benchmark:conversation-catalog` | PASS (p50 ~0.09ms) |
| `npm run test:saas:conversation-catalog` (SKIP_LIVE=1) | PASS |

## 启用方式

```powershell
# Phase 1 影子写（UI 仍读磁盘）
$env:SAAS_CONVERSATION_CATALOG_SHADOW='1'

# Phase 2 读切换（可配合灰度）
$env:SAAS_CONVERSATION_CATALOG='1'
$env:SAAS_CONVERSATION_CATALOG_GRAY_PCT='100'

# Phase 5 停写 JSONL metadata
$env:SAAS_CONVERSATION_CATALOG_STOP_JSONL_METADATA='1'
```

## 回滚

- 代码：`git checkout restore-point/pre-conversation-catalog-2026-06-16`
- 读：`SAAS_CONVERSATION_CATALOG=0`
- 数据：`TRUNCATE conversation_catalog`

## 待实机（需 dev:saas 运行）

- Playwright P5/P6（`scripts/ui-conversation-catalog-check.mjs`）
- T8 PG 故障降级、T11 联合 DR 演练
