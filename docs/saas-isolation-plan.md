# SaaS 三块隔离修复 — 详细实施计划

> 目标：在不破坏单机模式、不大改上游核心架构、最小化未来合并冲突的前提下，
> 一次性修复 **路由用量归属缺口 / 记忆全局画像跨租户共享 / 常驻 Always-On 未隔离** 三块问题，
> 并补齐多租户 + 管理员的全链路深度测试。

本计划是本轮工作的唯一蓝图，实现时严格按此推进，避免冲突与混淆。

---

## 0. 统一隔离判据（三块共用，先落地）

所有租户数据都落在 `DATA_ROOT/tenants/<tenantId>/`（`getTenantPilotHome`），
租户项目在 `DATA_ROOT/tenants/<tenantId>/projects/<proj>`。因此：

- **判据**：一个 `projectRoot` / `projectKey`（绝对路径）属于某租户 ⇔ 它位于该租户的 `tenantPilotHome` 之下。
- **单机判据**：`PILOTDECK_SAAS_MODE` 未开启，或 `projectRoot` 不在任何 `tenants/<id>/` 下 → 视为「非租户/系统」，行为与现状完全一致。

这使三块都能用「路径前缀」做隔离/归属，**无需改 gateway 单进程全局架构**，
gateway 内部读写仍在同一 root 下闭环（避免重蹈「记忆为空」的读写不一致覆辙）。

新增共享 helper（fork 专属目录，便于合并）：
- `src/saas/tenantPaths.ts`：`resolveTenantHomeForProjectRoot(projectRoot, env)` →
  若 `projectRoot` 在 `DATA_ROOT/tenants/<id>` 下返回 `{ tenantId, tenantHome }`，否则 `undefined`。
- `ui/server/saas/tenant/scope.js`：`isProjectKeyInTenant(projectKey, tenantPilotHome)` 路径前缀判断（已有 `getSaasRequestContext` 提供 `tenantPilotHome`）。

---

## ① 常驻 Always-On 租户隔离（最高优先级 — 安全）

### 现状缺陷
- `GET /api/always-on/events`（`always-on-events.js`）扫描全局 `~/.pilotdeck/always-on/projects/*`，跨租户全可见。
- `GET /api/always-on/cron-jobs`（`projects.js#getProjectCronJobsOverview`）调用 `gateway.cronList()` 返回**所有**租户任务。
- `run-now` / `stop` / `delete`（`index.js`）按 `taskId` 操作，**无租户校验** → A 租户可操作 B 租户任务。

### 方案（UI 读取/操作层过滤，零 gateway 架构改动）
事件与任务记录都带 `projectKey`（绝对路径，见 `CronTask.projectKey` / event.projectKey）。

1. `always-on-events.js#getAlwaysOnDashboardEvents`：SaaS 下按 `event.projectKey` 是否在
   `getSaasRequestContext().tenantPilotHome` 下过滤；单机不过滤。
2. `projects.js#getProjectCronJobsOverview`：同样按 `task.projectKey` 过滤。
3. `index.js` 三个操作端点（run-now/stop/delete）：先 `cronList` 找到目标 `task`，
   校验其 `projectKey` 属于当前租户，否则 `403 forbidden`（单机跳过校验）。
4. 新增 `ui/server/saas/alwaysOnScope.js` 封装「按租户过滤事件/任务 + 校验 taskId 归属」，端点只调用它。

### 单机兼容
`getSaasRequestContext()` 为空（无 tenant_id）→ 不过滤、不校验 → 行为不变。

### 标注/合并
全部改动在 `ui/server/**`（fork 层），加 `PD-SAAS-FORK` 注释。gateway/`src` **零改动**。

### 已知遗留（本轮标注、非本轮做）
- 数据物理仍写全局 `~/.pilotdeck/always-on`（按 projectId hash 物理隔离，跨租户不可读名）；
- per-tenant 独立调度属架构级，记入 followup 文档。

---

## ② 记忆全局画像租户隔离

### 现状缺陷
- gateway agent 记忆 `rootDir = config.memory.rootDir`（全局），`global = rootDir/global`（`UserIdentity` 等用户画像）**所有租户共享** → 对话时可能注入他租户画像。
- UI `memoryService.js` 的 `MEMORY_ROOT_DIR = PILOT_HOME/memory`（全局常量）。

### 方案（让有效 memory root 跟随租户；读写两侧用同一推导，保证一致）
1. **gateway 侧**（核心，闭环最关键）：`createLocalGateway.ts#resolveMemoryForProject`
   在 SaaS 下，若 `projectRoot` 属某租户 → 用 `tenantHome/memory` 覆盖 `cfg.rootDir` 传入 factory。
   则 `global` = `tenantHome/memory/global`、project = `tenantHome/memory/workspaces/<slug>`，
   读写都在 gateway 同一 root，天然一致且隔离。推导走 `src/saas/tenantPaths.ts`。
2. **UI 侧**（管理页/导入导出/调度一致）：`memoryService.js` 把 `MEMORY_ROOT_DIR` 由模块常量
   改为「按当前请求租户解析」的函数 `resolveMemoryRootDir()`（SaaS 用 `tenantPilotHome/memory`，否则旧值），
   `servicesByDataDir` 缓存键已是绝对 `dataDir`（租户化后 dataDir 不同，天然不串台）。

### 单机兼容
非租户 `projectRoot` / `getSaasRequestContext()` 为空 → root 用原 `cfg.rootDir` / `PILOT_HOME/memory`，不变。

### 风险与缓解
- 现有「全局共享」的旧画像对租户项目会「不可见」（迁移到租户树前为空）——属预期（旧数据本是 bug 期共享数据）。
- **读写一致性必须回测**：SaaS 下同一租户连续两轮对话，第二轮能检索到第一轮写入的项目/全局记忆。

### 标注/合并
- gateway：`createLocalGateway.ts` 仅在 `resolveMemoryForProject` 内加一处 root 覆盖（`PD-SAAS-FORK`，登记 manifest）。
- 推导逻辑在 `src/saas/tenantPaths.ts`（fork 专属，合并无冲突）。
- UI：`memoryService.js` 加 `PD-SAAS-FORK`。

---

## ③ 路由用量后台任务归属 + 未归属标注

### 现状缺陷
- 当前登录对话归属正确（`usage_session_owner`）。
- 但 cron/always-on/外部 API 的 turn 不写 owner；历史单机数据无归属 → 「未归属」持续增长，统计虽不算错但覆盖不全。

### 方案（聚合层按 projectPath 补归属，不改写入路径）
`ui/server/saas/usage/store.js#aggregateRouterUsage`：对没有 `usage_session_owner` 命中的记录，
若其 `projectPath` 落在某 `DATA_ROOT/tenants/<id>/` 下 → 推断归属到该租户（`src/saas/tenantPaths.ts` 同一推导）；
否则标注为 `system/historical`（单机历史 + 后台系统任务），在管理端用量里单列，不再混入「未归属」黑洞。

### 单机兼容
单机不进入 SaaS 聚合分租户视图；管理端总计逻辑不变。

### 标注/合并
全部在 `ui/server/saas/usage/**`（fork 层）。

---

## ④ 合并护栏（PD-SAAS-FORK + manifest）

- `src` 侧仅一处改动：`createLocalGateway.ts` 的 memory root 覆盖；推导独立到 `src/saas/tenantPaths.ts`。
- 全部新增逻辑优先放 `src/saas/`、`ui/server/saas/`。
- 每处核心改动加 `PD-SAAS-FORK` 注释 + 登记 `config/pilotdeck-core-fork.manifest.json`。
- 完成后跑 `npm run check:saas-fork`、`npm run brand:check`。

---

## ⑤ 深度测试计划（模拟 + 实机 Playwright）

### A. 模拟/单测（快，先跑）
- 新增 `scripts/integration-saas-isolation-check.mjs`：构造两租户项目路径，断言
  ①事件/cron 过滤 ②记忆 root 解析 ③用量归属推断 三个 helper 的隔离判定正确。

### B. 实机 Playwright（多租户 + 管理员，全链路）
覆盖 用户/任务/项目/文件/路由/记忆/常驻，三类断言：(a) 功能正常 (b) 连续任务正常 (c) 隔离正常。
- 账号：`admin/admin123`（平台管理员）、`tenantA`、`tenantB`（两个注册租户）。
- 场景：
  1. 各自登录 → 新建项目 → 发起对话（连续两轮，验证记忆延续）。
  2. 路由用量：各自仅见自己数据；admin 见按用户/项目分组 + 总计。
  3. 记忆：A 写入画像/项目记忆，B 登录检索不到 A 的；A 第二轮能续上第一轮。
  4. 常驻：A 建常驻任务，B 的常驻列表/事件看不到 A 的；B 调用 A 的 taskId run/stop/delete → 403。
  5. 文件/成果：A 的 artifacts 在 B 不可见。
- 复用现有 `ui/e2e/phase*`，新增 `ui/e2e/phase-isolation/*.spec.ts`。

### C. 回归
`npm run test:saas:acceptance`（含 deep）+ P1–P4 单机回归 + `npm run brand:check` + `npm run check:saas-fork`。

---

## ⑥ 执行顺序

1. 共享 helper（§0）。
2. ① 常驻（安全最高，纯 UI 层最安全）→ 即时验证。
3. ③ 路由归属（聚合层，低风险）→ 即时验证。
4. ② 记忆（双侧 root，最需回测）→ 读写一致回测。
5. 合并护栏标注 + manifest。
6. 模拟检查脚本 → Playwright 全链路 → 回归。
7. 输出报告。
