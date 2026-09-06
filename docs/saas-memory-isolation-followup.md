# SaaS 记忆隔离 —— 已修复项与后续项

记录时间：2026-06-09
关联问题：SaaS 模式下「用户记忆为空」深度排查

## 一、本轮已修复（已闭环回测）

### 1. 记忆为空根因：`invalidate()` 关闭活跃会话的记忆库
- **现象**：SaaS 模式下租户记忆面板始终为空；单机模式正常。
- **根因**：配置重载（SaaS 下 `.saas-dev-data` 在被监听仓库内、model-supplement 归一化导致 config diff 非空）频繁触发 `ProjectRuntimeRegistry.invalidate()`，而 `invalidate()` 会 `memoryService.close()` 关闭 SQLite。活跃会话仍持有该 provider 引用，后续 `captureTurn` 抛 `database is not open`，被 `EdgeClawMemoryProvider` 的空 catch 静默吞掉 → 无任何 L0 落库。
- **修复**：`src/cli/createLocalGateway.ts`
  - 新增 `memoryByProject` 缓存，记忆 provider/service 按 `projectRoot` + memory-config 缓存，**脱离** runtime 生命周期。
  - `invalidate()` 不再关闭记忆库；仅在 memory 配置变更时替换、在全量 `dispose()` 时经 `closeAllMemory()` 关闭。
- **可观测性**：`src/context/memory/EdgeClawMemoryProvider.ts` 的 `captureTurn` catch 不再静默，失败时向 gateway stderr 写一行告警（仍不会中断对话），便于今后快速定位同类回归。
- **回测**：重启后同一会话连发 3 轮，L0 稳定递增（50→53，每轮 +1），`/api/memory/overview` 非空，日志无失败告警。

### 已隔离部分
- **项目级记忆（project / feedback scope）**：按 `hashText(projectPath)` 划分 workspace。各租户项目路径不同（`DATA_ROOT/tenants/<id>/projects/...`），workspace 天然隔离 ✓

## 二、后续项（高优先级）：global scope 跨租户共享

### 缺陷
- `ui/server/services/memoryService.js` 中 `MEMORY_ROOT_DIR` / `MEMORY_WORKSPACES_ROOT` / `MEMORY_GLOBAL_ROOT` 是基于 `process.env.PILOT_HOME` 的**模块级常量**，不随租户变化。
- gateway 侧记忆 `rootDir` 同样来自全局配置，落在 `~/.pilotdeck/memory`。
- 因此 **global scope（用户画像 user-profile 等）所有租户共享同一份 `~/.pilotdeck/memory/global`**，存在跨租户读到/混写对方画像的风险。

### 关键约束（为何不是小补丁）
记忆的**写（gateway）/读（UI server `/api/memory/*`）/后台调度（`runMemorySchedulerCycle` 遍历 `MEMORY_WORKSPACES_ROOT`）三处必须使用同一个 root**。
只改其中一侧会让读写路径不一致，重演「记忆为空」。因此必须三处一起改造。

### 建议方案（单机保持不变）
让记忆 root 在 SaaS 下跟随租户 pilotHome：`DATA_ROOT/tenants/<id>/memory`。
- **UI server**（`memoryService.js`）：将 `MEMORY_ROOT_DIR` 等由常量改为按请求解析；SaaS 下取 `getSaasRequestContext().tenantPilotHome + '/memory'`，无租户上下文（单机）回退全局 `~/.pilotdeck/memory`。
- **gateway**（`createLocalGateway.ts` / `createEdgeClawMemoryProviderFromConfig`）：当 `projectRoot` 落在 `DATA_ROOT/tenants/<id>/` 下时，`rootDir` 设为该租户 `tenants/<id>/memory`；否则维持全局。
- **调度器**：`runMemorySchedulerCycle` 需要遍历所有租户的 memory 树（而非单一全局 workspaces 根），否则租户记忆不会被自动 index/dream（手动 flush 与 L0 捕获仍可用）。
- 三处必须基于同一 `tenantId → tenantHome` 推导，保证读写一致。

### 回归风险
- 路径不一致会再次导致记忆面板为空 —— 必须配套读写一致性回测（捕获后立即经 UI API 读回）。
- 现有全局 `~/.pilotdeck/memory` 下已存在的 SaaS 开发租户记忆不会自动迁移，隔离后租户从空开始（开发数据，可接受）。
- 单机模式必须严格零行为变化（`PILOTDECK_SAAS_MODE != 1` 时全部回退全局）。

### 验收建议
- 注册两个租户用户，各自捕获记忆后，互相在 `/api/memory/overview` 与 workspace 列表中**看不到**对方的 project / feedback / global 内容。
- 单机模式记忆捕获、index、dream 与改造前一致。
