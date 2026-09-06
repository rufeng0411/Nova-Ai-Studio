# SaaS 三块隔离修复 — 完成报告（2026-06-09）

对应计划：`docs/saas-isolation-plan.md`。三块问题（路由归属缺口 / 记忆全局画像跨租户 /
常驻 Always-On 未隔离）已全部修复，并通过模拟 + 实机多租户/管理员回归。

## 1. 修复总览

| 功能 | 修复前 | 修复后 | 实现层 |
| --- | --- | --- | --- |
| 路由用量 | 后台任务/历史无归属，全进「未归属」 | 后台任务按项目路径归到租户，新增 `backgroundAttributed`；历史/系统单列「系统/历史」 | 聚合层（无写入路径改动） |
| 记忆 | `global` 用户画像全租户共享 | gateway 记忆 root 跟随租户（`tenantHome/memory`），`global` 按租户隔离；读写同 provider 闭环一致 | gateway + UI memoryService |
| 常驻 Always-On | events/cron 全局可见，跨租户可操作 | events/cron 按 `projectKey` 过滤到本租户；run/stop/delete 跨租户 → 403/404 | UI 读取/操作层 |

核心思路：租户数据都在 `DATA_ROOT/tenants/<id>/` 下，故三块统一用「`projectRoot`/`projectKey`
是否在租户树内」做隔离与归属，**不改 gateway 单进程全局架构**，gateway 内部读写闭环一致
（规避「记忆为空」式读写不一致），单机模式零影响。

## 2. 改动文件

**新增（fork 专属，无合并冲突）**
- `src/saas/tenantPaths.ts` — gateway 侧租户路径/记忆 root 推导 + `isSaasMode`。
- `ui/server/saas/tenant/scope.js` — `isProjectKeyInTenant` / `tenantIdForProjectPath`。
- `ui/server/saas/alwaysOnScope.js` — 事件/cron 按租户过滤 + cron 操作归属校验。
- `scripts/integration-saas-isolation-check.mjs` — 模拟隔离检查（`npm run smoke:saas-isolation`）。
- `ui/e2e/saas/isolation.spec.ts` — 多租户实机隔离 spec。

**修改（均加 `PD-SAAS-FORK` 注释 + 登记 manifest）**
- `src/cli/createLocalGateway.ts` — `resolveMemoryForProject` 注入租户记忆 root。
- `ui/server/services/memoryService.js` — 记忆 root 按租户解析 + 调度器遍历各租户 workspace。
- `ui/server/services/always-on-events.js` — 事件按租户过滤。
- `ui/server/projects.js` — cron 列表按租户过滤。
- `ui/server/index.js` — cron run/stop/delete 增加租户归属校验。
- `ui/server/saas/usage/store.js` + `routes.js` — 后台归属推断 + `backgroundAttributed` 字段。

## 3. 单机模式兼容（保证不变）
- gateway：`resolveTenantMemoryRoot` 在非 SaaS 或非租户项目下返回原 `cfg.rootDir`。
- UI：`getSaasRequestContext()` 为空 → 记忆走旧全局 root、事件/cron 不过滤、cron 不校验。
- 路由：单机不进入分租户视图，总计逻辑不变。
- 已由 `smoke:saas-isolation` 的「single-host no-op」断言显式验证。

## 4. 合并护栏
- `npm run check:saas-fork`：**60 条 manifest 全部校验通过**。
- 对上游核心（`src/`）仅 `createLocalGateway.ts` 一处一行级改动（调用 fork helper），
  其余逻辑全在 `src/saas/` 与 `ui/server/**`，未来拉取上游冲突面最小。
- `npm run brand:check`：Nova 品牌守卫 OK。

## 5. 测试结果

| 项 | 范围 | 结果 |
| --- | --- | --- |
| `smoke:saas-isolation` | 三块隔离判定 + 单机 no-op | 9/9 ✅ |
| vitest 租户隔离 | projectsIsolation/paths/mode/projectGuard | 12/12 ✅ |
| 实机 `isolation.spec.ts` | 常驻可见性/跨租户操作403/用量隔离/admin权限 | 3/3 ✅ |
| 实机 `deep-uat.spec.ts` | 注册/成员设置/admin（回归） | 4/4 ✅ |
| 后端单测 | billing/analytics/usage | 4/4 ✅ |
| fork 校验 / 品牌 | 60 条 / Nova | ✅ / ✅ |

测试方式：模拟（纯逻辑断言）+ 实机（重启 dev:saas 后用 admin + 两个注册租户跑 Playwright API/UI）。

## 6. 残留与建议（架构级，非本轮安全问题）
- **常驻物理存储**仍写全局 `~/.pilotdeck/always-on`（按 projectId hash 物理隔离），
  本轮已在读取/操作层完成租户隔离（跨租户不可见、不可操作）；per-tenant 独立调度器属架构级，后续单列。
- **记忆端到端**：路径隔离与 gateway 闭环已就绪，建议用户实测一轮「同租户连续两轮对话」确认记忆延续，
  以及「A/B 两租户」确认互不可见（已由路径与单测覆盖，实测为最终确认）。
- 历史单机数据（SaaS 上线前）归入「系统/历史」，不再混入「未归属」。

## 6.1 修订：`default`（admin）租户不隔离

上线后发现 admin 记忆页变空：admin 属 `default` 租户，被隔离逻辑指向了空的租户树，
而原有 14 个记忆 workspace + 全局画像都在 legacy 全局 `~/.pilotdeck/memory`。

修订：**`default` 租户视为 legacy/全局视图，三块均不隔离**（admin 是平台超管 + 单机数据延续），
仅注册租户 `tenant-<user>` 隔离。涉及 `src/saas/tenantPaths.ts`（`DEFAULT_TENANT_ID`，
`resolveTenantHomeForProjectRoot` 对 default 返回 undefined）、`memoryService.js`、`alwaysOnScope.js`。
验证：admin `GET /api/memory/export/all-projects` 返回 17 个项目 + 1 全局画像（修复前为空）；
`smoke:saas-isolation` 10/10（含 default 不隔离断言）；隔离 spec 仍 3/3（注册租户隔离不受影响）。

## 7. 服务状态
原 dev:saas 终端已停止并重启（加载本轮全部改动），server/gateway/bridge 均就绪，可继续使用。
