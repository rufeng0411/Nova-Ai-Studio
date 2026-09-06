# SaaS 控制面 PostgreSQL 阶段一运维手册

**范围**：仅 `control.db`（租户/用户/订阅/积分/运营事件/路由归属），不含 `auth.db`、EdgeClaw、对话 JSONL。

**还原标签**：`restore-point/pre-pg-phase1`（切换前务必确认已打标签）

---

## 1. 本地 PostgreSQL（D:\pgsql）

### 1.1 创建库与用户

在 PowerShell 中（按你的实际超级用户/密码调整）：

```powershell
$env:Path = "D:\pgsql\bin;" + $env:Path

# 创建角色（若尚未存在）
psql -U postgres -c "CREATE USER pilotdeck WITH PASSWORD 'YOUR_PASSWORD';"

# 创建库
psql -U postgres -c "CREATE DATABASE pilotdeck_saas OWNER pilotdeck;"
psql -U postgres -c "CREATE DATABASE pilotdeck_saas_test OWNER pilotdeck;"
```

### 1.2 连接串

```text
# 开发
SAAS_DATABASE_URL=postgresql://pilotdeck:YOUR_PASSWORD@127.0.0.1:5432/pilotdeck_saas

# 自动化测试（勿与开发库混用）
SAAS_PG_TEST_URL=postgresql://pilotdeck:YOUR_PASSWORD@127.0.0.1:5432/pilotdeck_saas_test
```

可选：

| 变量 | 说明 |
|------|------|
| `SAAS_DATABASE_SSL` | 托管 PG 设为 `require` |
| `SAAS_DATABASE_POOL_MAX` | 连接池上限，默认 10 |

**未设置 `SAAS_DATABASE_URL` 时**：仍使用 `DATA_ROOT/control.db`（SQLite），便于回滚与本地默认开发。

---

## 2. 启动与健康检查

```powershell
# SQLite 模式（默认 dev:saas）
npm run dev:saas

# PostgreSQL 模式
$env:SAAS_DATABASE_URL = "postgresql://pilotdeck:YOUR_PASSWORD@127.0.0.1:5432/pilotdeck_saas"
npm run dev:saas
```

健康探测：

```http
GET /api/saas/health
```

期望：`200` + `{ "ok": true, "backend": "postgres", "db": "ok" }`

启动日志应包含：

```text
[saas] Control DB: postgres (SAAS_DATABASE_URL)
```

若 ping 失败，服务会拒绝启动（避免静默空库）。

---

## 3. 维护窗口切换（一次性）

**前置**：公告维护 ≥30 分钟；确认无进行中的注册/订阅/对话扣费。

### 3.1 切换步骤

1. **停写**：停止 UI Server / `dev:saas` / 生产实例。
2. **备份 SQLite**：
   ```powershell
   copy F:\Ai-pilotdeck\.saas-dev-data\control.db F:\Ai-pilotdeck\.saas-dev-data\control.db.bak-YYYYMMDD
   ```
   生产环境建议卷快照或异地备份。
3. **迁移**（停写期间）：
   ```powershell
   node scripts/migrate-control-sqlite-to-pg.mjs `
     --source F:\Ai-pilotdeck\.saas-dev-data\control.db `
     --target "postgresql://pilotdeck:YOUR_PASSWORD@127.0.0.1:5432/pilotdeck_saas"
   ```
4. **校验**：脚本输出 `OK` 且退出码 0；可选二次：
   ```powershell
   node scripts/migrate-control-sqlite-to-pg.mjs --source ... --target ... --verify-only
   ```
5. **切 PG 启动**：设置 `SAAS_DATABASE_URL` 后启动服务。
6. **冒烟**：
   - `admin` / `admin123` 登录
   - 新用户注册 + 验证码
   - 订阅 trial、积分到账
   - `/admin` 仪表盘
   - 改密
7. **自动化**：
   ```powershell
   npm run test:saas:pg
   npm run test:saas:deep
   npm run test:saas:acceptance
   ```

### 3.2 回滚（目标 15 分钟内）

1. 停止服务。
2. **取消** `SAAS_DATABASE_URL`（或从环境中移除）。
3. 若切换后 SQLite **未再写入**：恢复 `.bak` 覆盖 `control.db`。
4. 若 SQLite 已被写入：以 **切换前 `.bak` 为准**（PG 侧增量丢弃）。
5. 启动并验证登录；必要时重跑 `test:saas:phase1`～`phase3`。

---

## 4. 迁移脚本说明

| 选项 | 作用 |
|------|------|
| `--source` | SQLite `control.db` 路径 |
| `--target` | PostgreSQL 连接串 |
| `--dry-run` | 只统计 SQLite 行数，不写 PG |
| `--verify-only` | 对比 SQLite 与 PG 行数/关键汇总 |

**导入顺序**：tenants → users → plans → sessions → subscriptions → credit_wallet → credit_ledger → analytics_events → usage_session_owner

**校验项**（任一失败则退出码 1）：

- 每表 `COUNT(*)`
- `users` 全量 id/username/tenant_id/role
- `credit_wallet` 的 `SUM(balance)`
- `credit_ledger` 的 `SUM(delta)`
- Identity 序列对齐 `MAX(id)`

**关键不变量**：`users.id` 保持不变，避免已签发 JWT 批量失效。

---

## 5. 测试矩阵

| 命令 | 说明 |
|------|------|
| `npm run test:saas:phase1`～`phase3` | SQLite 回归（默认 CI） |
| `npm run test:saas:pg` | PG 可达时跑双后端单测 + 迁移测试 |
| `npm run test:saas:deep` | 深度不变量 |
| `npm run test:saas:acceptance` | 全量 L5（切换后必跑） |

---

## 6. 生产托管 PostgreSQL 建议

- 启用 SSL（`SAAS_DATABASE_SSL=require`）
- 独立只读账号供报表
- 定期 `pg_dump`（建议每日 + 切换前全量）
- 监控连接池耗尽与慢查询

---

## 7. 阶段二（本手册不实施）

- `auth.db` 合并或拆 schema
- EdgeClaw `control.sqlite`
- 只读副本 / 报表库

**阶段一成功标准**：SaaS 控制面读写走 PG，`test:saas:acceptance` 在 PG 环境通过，且具备 15 分钟内 SQLite 回滚能力。
