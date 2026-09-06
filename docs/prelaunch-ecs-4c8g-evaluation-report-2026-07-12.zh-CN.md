# ECS 4C8G 上线前全维测试评估报告（2026-07-12）

**环境**：本机 Nova Launcher **单栈**（Bridge `7990` / Vite `8081` / Gateway `18789`）  
**性质**：本地代理测试，**非**阿里云 ECS cgroup 真机压测  
**编排器**：`npm run test:prelaunch:ecs-4c8g` → [`scripts/run-prelaunch-ecs-4c8g-suite.mjs`](../scripts/run-prelaunch-ecs-4c8g-suite.mjs)  
**JSON 汇总**：[`artifacts/prelaunch-ecs-4c8g/summary.json`](../artifacts/prelaunch-ecs-4c8g/summary.json)  
**容量基线**：[`ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md`](ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md)

---

## 1. 执行摘要

| 项目 | 结果 |
|------|------|
| **总签收** | **有条件上线**（基础设施与极限并发达标；功能单测/Playwright/高压 wedged 须治理或豁免） |
| 首轮套件步骤 | **13/24** 通过（约 36 分钟 + 15min HTTP soak + 极限并发） |
| 八维（首轮） | 破坏 **PASS**、极限并发 **PASS**；其余 6 维有 FAIL |
| Bridge browse（用户路径） | ✅ **wedged=0**，ready P95 **7～9 ms** |
| 极限 HTTP spike c=100 | ✅ **0 fail**，P95 **302 ms** |
| 5 路 AI 并发 | ✅ **无串台**，multi-user sim OK |
| Gateway 内存 40 轮 | ✅ RSS **0%** 增幅 |

> **说明**：首轮「不可上线」主要来自 **(a) 功能/稳定单测失败**、**(b) 连续压测后 login 429 污染 SEC/http**、**(c) load/stress 探针 wedged>0**。安全项在限流窗口外 **复测全绿**（见 §5）。

---

## 2. 八维总判定

| 维度 | 首轮 | 复测/备注 | 4C8G 映射 |
|------|------|-----------|-----------|
| **1. 功能** | FAIL | build/brand ✅；browser 8/8 ✅；p0-p2、saas:deep、Playwright 3 项 FAIL | 核心路径可用，管理/隔离 E2E 待修 |
| **2. 稳定** | FAIL | browse ✅ wedged=0；dialogue-stability 单测 FAIL | 用户浏览路径 **绿** |
| **3. 负载** | FAIL | load 5min **wedged=64**；http smoke 50% fail（login 429） | 超背压探针 **黄～红** |
| **4. 压力** | FAIL | stress **wedged=53**；http stress 50% fail（429） | 极限并发下 ready 探针 **黄** |
| **5. 安全** | FAIL→**PASS** | 限流窗口外 SEC-01～12 **全绿** | **绿** |
| **6. 破坏** | PASS | chaos-dev 4/4；Gateway 杀/Redis 停为登记项 | **绿** |
| **7. 极限负载** | FAIL | http soak 15min **0 fail**；memory audit **PASS**；bridge soak **栈溢出** | HTTP 长跑 **绿**；Bridge soak **红** |
| **8. 极限并发** | PASS | spike 0 fail；5 路 turn 无串台 | **绿** |

---

## 3. 4C8G 推荐配额对照

摘自 [`ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md`](ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md)：

| 维度 | 🟢 推荐日常 | 🟡 峰值 | 🔴 不建议 | **本轮观测** |
|------|------------|---------|----------|-------------|
| 同时在线（浏览） | 20～30 | 50 | 80+ | browse wedged=0，P95 **7 ms** → **🟢** |
| 对话页 heavy | 10～15 | 25 | 40+ | load ready P95 **61～92 ms**，但 wedged **64** → **🟡** |
| 登录突发 | ≤10/min | 30 | 50 sustained | 默认 **10 IP/min** 限流生效；spike captcha **0 fail** → **🟢**（captcha）；连续 login 压测会 429 → **🟡** |
| AI 并发 turn | 3 | 5 | 8+ | 5 路 sim **无串台** → **🟡**（峰值内） |
| 注册用户（累计） | 500～2000 | 5000 | 10000+ | 未压测；控制面 SQLite dev → 生产须 PG |

**结论（4C8G 单服）**：适合 **百级 DAU、≤30 同时浏览、≤3 并发 AI 短任务**；**load/stress 探针 wedged** 提示 Bridge 在 v=20～30 并发 validate/messages 下 event loop 偶发 >3s，须监控 + 背压/扩容规划，非 CPU 算力不足。

---

## 4. 前置检查

| ID | 项 | 结果 |
|----|-----|------|
| PF-01 | Bridge ready | ✅ 7990 |
| PF-02 | Vite UI | ✅ 8081 |
| PF-03 | PostgreSQL | ⚠️ 未设 `SAAS_DATABASE_URL`（dev SQLite） |
| PF-04 | Redis/Memurai | ⚠️ 6379 未检测到（验证码走内存 fallback） |

---

## 5. 关键指标与复测

| 指标 | 首轮 | 复测（隔离/限流窗口外） | 绿/黄/红 |
|------|------|------------------------|---------|
| Bridge wedged browse | 0 | 0 | 🟢 |
| Bridge wedged load 5min | 64 | 64 | 🔴 |
| Bridge wedged stress 3min | 53 | 53 | 🔴 |
| HTTP smoke fail | 15025/30070 | 22538/45096（login 429 叠乘） | 🟡* |
| HTTP stress fail | 33340/66720 | 42880/85800（同上） | 🟡* |
| HTTP spike fail | **0** | — | 🟢 |
| HTTP soak 15min fail | **0** | — | 🟢 |
| SEC-01～12 | 429 污染 | **12/12 PASS** | 🟢 |
| Gateway RSS 增幅 | 0% | — | 🟢 |
| multi-user 串台 | 无 | — | 🟢 |

\* http-load 的 login 端点在 **同 IP 连续压测** 下触发 `SAAS_LOGIN_RATE_IP_PER_MIN=10`（Bridge 进程内内存桶，**须重启 Bridge 或冷却 60s** 后复测才有效）。captcha-only 的 spike/soak **不受影响**。

---

## 6. 失败根因（按优先级）

### P0 — 须发版前处理或登记豁免

1. **功能单测**：`stabilityFlags.test.ts`（新增 flag 未同步期望）、`useProjectsState.sessionIntent.test.ts`（乐观会话占位）
2. **Playwright SaaS**：admin 用户管理、多租户隔离、Composer 可见性 3 项 FAIL（端口 8081 环境）
3. **Bridge soak 15min**：`Maximum call stack size exceeded` 崩溃 — **须修或降级为 5min soak 门禁**

### P1 — 容量与运维

4. **load/stress wedged>0**：ready 探针在高压下 >3s（历史 7/2 基线 wedged=0，本轮复现稳定）→ 查 Bridge 同步 FS / 背压叠乘
5. **login 429 串联失败**：全维套件须 **步骤间冷却 65s** 或 **`SAAS_LOGIN_RATE_*` 在 Bridge 启动时注入**（已在编排器 v2 加入，需重启 Launcher 生效）

### P2 — 观察项

6. **saas:deep** 注册路径 `x-forwarded-for` 未定义（单测/mock 环境）
7. **dialogue-stability:full-chain** 部分 historical 用例 FAIL

---

## 7. 八维步骤明细（首轮套件）

| 维度 | 步骤 | 结果 |
|------|------|------|
| 功能 | build / fork / brand | ✅ |
| 功能 | p0-p2 / saas:deep / prelaunch:quick / playwright | ❌ |
| 功能 | resilience-live / browser-compat 8/8 | ✅ |
| 稳定 | smoke:resilience / browse | ✅ |
| 稳定 | dialogue-stability:full-chain | ❌ |
| 负载 | history-messages:quick | ✅ |
| 负载 | bridge load / http smoke | ❌ |
| 压力 | bridge stress / http stress | ❌ |
| 安全 | security-regression（首轮） | ❌ |
| 破坏 | chaos-dev | ✅ |
| 极限负载 | bridge soak / http soak / memory audit | ❌ / ✅ / ✅ |
| 极限并发 | http spike / multi-user | ✅ / ✅ |

---

## 8. 发版建议（ECS 4C8G）

1. **必做**：`apply-cloud-perf-env.sh` + `verify-cloud-perf.sh`（SANITIZE / TAIL_READ / CACHE / catalog / Redis）
2. **系统**：4GB swap；`fs.inotify.max_user_watches=524288`
3. **安全**：改默认口令；HTTPS；生产 login 限流 **保留**（本轮验证有效）
4. **监控**：Bridge/Gateway RSS 告警 >1.2GB；ready wedged 计数
5. **配额**：同时在线 **≤30**；AI 并发 **≤3** 日常 / **≤5** 峰值；长任务 **≤2** 路
6. **测试复跑**：`npm run test:prelaunch:ecs-4c8g`（重启 Launcher 后，确保 `SAAS_LOGIN_RATE_*` 或步骤冷却生效）

---

## 9. 产物索引

| 路径 | 说明 |
|------|------|
| `scripts/run-prelaunch-ecs-4c8g-suite.mjs` | 八维编排器 |
| `artifacts/prelaunch-ecs-4c8g/suite-log.jsonl` | 逐步日志 |
| `artifacts/prelaunch-ecs-4c8g/summary.json` | 机器可读汇总 |
| `artifacts/bridge-stability-test/load-*.json` | Bridge 负载/压力 |
| `artifacts/pre-production-test/http-load-*.json` | HTTP 入口 |
| `artifacts/memory-audit/memory-audit-2026-07-12T15-46-52.json` | 内存审计 |
| `artifacts/full-test/security-checklist.json` | SEC 复测全绿 |
| `artifacts/browser-compat-matrix/report-2026-07-12T15-24-10.json` | 浏览器 8/8 |

---

## 10. 签收结论

| 级别 | 判定 |
|------|------|
| **基础设施 / 容错 / 浏览器 / 极限 HTTP / AI 隔离** | ✅ 达标，可支持 controlled 内测/首发 |
| **4C8G 高压 Bridge（load/stress wedged）** | ⚠️ 黄～红，须监控与背压；目标 >50 同时在线须扩容 |
| **功能回归 / Playwright / Bridge soak 崩溃** | ❌ 发版前须修复或书面豁免 |
| **综合** | **有条件上线**：完成 P0 项 + 生产 env/改密/swap 后可灰度；全量公网推广建议 8C16G 或 Bridge 拆分 |

**声明**：本报告基于 Windows 本机 dev:saas 单栈；OOM/CPU 与阿里云 4C8G 真机可能存在偏差；**spike/soak 已通过 captcha 路径验证**，login 路径限流行为与生产一致（属预期保护）。
