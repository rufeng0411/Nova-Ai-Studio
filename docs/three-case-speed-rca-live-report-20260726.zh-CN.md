# 三案速度/稳定度 Gateway 实机对比报告

- **执行时间**：2026-07-26 20:45–21:01（UTC+8）
- **环境**：`dev:saas` Bridge **7990** / Gateway **18789** / Vite **8081**
- **命令**：`npm run test:three-case-speed-rca:live:gate`（workers=1 串行）
- **Flags**：`PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT=1`、`PILOTDECK_ORCH_BYPASS_MATRIX_GEO=1`、`PILOTDECK_MATRIX_CORE_GT_PASS=1`
- **产物目录**：`artifacts/three-case-speed-rca-20260726/`
- **JSONL 权威路径**：`~/.pilotdeck/projects/Ai-pilotdeck-general/chats/cli-project=general-s_*.jsonl`

---

## 1. 执行摘要

| 维度 | 结论 |
|------|------|
| **Harness 门禁** | **0/3 PASS**（三案均报 FAIL） |
| **引擎/JSONL 真值** | 海绵宝宝 **PASS**；黑袍 matrix **PASS 7/7**；GEO **部分交付 + 模型欠费中断** |
| **稳定度（P0′ 主目标）** | 三案 **subagent=0**、黑袍 **repair=0**（基线 42×）、无 `tmp_workspace` — **显著改善** |
| **速度（首 write）** | 黑袍 **39min→56s**（约 **97%** 提速）；海绵宝宝 ~**2.1min**（与基线持平）；GEO **4.6min** 首写（无 subagent，但仍慢于 3min 目标） |
| **假 FAIL 根因** | Live harness **读不到 CLI 会话 messages API（404）**，`footerProgress` 恒为 0/0；`firstWriteFileMs` 误用 **整 turn 时长** 而非首条 `write_file` 时间戳 |

**一句话**：P0′ 对 **黑袍一文多发** 的提速与稳定度提升已实机验证；海绵宝宝维持健康直写；GEO 仍受 **调研链路过长 + 首文件路径错误触发 repair + 通义欠费（Arrearage）** 三重影响。Harness 需修才能作为可靠 KPI 门禁。

---

## 2. 修复前 vs 修复后对比表

| 案例 | 修复前（文档基线） | 本次实机（JSONL 真值） | 首 write | 总 turn | repair | subagent | 验收 | 达 KPI？ |
|------|-------------------|------------------------|----------|---------|--------|----------|------|----------|
| **海绵宝宝 user-research** | ~2min 直写，0 repair | 2 槽 SDM，`research` profile | **128s** | 160s | **0** | **0** | **passed 2/2** | 速度≈持平；稳定 ✅ |
| **黑袍 matrix** | 首写 ~39min，SDM 7/11，**42× repair**，多 subagent | `one-article-matrix` **7 槽**，主 Agent 直写 7 文件 | **56s** | 221s | **0** | **0** | **passed 7/7** | 速度 **大幅 ✅**；稳定 **大幅 ✅** |
| **GEO 全案** | 17min 首 subagent，4× `tmp_workspace` | 8 槽 GEO profile，主 Agent 直写；turn 末 **Arrearage 400** | **276s** | 537s（欠费截断） | **1**（引擎内 repair 注入） | **0** | **needs_repair**（5/8 文件已写，槽位未齐） | 无 subagent ✅；首写/完案 ❌ |

> 基线来源：`docs/full-chain-speed-implementation.zh-CN.md` §L4 表 5。

---

## 3. 分案日志分析

### 3.1 海绵宝宝用户研究（`spongebob-us-research`）

**会话**：`cli:project=general:s_c9fa28dc-65a6-4412-9905-d236ab657b6a`  
**任务目录**：`artifacts/task-20260726-b3aedf53/`

| 时间点 | 事件 |
|--------|------|
| T+0s | SDM 编译：`user-research-report.md` + `data-sources.md`（2 槽，`nova-research-user-general`） |
| T+12s | 首帧 UI（`turn-timing` firstVisibleMs=12270） |
| T+128s | **首 write**：`user-research-report.md` |
| T+146s | write `data-sources.md` |
| T+160s | `turn_acceptance_meta` **passed**，verified=2 |

**工具链**：`read_skill×1` → `web_search×4` → `write_file×2`（无 agent/Task）

**稳定度**：0 repair、0 subagent、SDM 无 flywheel phantom 槽。

**Harness 误报**：`footerProgress 0/0`（API 404）；首写 128s < 180s 门槛，**真值应 PASS**。

---

### 3.2 黑袍纠察队一文多发（`blackcloak-matrix`）

**会话**：`cli:project=general:s_6f57a3ea-e282-4ac5-b968-f6147d4cbf5c`  
**任务目录**：`artifacts/task-20260726-05e64ca0/`

| 时间点 | 事件 |
|--------|------|
| T+0s | SDM：`one-article-matrix` **7 槽**（article + 5 平台 + data-sources） |
| T+24s | 首帧 UI |
| T+**56s** | **首 write**：`article.md`（基线 ~39min → **约 97% 提速**） |
| T+95s–194s | 串行 write：zhihu / xiaohongshu / wechat / douyin / bilibili / data-sources |
| T+221s | **passed**，verified=**7/7** |

**工具链**：`read_skill×1` → `write_file×7` → `glob×1`（**无 agent/Task**）

**P0′ 生效点**：
- `one-article-matrix` profile 替代 social_matrix/flywheel 误绑
- `PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT=1` 硬禁 subagent
- `PILOTDECK_ORCH_BYPASS_MATRIX_GEO=1` 跳过 autoOrch 剥工具

**Harness 误报**：`firstWriteFileMs=221141` 实为 **整 turn 时长**（真首写 56s）；`footerProgress 0/0`。

---

### 3.3 品牌 GEO 全案（`geo-brand-full`）

**会话**：`cli:project=general:s_9aa218e4-e6b2-40ec-a33e-a7baeb6eac41`  
**任务目录**：`artifacts/task-20260726-9a09e4d5/`

| 时间点 | 事件 |
|--------|------|
| T+0s | SDM：GEO profile **8 槽**（audit / keywords / optimized / 社媒 / schema / reports…） |
| T+25s | 首帧 UI |
| T+93s | `mcp__browser-use__browser_navigate` **失败**（chrome-for-testing 未安装） |
| T+93s | 引擎注入 **tool_recovery** synthetic 消息 |
| T+**276s** | **首 write**（错误路径）：`novapage-online-geo-full-case-20250714.md` |
| T+297s | 引擎 **deliverable_repair** 注入：要求补 `artifacts/geo/...`（**路径与 task 目录不一致**） |
| T+361s–532s | 按槽补写：audit / keywords / optimized / zhihu-article |
| T+537s | **turn 异常结束**：`stopReason=model_error`，通义 **Arrearage（欠费）** |

**已写文件（盘内 5+）**：
- `geo-aeo-audit-checklist.md`
- `keywords-research.md`
- `optimized.md`
- `zhihu-article.md`
- `novapage-online-geo-full-case-20250714.md`（非 SDM pathHint 命名）
- `data-sources.md`（repair 前已通过）

**工具链**：`web_fetch×6`、`web_search×7`、`read_skill×2`、`write_file×5`；**subagent=0**，**tmp_workspace=0**。

**根因链**：
1. **调研前置过长**（~4.5min 才首 write）— web_fetch/search + browser 失败 recovery
2. **首文件 basename 偏离 SDM** → 触发 repair 假缺口（`artifacts/geo/...` phantom path）
3. **模型池欠费** 在 turn 第 12 轮截断，剩余槽（schema.jsonld / visibility-report.html 等）未写

**对比基线**：无 subagent、无 tmp_workspace — **稳定度维度已改善**；完案率受 **路径契约 + 外部 API** 拖累。

---

## 4. Telemetry 交叉验证

来源：`.saas-dev-data/telemetry/turn-timing.jsonl`、`final-acceptance-events.jsonl`

| caseId | traceId | totalMs | firstVisibleMs | acceptance | verifiedCount |
|--------|---------|---------|----------------|------------|---------------|
| spongebob | `47662c2f-…` | 160430 | 12270 | passed | 2 |
| blackcloak | `02c8aaf9-…` | 221139 | 24405 | passed | 7 |
| geo | `5fc56ab9-…` | 537137 | 24741 | needs_repair | 1（中途快照） |

GEO turn 末 JSONL：`errors[0].code=agent_model_error`，`Arrearage`，累计 **666k input tokens** — 长调研链 + 多轮 write 导致 token 膨胀。

---

## 5. Harness 门禁缺陷（导致 0/3 假 FAIL）

| 问题 | 现象 | 建议修复 |
|------|------|----------|
| **CLI 会话 messages 404** | Bridge `GET /api/sessions/cli:project=general:s_*` 返回 404；transcript 在 `~/.pilotdeck/projects/...` | harness 改读 **jsonl 尾扫** 或 `bridgeCliSessionToCatalog` 后走 **catalog transcriptRelPath** |
| **firstWriteFileMs 算法** | `scanMessageKpis` 用 `turnResult.durationMs` 代替首 write 事件时间 | 解析 jsonl `tool_call_started(write_file)` 首条 `createdAt - turnStart` |
| **footerProgress** | `countSdmProgress(messagesEnvelope)` 在 API 空 envelope 时恒 0/0 | 同上；或读 `turn_acceptance_meta.slotBindings` |
| **GEO gate 期望** | `footerProgressMin 9/10` vs 实际 profile **8 槽** | 对齐 `deliverableCapabilityProfiles` geo 槽位数 |

修复文件：`scripts/lib/runThreeCaseSpeedRcaLiveGateway.mjs`

---

## 6. P0′ / 三案 RCA 加固效果评估

### 6.1 稳定度（权重高）

| 指标 | 修复前（黑袍/GEO） | 本次三案 | 判定 |
|------|-------------------|----------|------|
| subagent 调用 | 有（GEO 17min 级） | **0** | ✅ P0′-3 生效 |
| deliverable_repair 风暴 | 黑袍 42+ | 黑袍 **0**；GEO **1**（路径误判） | ✅ 大幅收敛 |
| tmp_workspace | GEO 4× | **0** | ✅ |
| SDM phantom 槽 | flywheel 7/11 等 | matrix **7/7** 精确 | ✅ P0′-2 |
| 单 turn 完案 | 黑袍常不完 | 黑袍 **单 turn passed** | ✅ |

### 6.2 速度

| 指标 | 目标 | 海绵宝宝 | 黑袍 | GEO |
|------|------|----------|------|-----|
| 首 write | ≤120–180s | 128s ✅ | 56s ✅ | 276s ❌ |
| 总 turn | — | 160s | 221s | 537s（欠费） |
| vs 基线首写 | — | ~持平 | **~97%↓** | subagent 消除；绝对值仍慢 |

**结论**：提速与稳定 **不冲突**；黑袍是 P0′ 最大收益案；GEO 下一刀应砍 **调研前置 + pathHint 对齐 + 禁用/降级 browser MCP**。

---

## 7. 下一步改进（按 ROI 排序）

### P0 — Harness 可观测性（否则 KPI 不可信）

1. `runThreeCaseSpeedRcaLiveGateway.mjs`：CLI 会话改 **jsonl 直读** SDM/acceptance/首 write 时间戳
2. 修正 `firstWriteFileMs` / `footerProgress` 算法；GEO gate 槽位分母与 profile 同步
3. 跑完后输出 **engineTruth vs harnessGate** 双列 JSONL，避免假 FAIL

### P1 — GEO 完案率

1. **capabilityBindingPrompt**：GEO 全案禁止 `browser_navigate` 首选；失败即 `web_fetch` ladder（dev 未装 Playwright 是已知坑）
2. **SDM pathHint 与 Agent 命名对齐**：禁 `artifacts/geo/`、`novapage-online-geo-full-case-*` 等 SDM 外路径；首 write 必须命中槽位 basename
3. **`PILOTDECK_PARALLEL_GEO_STAGES=shadow→enforce`**：独立文件槽并行 write（在 sequential gate 允许处）
4. 模型池 **欠费快停**：Arrearage 应 `UserActionRequired` 而非空 content turn 结束

### P2 — 海绵宝宝/黑袍微调

1. 黑袍：7 文件串行 write → 无依赖槽 **并行 write_file**（预期 221s→~120s）
2. 海绵宝宝：`web_search×4` 可合并为 2 次 batched query（预期 128s→~90s）

### P3 — 运维

1. 重跑 GEO 前确认 **通义/DashScope 账户余额**
2. dev 栈可选：`npx @playwright/mcp install-browser chrome-for-testing` 或 Hub 标注 browser 能力为 optional

---

## 8. 复现与取证命令

```powershell
# 前置：dev:saas 就绪
$env:SERVER_URL="http://127.0.0.1:7990"
$env:PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT="1"
$env:PILOTDECK_ORCH_BYPASS_MATRIX_GEO="1"
$env:PILOTDECK_MATRIX_CORE_GT_PASS="1"
npm run test:three-case-speed-rca:live:gate
```

**手动读 JSONL KPI**（绕过 harness）：

```bash
node -e "/* 见 artifacts/three-case-speed-rca-20260726/analysis-detail.json */"
```

---

## 9. 附件

| 文件 | 说明 |
|------|------|
| `artifacts/three-case-speed-rca-20260726/kpi-live.jsonl` | Harness 原始 KPI 行 |
| `artifacts/three-case-speed-rca-20260726/run-manifest.json` | 汇总 manifest |
| `artifacts/three-case-speed-rca-20260726/live-run-console.log` | 控制台 tee |
| `artifacts/three-case-speed-rca-20260726/analysis-detail.json` | JSONL 解析后的引擎真值 |
| `~/.pilotdeck/projects/Ai-pilotdeck-general/chats/cli-project=general-s_*.jsonl` | 三案完整 transcript |

---

**报告结论**：P0′ 已在 **黑袍 matrix** 上实现生产级 **稳定度 + 两个数量级提速**；海绵宝宝保持健康；GEO **稳定度改善但完案失败** 主因是 **路径契约 + 调研链 + 模型欠费**，非 subagent 回归。优先修 harness 读数，再按 §7 推进 GEO 与并行 write。
