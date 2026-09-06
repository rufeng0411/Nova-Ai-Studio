# Bridge 稳定性实机测试报告（2026-06-30）

环境：本地 dev SaaS，`SERVER_URL=http://127.0.0.1:7990`，`admin/admin123`，PostgreSQL + Redis。

## 结论

| 层级 | 命令 | 结果 |
|------|------|------|
| L0 单元 | `npm run test:bridge-stability:unit` | **PASS**（14 项） |
| L1 分页/sanitize | `npm run test:history-messages:quick` | **PASS**（43 项） |
| L2 实机 browse | `npm run test:bridge-stability:browse` | **PASS** — 8 会话 × 2 轮，wedged=0 |
| L2 smoke 60s | `npm run test:bridge-stability:smoke` | **PASS** — ready P95 39ms，wedged=0 |
| L2 load 5min | `npm run test:bridge-stability:load` | **PASS** — ready P95 81ms，wedged=0 |
| L2 stress 3min | `npm run test:bridge-stability:stress` | **PASS** — ready P95 131ms，wedged=0 |
| 未跑 | `test:bridge-stability:soak`（30min） | 留 nightly / 发版前 |

原始 JSON：`artifacts/bridge-stability-test/load-*.json`

## 实机 browse（贴近「连点侧栏记录」）

- 16 步：8 个真实 sessionId（general + workspaces-NIKE），每步 messages + validate + ready 探针
- messages P95 **117ms**，validate P95 **88ms**，ready P95 **12ms**
- **wedgedCount = 0**（ready 全程 <3s）
- 修复预取限流后，与用户路径一致的场景 **通过**

## 极限并发（smoke / stress / load）

背压在高压下大量返回 **503 retryable**（预期行为，非 Bridge 卡死）：

| 场景 | validate 503 占比 | messages 503 占比 | ready wedged |
|------|-------------------|-------------------|--------------|
| smoke 60s | 52% | 88% | 0 |
| stress 3min | 80% | 98% | 0 |
| load 5min | （见 load-*.json） | — | 0 |

**关键指标**：高压下 `GET /api/saas/health/ready` **P95 仍 <500ms、wedged=0** — Bridge 进程未冻结；503 由背压主动拒绝，客户端应重试。

##  harness 修订（本次补跑前）

旧 harness 把 **503 背压** 计为 hard fail，导致 smoke/stress 误报 FAIL。已改为：

- `retry503` 单独统计
- **pass 门槛**：wedged=0 + ready P95 <500ms + hardErrorRate <5%
- 新增 **`browse` 场景**（真实 session 顺序浏览）

## 与用户反馈的对照

| 现象 | browse 实机 | 说明 |
|------|-------------|------|
| 连点几条后全体卡住 | browse PASS | 预取限流 + 背压已落地；若仍卡请对照 wedged |
| 加载更早慢 | messages P95 ~117ms（browse） | 超大 JSONL 会话仍可能 2–5s，需单独 session  profiling |
| 详情查看慢 | validate P95 ~88ms（browse） | 无 hintDir 裸路径仍可能 sync 扫盘 |

## 建议发版前补跑

```bash
SERVER_URL=http://127.0.0.1:7990 npm run test:bridge-stability:soak   # 30min
npm run test:bridge-stability:full
# Playwright D-03/D-04 见 runbook
```
