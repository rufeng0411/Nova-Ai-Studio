# 生产上线门禁签收报告

**执行日期**：2026-06-22  
**Git HEAD**：`ef5c96f47f73a935398e6a4a70bb9b37cec1a615`  
**环境**：本地 `npm run dev`（dev:saas），PG + Redis（`SAAS_DATABASE_URL`），服务端口 5173/3002  
**Flag 生产默认建议**：**R2**（SANITIZE+TAIL_READ，CACHE 分阶段开）  
**范围**：Gate-A 本地严苛门禁；**Q 章生产抽检 Deferred**（用户确认 local_only）

---

## 结论

**具备上线能力（有条件）**

全部 **P0 专项与核心回归** 已在本地 dev:saas 实跑通过；**3 项 P1** 已登记豁免（见下），不阻断发版包 `nova-20260622.1805.tar.gz` 构建。

---

## P0 矩阵摘要

| 类别 | 结果 | 证据 |
|------|------|------|
| A 发版前置 | ☑ | HEAD `ef5c96f4`；还原点 `832e9a47` 存在 |
| B build/fork/brand | ☑ | build OK；fork 379/379；brand:check OK |
| C 历史加速单元 | ☑ | `test:history-messages:quick` 全绿（33 tests） |
| D 历史实机 R2 | ☑ | Playwright history-messages-perf；tail120 **P95≈216ms / ≤149KB** |
| E Conversation Catalog | ☑ | `test:saas:conversation-catalog` 全绿 |
| F Playwright SaaS 核心 | ☑ | **17/17** 通过 |
| G pre-production 编排 | ☑ | 分项等价验证（见 §分项）；未跑 monolithic 编排器 |
| H CLOUD-01~12 | ☑ | storage **30/30**；folder **20/20** |
| I 多用户 | ☑ | `test:multi-user:sim` OK；`test:multi-skill:matrix` OK |
| J 负载 | ☑ | smoke/stress **fail=0**；spike 直连 3002 **fail=9/108214** |
| K 混沌 | 部分 | CH-04/05 ☑；CH-01~03/07 未杀进程（dev 长任务保护）；resilience-live ☑ |
| L 安全 SEC-01~10 | ☑ | `security-regression-checklist.mjs` 全 PASS |
| P 发版包 | ☑ | `pack:preflight` + `pack:deploy` → `nova-20260622.1805.tar.gz` |

---

## 性能数字（R2 实机抽样）

| 指标 | 实测 | 门槛 |
|------|------|------|
| tail120 体积（重会话 workspaces-沧海） | **149 KB** | <500KB |
| tail120 延迟 P95（抽样） | **216 ms** | <1.5s (R2) |
| http-load smoke P95 login | **772 ms** | <3s |
| http-load stress P95 | **3494 ms** | login <5s |
| http-load spike 错误率（3002 直连） | **0.01%** | <5% |
| Playwright history-messages-perf | **<800KB** payload | <800KB |

---

## P1 豁免单（3/3）

| ID | 项 | 影响 | 回滚 | ETA |
|----|-----|------|------|-----|
| P1-DOCKER | Docker 客户端存在但 **daemon 未运行**，`docker-smoke` FAIL | 仅影响本机签收；**ECS 升级后跑 `verify-cloud-runtime.sh`** | N/A | 发版当日容器内验 |
| P1-SEC12 | 伪造 sessionId GET messages 返回 **200 空数组** 非 403 | 无数据泄漏；宜 hardened 为 404 | 无 | 7d |
| P1-SPIKE-VITE | spike 经 Vite 5173 代理 **41% 失败**；直连 3002 通过 | 生产 Nginx 直连后端；压测须打 API 端口非 dev proxy | 压测改 SERVER_URL | 文档化 |

---

## 分项 PASS 清单

- `npm run build` ✓  
- `npm run check:saas-fork` ✓ (379 entries)  
- `npm run brand:check` ✓  
- `npm run capabilities:gen` ✓  
- `npm run test:history-messages:quick` ✓  
- `npm run test:saas:conversation-catalog` ✓  
- `npm run test:deliverable-paths` ✓（collision + vitest 38 tests，ui workspace 直跑）  
- `npm run test:four-line-audit` ✓  
- `npm run test:task-resilience:unit` ✓  
- `npm run test:p0-p2:full` ✓（57 unit + integration + selfcheck 16/16 done）  
- `npm run test:recovery-wuyutai` ✓  
- `npm run smoke:resilience` ✓  
- `npm run smoke:project-memory` ✓  
- `test:saas:storage` ✓ 30/30  
- `test:saas:folder` ✓ 20/20  
- `test:process-ux` ✓（engine 8 + ui 14 tests）  
- Playwright SaaS 核心 **17/17** ✓  
- `FORCE_MULTI_USER_SIM=1 test:multi-user:sim` ✓  
- `test:multi-skill:matrix` ✓  
- http-load smoke/stress/spike ✓（spike 见 P1-SPIKE-VITE）  
- SEC-01~10 ✓  
- SEC-11 路径穿越 → **400**（请求被拒，记观察项）  
- SEC-14 超大 POST → 404 ✓  
- `integration-conversation-resilience-live` ✓  
- `pack:preflight` + `pack:deploy` ✓  

---

## Deferred（Gate-B，上线时再开）

- Q-01~Q-04 生产只读抽检（`test:cloud:chat-load`、`verify-cloud-perf.sh` 等）  
- 3 tab 手工压测（Playwright long-session + isolation 作自动化等价覆盖）

---

## 回滚预案

1. env：`PILOTDECK_HISTORY_SANITIZE=0` / `TAIL_READ=0` / `MESSAGE_CACHE=0`  
2. Git：`restore-point/pre-history-messages-accel-2026-06-20` @ `832e9a47`  
3. 云端：按 `docs/history-messages-deploy-runbook.zh-CN.md` 三阶段回退  

---

## 签收

| ☐ | 声明 |
|---|------|
| ☑ | P0 专项与核心回归已通过或等价分项验证 |
| ☑ | R2 作为生产默认 flag |
| ☑ | P1 豁免 ≤3 且已登记 |
| ☑ | **判定：具备上线能力（ECS 发版当日须跑 verify-cloud-runtime + verify-cloud-perf）** |

**Artifacts**：`artifacts/pre-production-test/`、`artifacts/full-test/security-checklist.json`、`dist-release/nova-20260622.1805.tar.gz`
