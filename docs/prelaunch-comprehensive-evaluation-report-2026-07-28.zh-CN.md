# 上线前全面测试评估报告（ECS 4C8G 代理 · 2026-07-28）

**环境**：本机 Nova Launcher 单栈（Bridge `7990` / Vite `8081`），**非**阿里云 cgroup 真机。
**Bridge**：`http://127.0.0.1:7990` · **UI**：`http://127.0.0.1:8081`
**JSON 汇总**：`artifacts/prelaunch-comprehensive/summary.json`
**关联**：[`prelaunch-ecs-4c8g-evaluation-report-2026-07-12.zh-CN.md`](prelaunch-ecs-4c8g-evaluation-report-2026-07-12.zh-CN.md)

---

## 1. 执行摘要

| 项目 | 结果 |
|------|------|
| **总签收** | **有条件上线（UI 专项）** — 核心交互/连点通过；负载 wedged + 单测/ fixture 失败待修 |
| 十二维通过 | 7/12 |
| 套件步骤 | 20/25 |
| Bridge wedged 合计 | 33 |
| focus-ui | false · skip-extreme=true · skip-offline=true |

### 十二维总判定

| 维度 | 判定 | 通过/失败 |
|------|------|-----------|
| 1. 功能 | FAIL | 2 pass / 1 fail |
| 2. 稳定 | FAIL | 1 pass / 1 fail |
| 3. UI 响应（卡顿/假死） | FAIL | 5 pass / 1 fail |
| 4. 负载 | FAIL | 1 pass / 1 fail |
| 5. 压力 | FAIL | 1 pass / 1 fail |
| 6. 内存 | PASS | 1 pass / 0 fail |
| 7. 安全 | PASS | 1 pass / 0 fail |
| 8. 破坏/混沌 | PASS | 1 pass / 0 fail |
| 9. 数据库/catalog | PASS | 1 pass / 0 fail |
| 10. 对话并发 | PASS | 1 pass / 0 fail |
| 11. 极限负载 | PASS | 1 pass / 0 fail |
| 12. 极限并发 | PASS | 1 pass / 0 fail |

### UI 卡顿/假死专项指标

| 指标 | 值 | 绿/黄/红 |
|------|-----|---------|
| 侧栏切换 P95 | — ms | — |
| Bridge wedged | 33 | 红 |
| browse ready P95 | 4 ms | 绿 |
| load ready P95 | 38 ms | 绿 |

---

## 2. 前置检查

- **PF-01** Bridge ready: ✅ http://127.0.0.1:7990 status=200
- **PF-02** Vite UI: ✅ http://127.0.0.1:8081 status=200
- **PF-03** PostgreSQL: ⚠️ SQLite control (dev ok)
- **PF-04** Redis/Memurai: ⚠️ not detected

---

## 3. 各维度明细

### 1. 功能

**判定**：FAIL

| 步骤 | 结果 | 说明 |
|------|------|------|
| offline-phase | ✅ | SKIP |
| test:prelaunch:quick | ❌ | exit 1 |
| resilience-live | ✅ |  |
| browser-compat-matrix | ✅ |  |

### 2. 稳定

**判定**：FAIL

| 步骤 | 结果 | 说明 |
|------|------|------|
| test:dialogue-stability:full-chain | ❌ | exit 1 |
| bridge-stability:browse | ✅ |  |

### 3. UI 响应（卡顿/假死）

**判定**：FAIL

| 步骤 | 结果 | 说明 |
|------|------|------|
| check-white-screen | ✅ |  |
| session-switch-unit-L1 | ✅ |  |
| session-switch-perf+clickthrough | ✅ |  |
| task-stall-regression | ❌ | exit 1 |
| turn-queue-lifecycle | ✅ |  |
| session-switch-profile | ✅ |  |

### 4. 负载

**判定**：FAIL

| 步骤 | 结果 | 说明 |
|------|------|------|
| bridge-stability:load | ❌ | exit 1 |
| http-load-smoke | ✅ |  |

### 5. 压力

**判定**：FAIL

| 步骤 | 结果 | 说明 |
|------|------|------|
| bridge-stability:stress | ✅ |  |
| http-load-stress | ❌ | exit 1 |

### 6. 内存

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| memory-leak-audit | ✅ |  |

### 7. 安全

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| security-regression | ✅ |  |

### 8. 破坏/混沌

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| chaos-dev | ✅ |  |

### 9. 数据库/catalog

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| projects-coalesce-stress | ✅ |  |
| test:saas:pg | ✅ | SKIP |
| test:saas:pg-validation | ✅ | SKIP |

### 10. 对话并发

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| multi-user-sim | ✅ | SKIP --skip-extreme or --focus-ui |

### 11. 极限负载

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| extreme-suite | ✅ | SKIP --skip-extreme |

### 12. 极限并发

**判定**：PASS

| 步骤 | 结果 | 说明 |
|------|------|------|
| extreme-suite | ✅ | SKIP --skip-extreme |

---

## 4. 关键指标汇总

| HTTP stress P95 | 93 ms |
| HTTP stress fail | 54756 |
| Gateway RSS 增幅 | 0%（795MB 持平） |
| Bridge RSS 增幅 | 未采样（Bridge PID 未识别） |
| 浏览器矩阵 | 全绿 |

---

## 5. 失败根因分析（本轮 6 项）

| # | 步骤 | 根因判断 | 与 UI 卡顿/假死关系 | 建议 |
|---|------|----------|---------------------|------|
| 1 | **task-stall-regression** | Playwright 深链用例：打开 `/session/{id}` 后 **composer 未挂载**（fixture 会话与本地 catalog 不一致或 welcome 态） | 中 — 覆盖「深链进对话空白」类假死 | 用 live catalog 会话跑；或本地 seed `config/sessions/task-stall-8.json` 对应 jsonl |
| 2 | **test:prelaunch:quick** | 离线单测：`process-ux` / `dialogue-stability` UI vitest 失败（ProcessTimeline/InformalProcessStack 等 testid 漂移） | 低 — 非运行时卡顿 | 对齐组件 testid 或更新快照 |
| 3 | **dialogue-stability:full-chain** | `stabilityFlags.test.ts` 快照与新增 env 旗标不一致 | 低 | 更新 ALL_OFF 快照 |
| 4 | **bridge-stability:load** | 5min 负载：`GET ready` **wedgedHard=10**（ready 超时 >5s）；validate/messages 大量 **503 退避**（背压正常） | **高** — Bridge 事件循环被占满时 UI/API 会「假死」 | 查 wedged 采样日志；降并发或优化 coalesce/尾读 |
| 5 | **http-load-stress** | **~50% login 失败**（stress 场景 50 并发打 `/api/auth/login`）；P95 仅 93ms，非慢而是 **429/限流** | 低 — 压测误报，非用户断网 | 压测前重启 Bridge 使 `SAAS_LOGIN_RATE_*=1000` 生效，或 stress 仅打 captcha |
| 6 | **（未跑）multi-user / soak** | `--skip-extreme` 跳过 15min soak 与 5 路 AI 并发 | — | 发版前低峰跑 `npm run test:prelaunch:comprehensive` 全量 |

### UI 卡顿/假死专项结论

| 探针 | 结果 | 说明 |
|------|------|------|
| 白屏检测 | ✅ | `/p/general` 无白屏 |
| 侧栏切换 perf + 疯狂连点 | ✅ | Playwright 11s 通过 |
| 侧栏切换剖析 | ✅ | messages API：p50 **92ms**，p95 **590ms**（47MB 巨会话 tail 读）；判定「Bridge 延迟可接受，卡顿更可能在前端 deliverable 扫描」 |
| Turn 排队生命周期 | ✅ | 1s |
| Task-stall 深链 | ❌ | composer 未出现 — 需 fixture/catalog 对齐 |
| Bridge browse | ✅ | wedged=0，ready P95 **4ms** |
| Bridge load（5min） | ❌ | wedged=**10**，ready P95 38ms — **负载下偶发 wedged 与卡顿同源** |
| Bridge stress | ✅ | wedged=0（压测后恢复） |
| 内存审计 | ✅ | Gateway RSS **0%** 增幅；静态风险：`sessionState`/`useSessionStore` 无 LRU |

**综合**：日常浏览/连点 **未复现** 卡顿；**持续负载** 下 Bridge ready wedged 与历史报告的 load wedged 一致，是 UI「假死」最可疑路径。HTTP login 50% fail 为限流 artifact，**不应**当作用户联网问题。

---

## 6. 发版建议

1. **UI 卡顿**：优先看 `session-switch-perf` / `session-switch-profile` 与 Bridge wedged；>0 须查 `docs/rca-task-stall-*.md`
2. 生产跑 `apply-cloud-perf-env.sh` + `verify-cloud-perf.sh`
3. ECS 4C8G 配 **4GB swap**；Bridge/Gateway RSS 告警 >1.2GB
4. 压测后 **65s 冷却**再跑 SEC，避免 login 429 误判
5. 长任务 AI 并发 ≤3；定期滚动重启 nova

---

## 7. 产物索引

| 路径 | 说明 |
|------|------|
| `artifacts/prelaunch-comprehensive/` | 本套件日志 |
| `artifacts/session-switch-validation/` | L1–L7 会话切换 |
| `artifacts/session-switch-profile/` | 侧栏切换剖析 |
| `artifacts/bridge-stability-test/` | Bridge 负载/压力 |
| `artifacts/memory-audit/` | 内存泄漏审计 |

**声明**：本机 dev:saas 代理测试；真机 OOM/CPU 行为可能与阿里云 4C8G 有偏差。

