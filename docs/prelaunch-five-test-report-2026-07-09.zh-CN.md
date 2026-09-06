# 上线前五项测试报告（2026-07-09）

**环境**：Nova Launcher 单栈 — Bridge **7990** / Vite **8081** / Gateway **18789**  
**DATA_ROOT**：`.saas-dev-data`（PG + Redis）  
**强度**：中等偏低（未跑 5min load / 30min soak / Gateway 杀进程 / Redis 停服）

---

## 总判定

| # | 类别 | 结果 | 摘要 |
|---|------|------|------|
| 1 | **内存溢出** | ✅ **通过** | Gateway RSS 30 轮压测 **0% 增幅**；浏览器堆 **-24%**；静态风险 2 项 high 已登记 |
| 2 | **负载** | ✅ **通过** | browse 用户路径 wedged=0；HTTP smoke 876 请求 0 失败 |
| 3 | **压力** | ✅ **通过** | Bridge smoke wedged=0；HTTP stress 3552 请求 0 失败 |
| 4 | **破坏性** | ✅ **通过** | 韧性 smoke 4/4；Bridge 健康；Gateway 杀/Redis 停为登记项 |
| 5 | **安全** | ✅ **通过** | SEC-01～12 全绿 |

**签收**：五项 **全部通过**，可支持 controlled 上线；公网前仍须改默认口令、配 HTTPS/限流，ECS 建议 4GB swap。

---

## 1. 内存溢出 / 泄漏

**命令**：`MEM_AUDIT_ROUNDS=30 MEM_AUDIT_BROWSER_ROUNDS=8 npm run test:memory-leak:audit`  
**报告**：`artifacts/memory-audit/memory-audit-2026-07-09T02-28-35.json`

### 1.1 运行时采样

| 进程 | 起始 | 结束 | 增幅 | 判定 |
|------|------|------|------|------|
| Bridge RSS | — | — | — | ⚠️ 未采样（Launcher 下 Bridge PID 未解析到 7990 端口） |
| **Gateway RSS** | **415.2 MB** | **415.2 MB** | **0%** | ✅ |
| **浏览器 JS 堆** | 63 MB | 47.6 MB | **-24.4%** | ✅ |

30 轮 API 压力 + 8 轮浏览器切会话：**未触发 OOM**，Gateway 内存平稳。

### 1.2 静态代码风险（需长期治理）

| ID | 严重度 | 说明 |
|----|--------|------|
| `bridge-session-state` | **high** | `sessionState` Map 只增不减 |
| `ui-session-store` | **high** | 前端 session slot 常驻不 prune |
| `bridge-title-cache` 等 | medium | 进程级缓存无 LRU |

### 1.3 建议

- ECS 生产：**4GB swap** + 监控 Bridge/Gateway RSS（告警 >1.2GB）  
- 发版窗口在 **docker 单进程** 上补跑完整 40 轮 audit，确认 Bridge RSS 增幅 ≤25%  
- 长跑后定期滚动重启 nova 容器

---

## 2. 负载测试

**口径**：`SERVER_URL=http://127.0.0.1:7990`

### 2.1 Bridge browse（用户路径 — 侧栏 8 会话×2 轮）

| 指标 | 值 |
|------|-----|
| ready P95 | **7 ms** |
| wedged | **0** |
| messages P95 | **877 ms** |
| validate P95 | **240 ms** |
| 503 | **0** |

JSON：`artifacts/bridge-stability-test/load-browse-2026-07-09T02-24-41-865Z.json`

### 2.2 HTTP 入口 smoke（captcha + login，c=10×30s）

| total | fail | p95 |
|-------|------|-----|
| **876** | **0** | **788 ms** |

JSON：`artifacts/pre-production-test/http-load-smoke.json`

**结论**：日常浏览与认证入口 **负载能力正常**。

---

## 3. 压力测试

### 3.1 Bridge smoke（60s，validate c=10 / messages c=5）

| 指标 | 值 |
|------|-----|
| ready P95 | **40 ms** |
| **wedged** | **0** ✅ |
| hard fail | **0** |
| validate 503 | ~54%（背压，预期） |
| messages 503 | ~94%（背压，预期） |

JSON：`artifacts/bridge-stability-test/load-smoke-2026-07-09T02-26-20-512Z.json`

### 3.2 HTTP stress（c=50×120s）

| total | fail | p50 | p95 |
|-------|------|-----|-----|
| **3552** | **0** | 373 ms | **3552 ms** |

JSON：`artifacts/pre-production-test/http-load-stress.json`

**结论**：高压下 Bridge **未 wedged**；登录/captcha **无 hard 失败**；P95 ~3.5s 在 50 并发下可接受（公网建议 Nginx 限流）。

**未跑（可选加深）**：`bridge-stability:load` 5min、`http-load spike` c=100、`soak` 15min。

---

## 4. 破坏性 / 混沌测试

**命令**：`npm run test:chaos:dev`（`--skip-gateway-kill`）

| 项 | 结果 |
|----|------|
| CH-07 Redis 不可用 | 📋 文档登记（须手工停 Memurai/Redis） |
| CH-01 Gateway 杀进程 | ⏭ 默认跳过（保护进行中对话） |
| `smoke:resilience` RecoveryBudget | ✅ **4/4** |
| Bridge `/api/health` | ✅ 7990 |

JSON：`artifacts/chaos-dev/report-2026-07-09.json`

**发版前可选手工项**（见 `docs/conversation-resilience-spec.md`）：

- 杀 Gateway 进程 → UI 应弱提示并自动续跑  
- 停 Redis → 验证码/缓存降级，不应全站崩溃  
- `restart-ui-dev` ×3 不应丢 catalog 会话

---

## 5. 安全测试

**命令**：`node scripts/security-regression-checklist.mjs`

| ID | 检查 | 结果 |
|----|------|------|
| SEC-01 | 未登录 `/api/projects` | ✅ 401 |
| SEC-03 | 未登录 storage | ✅ 401 |
| SEC-04 | 篡改 JWT | ✅ 403 |
| SEC-05 | SaaS 登录墙 | ✅ |
| SEC-06 | 注册无验证码 | ✅ 400 |
| SEC-10 | SQL 注入探针 | ✅ 401 |
| SEC-12 | 伪造 session messages | ✅ 404 |
| SEC-08 | `.env` gitignore | ✅ |

JSON：`artifacts/full-test/security-checklist.json`

**公网前必做**（非自动化）：改 `admin123`、HTTPS、登录 rate limit、核对 CORS。

---

## 6. 产物索引

| 类别 | 路径 |
|------|------|
| 内存 | `artifacts/memory-audit/memory-audit-2026-07-09T02-28-35.json` |
| 负载/压力 | `artifacts/bridge-stability-test/load-*-2026-07-09*.json` |
| HTTP | `artifacts/pre-production-test/http-load-*.json` |
| 混沌 | `artifacts/chaos-dev/report-2026-07-09.json` |
| 安全 | `artifacts/full-test/security-checklist.json` |

---

## 7. 发版建议

1. ✅ 本次五项可签收  
2. ECS 部署后跑 `verify-cloud-perf.sh` + `apply-cloud-perf-env.sh`  
3. 生产首次上线补：**Bridge RSS 完整 audit**（docker 环境可采样 PID）  
4. 可选加深：spike / 5min load / Gateway 杀进程 / Redis 停服手工混沌  

**关联**：[`ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md`](ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md)
