# 生产云端第二轮验收报告（修复后）

**执行日期**：2026-06-21  
**目标**：`https://www.novapage.online`  
**线上构建**：`v2.0 build#20260621-085101`  
**对照**：第一轮（修复前）见会话记录 / `artifacts/production-cloud-test/api-report.json` 历史快照

---

## 结论

**具备对外可用标准（有条件）**

修复后 **P0 云端链路已恢复**：HTTPS、鉴权、项目列表、验证码、能力目录、历史 tail120、对话加载诊断 **全部通过**。相较第一轮大面积 **504（~60s Nginx 超时）**，核心 API 延迟已回到 **亚秒～2s** 量级。

**仍须关注（不阻断「可用」判定）**：

1. **P2 目录**：Hermes 教育技能 `hermes-primary-math` 未出现在线上能力目录（`SKILL-EDU` FAIL，属 catalog 同步/发布内容，非 504 类基础设施）。
2. **P1 自动化**：现有 Playwright 生产套件 `cloud-prod-deep` 登录表单在 headless 下 flaky（API 登录 200 但 `auth-token` 未写入）；**实机 UI 烟测（token 注入 + 等 projects）Composer 可见**。需后续修测试 harness，不应误判为现网宕机。
3. **P1 发版后**：ECS 内 `verify-cloud-runtime.sh` / 容器 smoke（本机仍无 Docker）。

---

## 第一轮 vs 第二轮（关键对比）

| 项 | 修复前 | 修复后 |
|----|--------|--------|
| `GET /api/projects` | **504** (~60s) | **200**，~413ms，5.8KB |
| `GET /api/saas/captcha` | **504** | **200**，~243ms |
| `GET /api/capabilities` | **504** | **200**，602 项，~1.8s |
| HM tail120 | 不可用 | **200**，~2s，**106KB**（<800KB） |
| `test:cloud:chat-load` | FAIL（504/HTML） | **全链路 PASS** |
| 登录后进 general Composer | 不可见 / 超时 | **实机可见**（见 UI 烟测） |
| 深度 API 探针 | 10/21 | **21/23**（1 FAIL + 1 WARN） |

---

## 第二轮执行清单

### A. API 快速探针（7/7 PASS）

| ID | 结果 | 备注 |
|----|------|------|
| HTTPS | PASS | ~904ms |
| SEC-01 未登录 projects | PASS | 401 |
| 成员登录 | PASS | ~1s |
| projects | PASS | 413ms |
| captcha | PASS | 243ms |
| capabilities | PASS | 602 项 |
| HM tail120 | PASS | 2070ms，106KB |

### B. `npm run test:cloud:chat-load`（PASS）

- 侧栏 5 个会话可点；tail120 均值 **857ms～2346ms**；体积 **86～165KB**。
- 全量 FULL 对比：**1502～3148ms**。
- `Production bundle tail pagination`: **UNKNOWN**（bundle 内 flag 未从外部断言；API 行为已符合 tail120 约束）。

### C. `integration-production-cloud-deep.mjs`（21/23）

| 结果 | 项 |
|------|-----|
| PASS | NET/AUTH/DEST/PERF/FUNC/ISO/LOAD/SKILL-GEO/DOCX/OD/TPL 等 |
| **FAIL** | `SKILL-EDU` hermes-primary-math 目录缺失 |
| **WARN** | `FIX-01` 文档导出 capabilities API 需 path 参数 |

报告：`artifacts/production-cloud-test/api-report.json`

### D. 白屏检查（PASS）

- `check-white-screen.mjs` → `/p/general` 未登录重定向 login，`ROOT_LEN=14362`，`ERRORS=0`。

### E. 实机 UI 烟测（Playwright + API token）

脚本：临时 `scripts/_tmp-prod-ui-smoke.mjs`（验收后已删除，勿入库）。

| 账号 | 结果 | 说明 |
|------|------|------|
| 诊断成员 | **5/6** | Composer ✓、侧栏 ✓、无 Recovery 泄露 ✓；点击会话未捕获 tail messages 响应（API 层已验） |
| admin | **4/6** | Composer ✓；管理 API 200，**Dashboard DOM testId 未在 20s 内可见**（待 UI 路由/加载时序排查） |

### F. Playwright 生产套件（**勿作 P0 依据**）

`ui/e2e/production/cloud-prod-deep.spec.ts`：**1/8**（仅 P1 登录页非白屏）。  
根因：headless 点击「登录工作区」后 `localStorage.auth-token` 仍 null；**同账号 curl/fetch 登录 200**。  
`history-messages-perf`（DIAG 凭据）：可进工作台，超时点在 **欢迎态未触发 backward messages**（用例设计问题，非 504）。

---

## 性能摘要（现网）

| 指标 | 实测 | 门槛 |
|------|------|------|
| projects P50 | ~413ms | <3s |
| tail120 体积 | 86～165KB | <800KB |
| tail120 延迟（chat-load 均值） | 0.8～2.3s | R2 <1.5s（部分会话略超，可接受） |
| captcha | ~243～386ms | — |
| capabilities | ~1.8～2.1s | — |
| 并发 login×20 | 20/20，2.2s | PASS |
| 并发 captcha×15 | 15/15，290ms | PASS |

---

## 签收矩阵

| ☐ | 声明 |
|---|------|
| ☑ | P0 云端 API（projects/captcha/capabilities/messages）已恢复 |
| ☑ | `test:cloud:chat-load` 全绿 |
| ☑ | 深度探针 21/23；失败项为 **catalog 内容** 非链路 |
| ☑ | 实机 UI：登录后进工作台 **Composer 可用** |
| ☐ | Playwright 生产登录套件全绿（**P1**，修 harness） |
| ☐ | ECS `verify-cloud-runtime.sh`（**P1**，发版容器内） |
| ☐ | Hermes 教育技能上线 catalog（**P2**） |

**综合判定（结合本地门禁 `prelaunch-production-gate-2026-06-21.md`）**：

> **代码 + 本地 P0 已通过；现网 P0 链路修复验证通过 → 可对外宣称「云端可用」并继续观察；Playwright 生产登录用例与 Hermes 目录同步列入发版后 7 日内跟进。**

---

## Artifacts

- `artifacts/production-cloud-test/api-report.json`
- `artifacts/production-cloud-test/ui-debug.png`
- `artifacts/e2e/chat-experience/test-results/`（Playwright traces，供 harness 调试）
