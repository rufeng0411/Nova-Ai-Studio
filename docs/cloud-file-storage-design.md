# 用户文件云端存储（Phase 2 — 全云端）

双轨产品：**单机版**保持本地项目目录不变；**SaaS** 工作文件仅读写 `cloud-storage` 枢纽，与本地文件夹零联动，用户按需下载。

## 路径（SaaS）

```
DATA_ROOT/tenants/{tenantId}/
  cloud-storage/users/{userId}/workspaces/{workspaceUuid}/   ← 唯一文件根
  projects/{stableProjectId}/chats/*.jsonl                    ← 对话 transcript（不迁入 hub）
  projects/{stableProjectId}/.cwd                           ← 指向 canonical hub
```

`local-bindings/` 已退役；存量经 `npm run migrate:cloud-only` 归档至 `_archive_local-bindings/`。

## 解析规则

| 字段 | Phase 2 行为 |
|------|----------------|
| `canonicalProjectKey` | 云端枢纽；Agent cwd、文件 API、成果搜索均以此为准 |
| `localRootPath` | 恒 `NULL`（新 workspace） |
| `sessionProjectKey` | canonical；JSONL 仍在稳定 `projects/*/chats/`，靠 `.cwd` 桥接 |

实现：`workspaceCwd = fileRoot = canonical`；`extractProjectDirectory` 经 `enrichSaasProjects` 返回 hub 路径。

## API

| 端点 | 行为 |
|------|------|
| `GET /api/saas/storage/status` | `mode: 'cloud-only'` |
| `POST /api/saas/storage/reconcile` | 仅 provision + 松散 artifacts 迁入 |
| `POST /api/saas/storage/sync-now` | no-op，`skipped: 'cloud-only'` |
| `GET /api/browse-filesystem` | SaaS **403** |
| `POST/PUT/DELETE …/files/*` | SaaS UI 写操作 **403**（Agent 经 Gateway 写 hub 不受影响） |
| `GET …/files/content?download=1` | 单文件下载 |
| `GET …/download` | 项目 ZIP |

## 前端（SaaS）

- 新建项目：`SaasCreateProjectDialog`（仅名称）
- 文件 Tab：只读浏览 + 预览 + 下载/ZIP
- 设置：一句云端说明，无同步开关

## 安全

- `assertStoragePathAllowed` 接入所有文件读 API
- `projectGuard` 白名单：canonical hub + transcript 目录 + 租户元数据（不含 `local-bindings`）

## 合并保护

- 业务逻辑在 `ui/server/saas/storage/**`
- 交汇文件 `PD-SAAS-FORK`：`projects.js`、`index.js`、`FilesV2.tsx`、`AppShellV2.tsx` 等
- 不改 `src/**` transcript 格式

## 部署

`cloud-storage/` 须在 `DATA_ROOT` 持久卷（`/var/lib/nova`）。多 ECS 需共享卷或下阶段 OSS。
