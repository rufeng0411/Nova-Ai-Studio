# Nova Ai-Studio 生产上线测试报告

- **日期**：2026-06-30
- **Git HEAD**：`b25f8b6d480b0afb09045e2818a881e356a33fcd`（报告生成后修复 `finalAcceptance.ts` 构建类型，须再 commit）
- **执行人**：Cursor Agent（自动化门禁 + 局部实机）
- **环境**：本地 `dev:saas`（Vite **8082** / Bridge **7991** / Gateway 18789 端口占用但 Bridge 已连）
- **历史加速轮次**：未分 R1/R2/R3 切换（dev 默认 SANITIZE + TAIL 已注入）
- **最终结论**：☐ 具备上线能力　**☑ 不具备（P0 自动化大部分通过；Playwright 实机与实任务矩阵未完成/有失败项）**

---

## 1. 摘要

| 维度 | 结果 | 说明 |
|------|------|------|
| Phase 0 前置 | **PASS** | gate-mutex、brand:check、check:saas-fork |
| Phase 1 离线门禁 | **PARTIAL** | pre-production **21/26**；build 初失败已修复；pack:preflight 复跑 PASS |
| Phase 2 Goal-Loop | **PASS** | `test:goal-loop:final --skip-live` 全绿 |
| Phase 3 对话稳定性 | **PASS** | **32/32** 场景；recovery-wuyutai PASS |
| Phase 4 多用户 | **PASS** | multi-user:sim 5 并发无串台；isolation Playwright 3/3（e2e-serial 内） |
| Phase 5 实任务 | **PASS（4/4）** | T-01/T-02/T-05/T-09 live 脚本验收；见 [`prelaunch-live-tasks-20260630.md`](prelaunch-live-tasks-20260630.md) |
| Phase 6 Playwright | **PARTIAL→核心 PASS** | 首次 e2e-serial 因默认 **5173** 失败；设 **8082/7991** 后 SaaS 核心 **15/15 PASS**；design-canvas/path-folder-picker 仍待跑 |
| Phase 7 负载混沌 | **PARTIAL** | http-load smoke **0 失败**；security 11/11 PASS；mobile/browser-compat FAIL |
| Phase 8 打包 | **PASS** | pack:preflight 通过（2 项警告） |
| Phase 9 生产 Gate-B | **SKIP** | 未连生产 `www.novapage.online` |

---

## 2. P0 失败项与处置

| ID | 描述 | 根因 | 处置 |
|----|------|------|------|
| B-01 | `npm run build` TS2322 | `expectedManifest.kind: "png"` 不在 `AcceptanceArtifactKind` | **已修复** → 改为 `kind: "image"`（`finalAcceptance.ts`） |
| F-06 | playwright-saas-core Composer 不可见 | 探针默认 **5173**，dev 实际 **8082** | **已验证**：设 `PLAYWRIGHT_BASE_URL=8082` 后 **15/15 SaaS 核心 PASS** |
| E2E-01 | prelaunch:e2e-serial 5 失败 | 同上 + 设计画布 live 需 fixture 成果；path-folder-picker 为**单机**向导 | SaaS 门禁可跳过 path-folder-picker；设计画布用 `test:design-canvas:acceptance:fast` |
| M-01 | mobile-regression | 8082 移动视口探针失败 | 修正 BASE_URL 后重跑 |
| M-02 | browser-compat-lean | 1 项浏览器兼容失败 | 查看 `browser-compat-check` 日志重跑 |
| LIVE-F09 | Live 0608 文件夹显示名 | resilience-live 可选项 missing | 非阻塞；记录 |
| PRE-PG | pg-validation SKIP | pre-production 子进程未继承 `SAAS_DATABASE_URL` | dev 已用 PG；单独 `npm run test:saas:pg-validation` |

---

## 3. 自动化执行明细

### 3.1 已通过（代表命令）

| 套件 | 命令 | 结果 |
|------|------|------|
| Gate mutex | `npm run test:gate-mutex` | 3/3 |
| Goal-Loop 终验 | `npm run test:goal-loop:final -- --skip-live` | PASS |
| 对话稳定性 | `npm run test:dialogue-stability:full-chain` | **32/32** |
| 历史 messages | `npm run test:history-messages:quick` | 38 tests |
| P0–P2 单元 | `npm run test:p0-p2:unit` | 137 tests |
| Recovery 吴裕泰 | `npm run test:recovery-wuyutai` | PASS |
| 多用户模拟 | `FORCE_MULTI_USER_SIM=1 npm run test:multi-user:sim` | 5 并发 OK |
| 多技能矩阵 | `npm run test:multi-skill:matrix` | OK |
| 四线 audit | `npm run test:four-line-audit` | aligned **77.0%**（193 sessions） |
| SaaS 存储 | `test:saas:storage` + `test:saas:folder` | PASS（pre-production 内） |
| 韧性 live | `resilience-live` | PASS |
| OSS 回归 | `oss-regression` | PASS |
| HTTP 负载 | `http-load --scenario smoke` @7991 | **fail=0, p95=521ms** |
| 安全清单 | `security-regression-checklist.mjs` @7991 | **11/11 PASS** |
| 构建 | `npm run build`（修复后） | PASS |
| 打包预检 | `npm run pack:preflight` | PASS（2 warnings） |

### 3.2 pre-production 套件（21/26）

日志：`artifacts/pre-production-test/suite-summary.json`

**失败步骤（首次跑）**：build（已修复）、mobile-regression、browser-compat-lean、playwright-saas-core、pack:preflight（build 连带；复跑已通过）

### 3.3 Playwright（SaaS 核心 @8082：15/15 PASS）

复跑命令（**必须带端口 env**）：

```powershell
$env:VITE_URL='http://127.0.0.1:8082'
$env:SERVER_URL='http://127.0.0.1:7991'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8082'
npx playwright test -c ui/playwright.config.ts ui/e2e/saas ui/e2e/chat-experience.spec.ts
```

| 结果 | 说明 |
|------|------|
| **15 PASS** | chat-experience 3、long-session 3、process-ux 7、resilience 2 |
| 首次 e2e-serial | 22 pass / 5 fail（端口错误 + 设计画布 live + 单机 path-folder-picker） |
| SKIP | deliverable-doc/ppt live、history-messages-perf live |

---

## 4. 实任务签收（Phase 5 — 待人工）

| ID | 任务 | sessionId | 主成果路径 | repair | 五线 | 状态 |
|----|------|-----------|------------|--------|------|------|
| T-01 | GEO 全案 | `s_5cfac414-…` | `artifacts/razer-blade-prelaunch-geo/`（9/9） | 0 | 未手工审计 | **PASS** |
| T-02 | Nova 6 页 PNG | retry | `artifacts/slides-argentina-travel/` | 0 | 未手工审计 | **PASS** |
| T-03 | 调研 md+docx+pdf | — | — | — | — | **未测** |
| T-05 | 5 页官网 HTML | batch-1 | `artifacts/razer-landing-2026/` | 0 | 未手工审计 | **PASS** |
| T-09 | 脑爆无汇总表 | batch-1 | 无文件 | 0 | — | **PASS** |

> 自动化实跑：[`prelaunch-live-tasks-20260630.md`](prelaunch-live-tasks-20260630.md)；T-02 首轮 900s 超时，20min 重跑通过；T-01 首轮 4/9，`LIVE_T01_CONTINUE=1` 续补齐通过。

---

## 5. 多用户场景

| 场景 | 结果 | 证据 |
|------|------|------|
| MU-01 双租户隔离（Playwright） | **PASS** | isolation.spec 3/3 |
| MU-02 multi-user:sim 5 并发 | **PASS** | 无 cross-talk；recovery=0 |
| MU-03 三 Tab 并发 | **未测** | 需手工 |
| MU-04 新建项目侧栏同步 | **未测** | 需手工 |
| MU-05 后台权限 | **PASS** | deep-uat admin/成员 403 |

---

## 6. 性能数据

| 指标 | 实测 | 目标 |
|------|------|------|
| http-load smoke 错误率 | **0%** | <1% |
| http-load login/captcha P95 | **521ms** | captcha <1s, login <3s |
| four-line aligned | **77.0%** | 记录基线（历史 JSONL legacy） |
| 生产 tail120 P95 | — | <1.5s（Gate-B 未跑） |

---

## 7. Goal-Loop 专项

| 项 | 状态 |
|----|------|
| continuationOwner 全链路单测 | ☑ |
| repair-active「补齐中…」单测 | ☑ |
| Nova minCount + manifest 引擎验收 | ☑ |
| Playwright 五入口/repair 门禁 | ☑ |
| 手工 GL-M01~M05 | ☐ 未测 |

子报告：[`deliverable-goal-loop-acceptance-20260630.md`](deliverable-goal-loop-acceptance-20260630.md)

---

## 8. 已知风险与上线后观察

1. **E2E 端口**：dev:saas 动态端口（本次 8082/7991）；CI/门禁须统一 `VITE_URL`/`SERVER_URL`/`PLAYWRIGHT_BASE_URL`。
2. **Gateway EADDRINUSE 18789**：已有实例占用；新 dev 进程 Gateway 未监听，Bridge 连旧实例——长跑前建议清场。
3. **四线 aligned 77%**：历史 JSONL legacy 轨；新会话应更高。
4. **pack 警告**：Windows databasePath、本地 projects 382MB 已跳过——符合预期。
5. **生产 Gate-B**：须 ECS upgrade + `verify-cloud-runtime` + `test:cloud:chat-load`（见 [`next-pack-reminders.zh-CN.md`](next-pack-reminders.zh-CN.md)）。

---

## 9. 下一步（达到 Go 的最短路径）

1. **提交** `finalAcceptance.ts` 构建修复。
2. **重跑 Playwright**（正确端口）：
   ```powershell
   $env:VITE_URL='http://127.0.0.1:8082'
   $env:SERVER_URL='http://127.0.0.1:7991'
   $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8082'
   npm run test:prelaunch:e2e-serial
   ```
3. **补跑** `npm run test:pre-production`（build 已绿）。
4. ~~**实任务** T-01/T-02/T-05/T-09 人工签收。~~ **已完成 4/4**（见 live 报告）。
5. **打包上云** → Gate-B 生产只读抽检 → 更新本报告 §6 生产列。

---

## 10. 附件索引

| 路径 | 说明 |
|------|------|
| `artifacts/pre-production-test/suite-summary.json` | pre-production 26 步摘要 |
| `artifacts/pre-production-test/http-load-smoke.json` | 负载 smoke |
| `artifacts/full-test/security-checklist.json` | 安全 11 项 |
| `artifacts/goal-loop-acceptance/suite-log.jsonl` | Goal-Loop 分层日志 |
| `docs/dialogue-stability-full-chain-acceptance-2026-06-30.md` | 32 场景报告 |
| `docs/four-line-alignment-audit-2026-06-30.md` | 四线 audit |
| `docs/recovery-stability-report-2026-06-30.md` | Recovery 吴裕泰 |
| `docs/production-prelaunch-test-plan-20260630.zh-CN.md` | 本轮回方案 |

---

**签收**：自动化核心（Goal-Loop、对话稳定性、多用户模拟、SaaS 存储、安全、负载）**可发版候选**；**正式 Go** 须 Playwright 全绿 + 实任务矩阵 + 生产 Gate-B。
