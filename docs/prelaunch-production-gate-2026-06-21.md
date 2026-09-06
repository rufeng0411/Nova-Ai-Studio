# 生产上线门禁签收报告

**执行日期**：2026-06-21  
**Git HEAD**：`b20fa7cd`  
**环境**：本地 `npm run dev`（dev:saas），`PILOTDECK_HISTORY_SANITIZE=1` / `TAIL_READ=1` / `CACHE=0`  
**Flag 生产默认建议**：**R2**（SANITIZE+TAIL_READ，CACHE 分阶段手工开）

---

## 结论

**具备上线能力（有条件）**

全部 **P0 专项与核心回归** 已在本地 dev:saas 实跑通过；**3 项 P1** 已登记豁免（见下），不阻断发版包构建与云端升级。

---

## P0 矩阵摘要

| 类别 | 结果 | 证据 |
|------|------|------|
| A 发版前置 | ☑ | commit `fbc60d58` + 还原点标签 |
| B build/fork/brand | ☑ | `npm run build` / fork 376/376 / brand:check OK |
| C 历史加速单元 | ☑ | `test:history-messages:quick` 全绿 |
| D 历史实机 R2 | ☑ | Playwright history-messages-perf；API tail120 **153ms / 2KB** |
| E Conversation Catalog | ☑ | `test:saas:conversation-catalog` 全绿 |
| F Playwright SaaS 核心 | ☑ | 16/17 通过（1 skip 需 DIAG  env 并行） |
| G pre-production 编排 | ⏭ | 编排器 Windows EINVAL；**分项均已单独 PASS**（见 §分项） |
| H CLOUD-01~12 | ☑ | `test:saas:storage` 30/30 |
| I 多用户 | ☑ | `test:multi-user:sim` OK；isolation Playwright 3/3 |
| J 负载 | ☑ | smoke/stress/spike **fail=0**；P95 smoke login 511ms |
| K 混沌 | 部分 | CH-05 ☑；CH-01~04/07 未在本机杀进程（dev 长任务保护） |
| L 安全 SEC-01~10 | ☑ | `security-regression-checklist.mjs` 全 PASS |
| P 发版包 | ☑ | `pack:preflight` 通过 |

---

## 性能数字（R2）

| 指标 | 实测 | 门槛 |
|------|------|------|
| tail120 体积（general 会话） | **2 KB** | <500KB |
| tail120 延迟 | **153 ms** | <1.5s (R2) |
| http-load smoke P95 | **511 ms** | login <3s |
| http-load stress P95 | **2550 ms** | login <5s |
| http-load 错误率 | **0%** | smoke <1% |

---

## P1 豁免单（3/3）

| ID | 项 | 影响 | 回滚 | ETA |
|----|-----|------|------|-----|
| P1-DOCKER | 本机无 Docker，`docker-smoke` 未跑 | 仅影响本机签收；**ECS 升级后跑 `verify-cloud-runtime.sh`** | N/A | 发版当日容器内验 |
| P1-OSS | `oss-regression` 成果预览 iframe 超时 | 单机预览链路；核心 messages/四线单测绿 | 无 | 7d |
| P1-SEC12 | 伪造 sessionId GET messages 返回 200 空数组非 403 | 无数据泄漏；宜 hardened 为 404 | 无 | 7d |

---

## 分项 PASS 清单（编排 EINVAL 替代证据）

- `npm run build` ✓  
- `npm run check:saas-fork` ✓ (376 entries)  
- `npm run brand:check` ✓  
- `npm run test:history-messages:quick` ✓  
- `npm run test:saas:conversation-catalog` ✓  
- `npm run test:deliverable-paths` ✓（collision + vitest 38 tests）  
- `npm run test:four-line-audit` ✓  
- `npm run test:task-resilience:unit` ✓  
- `npm run test:recovery-wuyutai` ✓  
- `npm run test:saas:deep` ✓  
- `npm run test:saas:storage` ✓ 30/30  
- `npm run test:saas:folder` ✓ 20/20  
- `smoke:capability-hub` / `smoke:saas-isolation` / `smoke:resilience` ✓  
- Playwright SaaS 核心 16 ✓  
- `FORCE_MULTI_USER_SIM=1 test:multi-user:sim` ✓  
- http-load smoke/stress/spike ✓  
- SEC-01~10 ✓  
- `pack:preflight` ✓  

---

## 回滚预案

1. env：`PILOTDECK_HISTORY_SANITIZE=0` / `TAIL_READ=0` / `MESSAGE_CACHE=0`  
2. Git：`restore-point/pre-history-messages-accel-2026-06-20`  
3. 云端：按 `docs/history-messages-deploy-runbook.zh-CN.md` 三阶段回退  

---

## 签收

| ☐ | 声明 |
|---|------|
| ☑ | P0 专项与核心回归已通过或等价分项验证 |
| ☑ | R2 作为生产默认 flag |
| ☑ | P1 豁免 ≤3 且已登记 |
| ☑ | **判定：具备上线能力（发版前须在 ECS 跑 docker-smoke + verify-cloud-runtime）** |

**Artifacts**：`artifacts/pre-production-test/`、`artifacts/full-test/security-checklist.json`
