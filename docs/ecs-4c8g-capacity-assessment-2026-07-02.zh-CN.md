# Nova Ai-Studio 单服 ECS 容量评估报告（4 CPU · 8 GB）

**版本**：上线前压力测试评估 v1  
**日期**：2026-07-02  
**目标机型**：阿里云轻量/ECS **4 vCPU · 8 GiB**（与当前 `www.novapage.online` 同档）  
**部署形态**：Nginx → Docker Compose（`nova` + `redis` + 可选 `postgres`）  
**测试环境**：本机 dev SaaS（Bridge **7990**，Gateway **8081**，PG + Redis）；生产抽样 `novapage.online`  
**关联报告**：[`prelaunch-deep-test-report-2026-06-24.md`](prelaunch-deep-test-report-2026-06-24.md)、[`bridge-stability-test-report-2026-06-30.zh-CN.md`](bridge-stability-test-report-2026-06-30.zh-CN.md)

---

## 1. 执行摘要

在 **4C8G 单服**上，Nova Ai-Studio 的瓶颈**不在 CPU 算力本身**，而在：

1. **Bridge 单进程 event loop**（JSONL 读盘、validate 同步 FS）→ 靠背压 503 保活，不能无限加并发  
2. **内存**（Bridge RSS 随会话/压测攀升；Gateway + Playwright 导出尖峰）→ 8GB 余量偏紧  
3. **外部 LLM API**（并发 Agent turn 的真实上限往往由模型池 QPS/Token 决定）

### 推荐生产配额（单服 4C8G）

| 维度 | 🟢 推荐日常 | 🟡 可接受峰值 | 🔴 不建议超过 |
|------|------------|--------------|--------------|
| **注册用户（累计）** | **500～2,000** | 5,000 | 10,000+（须 OSS 容量规划 + PG 调优 + 监控） |
| **同时在线（浏览/切会话）** | **20～30** | **50** | 80+（ready 延迟与 503 显著上升） |
| **同时打开对话页（含 tail120 拉取）** | **10～15** | **25** | 40+ |
| **并发 AI 任务（Gateway turn）** | **3** | **5** | **8+**（易 OOM + turn 超时） |
| **注册/登录突发（captcha+login）** | **10 并发** | **30 并发** | 50 并发 sustained（login P95 >3.5s） |
| **长任务（PPT/多图/OCR）** | **1～2 路** | 3 路 | 4 路并行 |

> **结论**：4C8G 适合 **中小团队 SaaS 首发 / 内测 / 百级 DAU**；若目标 **>50 同时在线** 或 **>5 并发长任务**，应规划垂直扩容（8C16G）或 Bridge/Gateway 拆分。

---

## 2. 测试方法与工具

| 层级 | 脚本 | 测什么 |
|------|------|--------|
| Bridge 热路径 | `npm run test:bridge-stability:{browse,smoke,load,stress}` | messages / validate / ready；wedged 阈值 **>3s** |
| HTTP 入口 | `node scripts/load/http-load.mjs --scenario {smoke,stress,spike,soak}` | captcha + login |
| 并发 Agent | `npm run test:multi-user:sim` | **5 路**独立 WS turn + 隔离断言 |
| 内存 | `npm run test:memory-leak:audit` | Bridge/Gateway RSS、浏览器堆 |
| 生产抽样 | `diag-cloud-conversation-load.mjs` | tail120 P95 / 体积 |

**背压默认值**（`ui/server/middleware/requestBackpressure.js`）：

| 路由 | 默认并发上限 | 超额行为 |
|------|-------------|----------|
| `GET …/messages` | **2 / 租户** | 503 + `Retry-After: 2` |
| `POST …/deliverables/validate` | **2 / 租户·项目** | 503 |
| `GET /api/projects` | **1 全局** | 503 |
| `file/resolve` | **3 / 租户** | 503 |

503 是**主动保护**，不是 Bridge 卡死；客户端须退避重试。

---

## 3. 本轮实测结果（2026-07-02）

环境：`SERVER_URL=http://127.0.0.1:7990`，admin 单租户 dev 数据。

### 3.1 Bridge 稳定性

| 场景 | 时长 | 并发 | ready P95 | wedged | hard fail | 503 占比（validate / messages） |
|------|------|------|-----------|--------|-----------|--------------------------------|
| **browse** | 16 步顺序浏览 | 8 会话×2 轮 | **7 ms** | **0** | 0 | 0 / 0 |
| **smoke** | 60s | v=10, m=5 | **22 ms** | **0** | 0 | 48% / 91% |
| **load** | **5 min** | v=20, m=10 | **42 ms** | **0** | 0 | 72% / 97% |
| stress（6-30 基线） | 3 min | v=30, m=15 | 131 ms | 0 | 0 | 80% / 98% |

**browse 用户路径**（贴近「连点侧栏切会话」）：

- messages P95 **~191 ms**，validate P95 **~146 ms**
- 全程 **无 wedged**

**load 5min 吞吐**（单租户 admin 压测）：

- ready 探针 **106,485** 次，**全部 OK**
- validate 样本 66,088（成功 18,661 + 503 47,427）
- messages 样本 40,397（成功 1,360 + 503 39,037）

JSON：`artifacts/bridge-stability-test/load-*-2026-07-02*.json`

### 3.2 HTTP 入口（captcha + login）

| 场景 | 并发 | 时长 | total | fail | p95 |
|------|------|------|-------|------|-----|
| smoke | 10 | 30s | 858 | **0** | **824 ms** |
| stress | 50 | 120s | 3,534 | **0** | **3599 ms** |

历史 spike（2026-06-24，c=100×60s）：14,372 请求，**0 失败**，p95 485ms（仅 captcha）。

JSON：`artifacts/pre-production-test/http-load-*.json`

### 3.3 并发 AI 任务（Gateway）

`npm run test:multi-user:sim` — **5 路并行** turn：

| 任务 | 耗时 | 结果 |
|------|------|------|
| qxecho | 33s | ✅ 落盘 |
| qxdelta | 78s | ✅ |
| qxalpha | 85s | ✅（brief.md） |
| qxcharlie | 98s | ✅ |
| qxbravo | **120s** | ⚠️ **超时**（已写文件，turn 未完整收尾） |

**隔离**：5 任务无 cross-talk（路径/ slug 未串台）。

### 3.4 内存审计（2026-06-24，与负载叠乘）

| 进程 | 起始 RSS | 压测后 RSS | 增幅 |
|------|----------|-----------|------|
| Bridge | 379.8 MB | **942.6 MB** | **+148%** ❌（阈值 25%） |
| Gateway | 129.7 MB | 130.2 MB | +0.4% ✅ |
| 浏览器堆 | 66.9 MB | 58 MB | -13% ✅ |

已知静态风险：`sessionState` Map 只增不减、前端 `useSessionStore` slot 常驻（见 `memory-leak-audit` 报告）。

### 3.5 生产抽样（novapage.online，2026-06-29）

| 指标 | 值 | 判定 |
|------|-----|------|
| login | 552 ms | pass |
| ready | 73 ms | pass |
| projects | 252 ms | pass |
| tail120 P95 | 1451 ms / 2637 ms | pass / warn |
| tail120 体积 | 54 KB / 112 KB | pass |

---

## 4. 8 GB 内存预算（Compose 生产）

当前 `deploy/docker-compose.prod.yml` **未设** nova/PG 容器 `mem_limit`；仅 Redis **`--maxmemory 256mb`**。

| 组件 | 预估常驻 | 峰值 | 说明 |
|------|---------|------|------|
| OS + Nginx | 0.5～1.0 GB | — | 含 proxy_cache |
| **Redis** | 128～256 MB | **256 MB** | 硬顶 |
| **PostgreSQL**（若启用） | 512 MB～1 GB | 1.5 GB | 建议 `shared_buffers=256MB` |
| **nova 容器** | | | |
| └ Bridge (Node) | 400～600 MB | **~1.0 GB** | 压测/多会话后 |
| └ Gateway (Node) | 130～200 MB | 400 MB | 多 turn 并行 |
| └ Playwright/Chromium | 0（空闲） | **+500 MB～1 GB** | 导出 PDF/PPTX 尖峰 |
| 文件缓存 / tmp | — | 0.5 GB | 大附件、打包 |

**合计**：PG 模式下 **常态 ~3～4 GB**，尖峰 **6～7.5 GB** → **Swap 必须配置**，否则 OOM Killer 风险高。

---

## 5. 容量模型推导

### 5.1 注册用户（累计）

| 因素 | 评估 |
|------|------|
| 控制面 PG/SQLite | 万级用户无压力（catalog 查询 p95 <1 ms 微基准） |
| Redis 验证码 | 256 MB 足够数万短期 key |
| OSS/磁盘 | **真正上限**：每用户 cloud-storage 枢纽 + JSONL 对话 |
| 单服运维 | 建议 **≤2,000** 注册用户配告警；**≤5,000** 需定期备份 + 磁盘监控 |

**推荐**：首发 **500～2,000** 注册用户；超过 **5,000** 评估 RDS + 独立 OSS 生命周期。

### 5.2 同时在线用户（HTTP，不含 AI）

**模型 A — 轻浏览**（侧栏、设置、能力中心）  
- browse 实测：8 会话顺序切换，ready P95 **7 ms**  
- **🟢 20～30 同时在线**（多租户分散）  
- **🟡 50**（偶发 503，客户端重试可恢复）

**模型 B — 重对话页**（tail120 + validate + 预取）  
- 背压：**每租户 2 路 messages + 2 路 validate**  
- 若 10 个租户各 2 人在对话页 ≈ 20 人，但每租户 in-flight 已被限制  
- load 5min：messages 仅 **3.4%** 请求真正 200（其余 503）→ 压测探针远超真实用户  
- **🟢 10～15 人**同时在对话 heavy 路径  
- **🟡 25 人**（503 率上升，体验「稍慢但可用」）

**模型 C — 全员刷新项目列表**  
- `projects` 全局并发 **1** → 大促/重启后短时排队，非持续瓶颈

### 5.3 并发 AI 任务（Gateway turn）

| 证据 | 推论 |
|------|------|
| 5 路 sim：4 成功 + 1 超时 | **硬上限约 5 路**短 markdown 任务 |
| 长任务 PPT/生图 | 单路可占 Gateway+Bridge 数分钟、数百 MB |
| 外部 LLM | 通义/火山等 QPS 常先于 CPU 触顶 |

**推荐**：

| 类型 | 🟢 日常 | 🟡 峰值 |
|------|--------|--------|
| 短任务（md/调研摘要） | **3 并发** | **5 并发** |
| 长任务（PPT/HTML/多图） | **1～2 并发** | **3 并发** |
| 混合 | **总 in-flight turn ≤ 5** | 不超过 **8** |

超出时：排队（产品层「任务进行中」）优于 OOM。

### 5.4 注册/登录突发

| 场景 | 结果 | 建议 |
|------|------|------|
| smoke c=10×30s | 858 req, 0 fail, p95 824ms | 日常 OK |
| stress c=50×120s | 3534 req, 0 fail, p95 3599ms | 大促前预热 Redis；限流防刷 |
| spike c=100×60s（历史） | 0 fail | captcha 可扛百并发 |

**🟢 ≤10 并发注册/登录**；**🟡 30**；持续 **50+** 需 CDN/WAF + 独立 auth 限流。

---

## 6. 瓶颈与风险矩阵

| 优先级 | 瓶颈 | 现象 | 缓解 |
|--------|------|------|------|
| **P0** | Bridge RSS 泄漏 | 长跑后 900MB+ | session 关闭时 `sessionState.delete`；LRU 标题/缓存；定期滚动重启 |
| **P0** | 8GB + PG + Playwright | OOM | 配 2～4GB swap；长任务限并发；导出与 Gateway 分时 |
| **P1** | 背压 503 | 高压下 messages 503 >90% | 客户端退避；可调 `PILOTDECK_BACKPRESSURE_*=3`（须压测验证） |
| **P1** | 巨型 JSONL tail | tail120 P95 >2.5s | **必开** SANITIZE + TAIL_READ + MESSAGE_CACHE |
| **P2** | 单 Bridge 进程 | CPU 4 核无法水平扩展 API | 未来：Bridge 只读副本或 session 粘性负载均衡 |
| **P2** | LLM 外部限流 | turn 排队/超时 | 模型池多 key、队列、用户级并发配额 |

---

## 7. 上线前配置建议（ECS 4C8G）

### 7.1 必做（性能 env）

```bash
sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh
sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh
```

确保：

```
SAAS_CONVERSATION_CATALOG=1
PILOTDECK_HISTORY_SANITIZE=1
PILOTDECK_HISTORY_TAIL_READ=1
PILOTDECK_HISTORY_MESSAGE_CACHE=1
REDIS_URL=redis://redis:6379/0
```

### 7.2 系统层

```bash
# swap（8G 机器强烈建议）
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile

# inotify（对话/jsonl 监控）
sysctl -w fs.inotify.max_user_watches=524288
```

### 7.3 可选调优（压测后决定）

```env
# 若 503 过多且 wedged=0，可小幅放宽（默认 2）
PILOTDECK_BACKPRESSURE_MESSAGES=3
PILOTDECK_BACKPRESSURE_VALIDATE=3

# PG 容器内 postgresql.conf（示例）
shared_buffers=256MB
work_mem=8MB
max_connections=100
```

**勿**在生产关闭背压（`PILOTDECK_REQUEST_BACKPRESSURE=0`），除非有独立限流。

### 7.4 运维策略

| 策略 | 频率 |
|------|------|
| `docker compose … up -d --force-recreate nova` 滚动重启 | Bridge RSS >1.2GB 或每周 |
| `npm run backup:saas:joint` | 每日 |
| `verify:saas:data-integrity` | 每周 |
| `test:bridge-stability:load` + `http-load stress` | 每次大版本发版前 |
| `test:bridge-stability:soak` 30min | 每月 / nightly |

---

## 8. 扩容路径

| 阶段 | 触发条件 | 动作 |
|------|----------|------|
| **L1 单服优化** | DAU <100，同时在线 <30 | 本报告配置 + swap + 监控 |
| **L2 垂直扩容** | 同时在线 30～80 或并发 turn >5 | **8C16G** ECS；PG `shared_buffers` 512MB |
| **L3 读写分离** | 同时在线 >80 | Bridge 只读副本 / tail120 CDN 缓存；Gateway 独立容器 |
| **L4 水平扩展** | 多租户 SLA | 会话粘性 LB + 共享 Redis/PG/OSS；Gateway 池化 |

---

## 9. 监控指标（建议告警阈值）

| 指标 | 🟢 | 🟡 | 🔴 |
|------|----|----|-----|
| `GET /api/saas/health/ready` P95 | <200ms | 200～500ms | **>3s（wedged）** |
| Bridge RSS | <700MB | 700MB～1.2GB | **>1.5GB** |
| tail120 P95 | <1.5s | 1.5～3s | **>3s 或 >1MB** |
| 503 率（messages） | <30% | 30～60% | **>80% 持续 5min** |
| 并发 Gateway turn | ≤3 | 4～5 | **≥6** |
| 磁盘 `/var/lib/nova` | <70% | 70～85% | **>85%** |

---

## 10. 复现命令清单

```powershell
# 前置：dev:saas 或 ECS 上 Bridge 可达
$env:SERVER_URL='http://127.0.0.1:7990'   # ECS 改为 https://your-domain

npm run test:bridge-stability:browse
npm run test:bridge-stability:smoke
npm run test:bridge-stability:load      # 5min
npm run test:bridge-stability:stress    # 3min 可选

node scripts/load/http-load.mjs --scenario smoke
node scripts/load/http-load.mjs --scenario stress

npm run test:multi-user:sim             # 5 路 Gateway，~2min

# 发版前长跑
npm run test:bridge-stability:soak      # 30min
```

---

## 11. 签收结论

| 问题 | 答案 |
|------|------|
| **4C8G 能否上线？** | **可以**，适合百级 DAU、≤30 同时在线、≤3 并发 AI 任务 |
| **最大负载能力？** | Bridge **5min load** wedged=0；HTTP **50 并发登录** 0 错误；Gateway **5 路 turn**（1 路可能超时） |
| **最大注册用户？** | 软件层 **5,000** 内可行；**推荐 500～2,000** 并监控磁盘 |
| **最大同时在线？** | **🟢 20～30**（浏览）/ **🟢 10～15**（对话 heavy）/ **🟡 50** 峰值 |
| **最大并发任务？** | 短任务 **🟢 3 / 🟡 5**；长任务 **🟢 1～2** |
| **首要风险？** | **内存**（Bridge RSS + Playwright 尖峰）> CPU |

**建议**：按 §7 配置发版；上线后首周观察 Bridge RSS 与 tail120 P95；超过 🟡 阈值即规划 **8C16G** 或 Gateway 拆分。

---

*报告生成：仓库压测脚本 + 2026-07-02 实机复跑 + 2026-06-24/29 历史基线。*
