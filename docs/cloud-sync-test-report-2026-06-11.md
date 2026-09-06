# 云端同步多场景测试报告

**日期**：2026-06-11  
**环境**：Windows 本地 `npm run dev:saas`（PG `pilotdeck_saas`，Server `3001`，Vite `5173`）  
**执行命令**：

```bash
npm run smoke:saas-storage
npm run smoke:saas-storage:e2e
npm run test:saas:storage
```

**机器可读结果**：`artifacts/cloud-sync-test/report.json`

---

## 结论摘要

| 套件 | 用例数 | 通过 | 失败 |
|------|--------|------|------|
| 路径单测 `paths.test.mjs` | 6 断言 | 6 | 0 |
| Playwright E2E `integration-saas-storage-smoke.mjs` | 1 流程 | 1 | 0 |
| **综合集成 `integration-saas-storage-comprehensive.mjs`** | **29** | **29** | **0** |

**判定**：在已覆盖场景下，云端同步核心逻辑（自动 provision、双根解析、双向 last-write-wins 同步、租户/用户路径隔离、开关偏好、多用户 API）**行为符合设计，未发现阻断性缺陷**。

**说明**：「无懈可击」指当前 Phase 1 范围内已验证路径均通过；文末仍列出**已知设计边界**与建议后续加固项（非本次失败项）。

---

## 测试矩阵

### A. 隔离环境（临时 `DATA_ROOT` + SQLite 控制库）

模拟多租户用户 `syncalice` / `syncbob`，含破坏性文件操作。

| ID | 场景 | 结果 |
|----|------|------|
| ISO-01 | 新用户 `syncLocalToCloud` 默认 `true` | PASS |
| ISO-02 | 开启同步后 `ensureSaasWorkspacesProvisioned` 自动登记 `proj-a` + `general` | PASS |
| ISO-03 | `enrichSaasProjects` 返回 `syncEnabled=true` | PASS |
| ISO-04 | 同步开启时 `fullPath` 指向 `canonicalProjectKey` 枢纽 | PASS |
| ISO-05 | 首次单项目 sync 本地 → 枢纽 | PASS |
| ISO-06 | **破坏性**：本地文件更新（较新 mtime）→ 覆盖枢纽 | PASS |
| ISO-07 | **破坏性**：仅改枢纽且 mtime 更新 → 下行覆盖本地旧版 | PASS |
| ISO-08 | **安全**：Bob 租户 `assertStoragePathAllowed` 拒绝 Alice 枢纽路径 | PASS |
| ISO-09 | Bob 独立 provision，枢纽路径与 Alice 不同 | PASS |
| ISO-10 | 关闭云端同步后，新文件夹不再 auto-provision | PASS |
| ISO-11 | 重新开启同步后，新文件夹自动登记 | PASS |
| ISO-12 | `syncAllForCurrentUser` 批量同步 ≥2 个工作区 | PASS |
| ISO-13 | 同步成功后写入 `lastSyncedAt`（ISO UTC） | PASS |
| ISO-14 | **破坏性**：枢纽文件被删，本地较新内容 sync 恢复 | PASS |
| ISO-15 | **安全**：同租户跨 `userId` 云路径被拒绝 | PASS |
| ISO-16 | 偏好层关闭同步时单项目 sync 行为（见边界说明） | PASS |

### B. Live 多用户 API（真实 dev:saas + PostgreSQL）

| ID | 场景 | 结果 |
|----|------|------|
| LIVE-00 | `/api/saas/health` 可达 | PASS |
| LIVE-01 | Admin `admin/admin123` 登录 | PASS |
| LIVE-02 | Admin `storage/status` → `mode=saas` | PASS |
| LIVE-03 | Admin 云端同步默认开启 | PASS |
| LIVE-04 | 工作目录默认 `local` | PASS |
| LIVE-05 | Admin 全量 `POST /storage/sync-now` | PASS |
| LIVE-06 | 全量同步后 `lastSyncedAt` 有值 | PASS |
| LIVE-07 | 新注册用户 `synctest*` 独立租户 | PASS |
| LIVE-08 | Member `storage/status` 与 Admin 租户隔离 | PASS |
| LIVE-09 | Member 空租户全量 sync 返回 `{results:[]}` | PASS |
| LIVE-10 | Member 关闭云端同步偏好持久化 | PASS |
| LIVE-11 | Member 重新开启云端同步 | PASS |
| LIVE-12 | 未登录访问 `storage/status` → 401 | PASS |

### C. Playwright E2E

- 浏览器登录 Admin → `storage/status` + `preferences.fileStorage` 默认值校验：**PASS**

---

## 破坏性 / 多角度场景说明

已执行的破坏性用例：

1. **枢纽较新覆盖本地**：模拟 B 设备在云端改文件后，A 设备 sync 拉取新版。
2. **本地较新覆盖枢纽**：模拟本机编辑后 push 到云。
3. **枢纽文件删除后恢复**：本地保留较新副本，sync 后枢纽文件重现。
4. **跨租户路径探测**：`assertStoragePathAllowed` 拒绝 foreign hub。
5. **同租户跨 userId 路径**：拒绝访问他人 `cloud-storage/users/{otherId}`。
6. **同步开关**：关 → 不 provision 新目录；开 → 自动登记。

未自动化但已识别的边界（建议 Phase 2）：

| 项 | 说明 | 风险级别 |
|----|------|----------|
| `lastSyncedAt` 账号级 | 所有文件夹共用同一时间戳，非 per-workspace | 低（UX） |
| last-write-wins 仅 mtime | 时钟漂移、同秒冲突无合并策略 | 中 |
| 无实时/后台 sync | 须手动点同步或依赖 API 触发 | 低（产品预期） |
| 大文件 / 二进制 / 并发 sync | 未压测 | 中 |
| 双设备同时编辑同一文件 | 后 sync 者覆盖，无冲突 UI | 中 |
| 直接改 DB 偏好绕过 `updateSyncForUser` | 仅内部 API 误用场景；正常 UI 走 PUT preferences 会同步 `sync_enabled` | 低 |

---

## 架构验证要点（与实现一致）

```
租户 projects/.cwd  →  ensureWorkspaces（sync 开）
                    →  local-bindings/.../devices/{deviceId}/workspaces/{uuid}
                    →  cloud-storage/.../workspaces/{uuid}  (canonical hub)

syncHub: copyNewerFiles(local→hub) + copyNewerFiles(hub→local)
resolveFileRootFromWorkspace: syncEnabled → 读写 canonical
```

- **General 文件夹**：已纳入 auto-provision（`legacyProjectId=general`）。
- **手动「登记」**：已移除用户路径；开启云端同步即自动 provision。
- **管理员**：与 Member 相同 storage API 语义；租户数据隔离已验证。

---

## 回归入口

```bash
# 快速
npm run smoke:saas-storage
npm run smoke:saas-storage:e2e

# 全量多场景（推荐合并前）
npm run test:saas:storage
```

---

## 最终结论

本次 **29/29** 综合用例 + 路径单测 + Playwright E2E **全部通过**。云端同步在「多用户登录、本地目录、双根枢纽、开关偏好、破坏性文件冲突、租户隔离」等已设计场景下**逻辑闭环、无已知阻断 bug**。

若需进一步逼近「生产级无懈可击」，建议下一阶段补充：per-workspace `lastSyncedAt`、冲突检测提示、大目录性能压测、双设备并发 Playwright 剧本、以及 PG 专用迁移回归。
