# 稳定性信任栈加固 — 生产级验收评估（2026-07-20）

> 对应计划：稳定性信任栈加固（P0 A/B/C + P1 + §8）。P0-D 终态门控见 [`stability-trust-hardening-m7-terminal-gate-20260720.zh-CN.md`](stability-trust-hardening-m7-terminal-gate-20260720.zh-CN.md)。

## Executive 判定

| 维度 | 判定 | 说明 |
|------|------|------|
| 离线单测 / 脚本门禁 | **GO** | M1/M2/M4/M5 相关套件本机通过 |
| Bridge 实机 browse | **GO** | `wedgedHard=0`，ready P95=5ms |
| 侧栏切换 profile `--gate` | **INCONCLUSIVE** | 本机验收时 Bridge 3001 未就绪（脚本报 unreachable） |
| Gateway 长任务实机 | **未测** | 清单单调性 E2E 需 dev:saas + 登录态 |
| 综合生产体感 | **条件 GO** | P0 代码已落地；打包后须在 Launcher 7990/3001 实机复跑 M3 + M6 |

---

## §8.1 里程碑门禁

| 里程碑 | 门禁 | 命令 | 结果 | Pass 标准 |
|--------|------|------|------|-----------|
| **M1** 底层不 wedged | Bridge unit + browse | `test:bridge-stability:unit` + `test:bridge-stability:browse` | **PASS** | wedgedHard=0；ready P95&lt;500ms |
| **M2** 历史可加载 | Tail read + sanitize | `test:history-messages:quick` | **PASS** | P95 目标 &lt;1.5s（云端待 `test:cloud:chat-load`） |
| **M3** 切换不卡 | Session switch profile | `session-switch-profile.mjs --gate` | **SKIP/INCONCLUSIVE** | P95&lt;800ms；scan≤1 |
| **M4** 清单不闪 | Defer + triple unify | `test:deliverable-triple-unify` + 新增 defer 单测 | **PASS** | 流式无状态回退（实机 E2E 待跑） |
| **M5** 恢复从容 | Recovery | `test:recovery:breakdown` | **PASS** | 无 duplicate hint 堆叠（V2 shadow 已 pack 默认 1） |
| **M6** 任务完成真值 | Goal loop | `test:goal-loop:acceptance:full` | **未跑** | false_incomplete=0 |
| **M7** 终态不续跑 | Terminal gate | P0-D 专项 | **PASS**（见 M7 文档） | 点进 passed 会话 3s 无续跑 |

### M1 明细

- `PILOTDECK_VALIDATE_PARALLEL=3` 已落地（`validateDeliverables.js` 有限并行，上限 3）。
- `/api/saas/health/ready` 探针瘦身为 **control_db only**，不再触发 `warmProjectDirectoryForDeliverables('general')`。
- browse 报告：`artifacts/bridge-stability-test/load-browse-2026-07-20T15-10-11-320Z.json` → `wedgedHard=0`。

### M2 明细

- dev/pack 默认：`PILOTDECK_HISTORY_SANITIZE=1`、`PILOTDECK_HISTORY_TAIL_READ=1`、`VITE_TAIL_MESSAGE_PAGINATION=true`。
- TAIL_READ 丢头：`readSessionMessages.ts` 已有 head merge + truncated 强制 hasMore。

### M4 明细（P0-B1/B2/B3）

- **`VITE_DEFER_DELIVERABLES_WHILE_STREAMING`**：`shouldRunSessionDeliverablesPipeline` + `ChatInterfaceV2` **frozen bundle ref**（流式期间展示上一帧 pipeline，turn 边界 flush）。
- **`resolvePipelineValidationSettled`**：engine `acceptanceStatus` + repair/streaming 优先于纯 disk completeness。
- **legacy O(n) 扫描**：`MessagesPaneV2` 移除 `legacySdmProgress`；`MessageRowV2` / `DeliverableValidationSessionContext` 在 pipeline bundle 模式下跳过全 session collect。

### M5 明细（P0-C2）

- `pack.mjs` 生产 UI build 默认 `VITE_RECOVERY_SURFACE_V2=1`（shadow）。
- devLauncherCore 同步默认 ON。

### P1 批次

| 项 | 状态 |
|----|------|
| `PILOTDECK_HISTORY_MESSAGE_CACHE=1` | devLauncherCore 默认注入 |
| pipeline-store evict | 已有 `invalidateSessionPipelineCache` + manifest cache on LRU evict |
| fetchMore UX | `DeliverableSessionDock` + `hasMoreMessages` 弱提示 |
| Process Detail V2 | pack/dev 默认 `VITE_PROCESS_STEP_DETAIL_V2=1` |
| i18n 弱提示 | dock 使用 `deliverables.loadEarlierForFullList`（defaultValue 兜底） |

---

## §8.2 用户体感 KPI（本机）

| KPI | 测量 | 本机 | 目标 |
|-----|------|------|------|
| 侧栏切换可交互 | profile | 未 gate（Bridge down） | &lt;1s |
| loadMore 首字节 | Network | 未测 | &lt;2s |
| Dock 状态变更/分钟 | E2E | 未测 | ≤3 |
| 红色 error 条/会话 | 人工 | 未扫 | 0 |
| 排队假死 &gt;5min | catalog | 未审计 | 0 |

---

## 已知失败 / 非回归

- `test:turn-queue:unit` 中 **2 项** `acceptedInputDedup.integration` 失败（C0e/C0c，既有问题，与本次 P0 无关）。
- `session-switch-profile --gate` 需 **Launcher Bridge 3001** 在线后复跑。

---

## Feature Flag 回滚

| Flag | 生产目标 | 回滚影响 |
|------|----------|----------|
| `PILOTDECK_VALIDATE_PARALLEL` | 3 | 串行 validate，延迟升 |
| `VITE_DEFER_DELIVERABLES_WHILE_STREAMING` | 1 | 流式清单闪烁复发 |
| `VITE_PILOTDECK_TASK_LIFECYCLE_UI` | 1 | Composer 间隙误开 |
| `VITE_RECOVERY_SURFACE_V2` | 1 | 恢复文案堆叠 |

---

## 下一步（运维 / 实机）

1. Launcher 重启 → `npm run test:bridge-stability:browse`（`SERVER_URL=http://127.0.0.1:7990`）。
2. `node scripts/diag/session-switch-profile.mjs --gate`（Bridge 3001/7990 就绪后）。
3. `npm run test:goal-loop:acceptance:full` 填 M6。
4. 打包前确认 `pack.mjs` 已注入 defer / lifecycle / recovery V2 flags。
