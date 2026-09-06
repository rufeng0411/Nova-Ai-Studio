# SaaS 文件存储 Phase 1 — 合并/验收记录（2026-06-11）

## 范围

WPS 式本地工作目录 + 云端同步；双根 `sessionProjectKey` / `fileRoot`；`user_workspaces` 控制面表。

## 自动化

| 项 | 结果 |
|----|------|
| `node ui/server/saas/storage/paths.test.mjs` | 通过 |
| `npm run check:saas-fork` | 203 条 manifest 通过 |
| `npm run smoke:saas-storage` | 见 CI / 本地 dev:saas 运行 |

## 合并保护

- 逻辑在 `ui/server/saas/storage/**`
- 未改 `src/web/server/readSessionMessages.ts`
- `extractProjectDirectory` 单点 SaaS 委托

## 手动建议

1. 设置 → 云端同步开/关
2. 两台设备或改 `activeDeviceId` 验证空态 hint
3. `POST /api/saas/storage/migrate` 登记存量工作区
