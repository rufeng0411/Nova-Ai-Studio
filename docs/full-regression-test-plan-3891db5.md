# 全量回归测试计划 — 上游 `3891db5` 合并后

**基准**：`main` @ `bbd4ffa`  
**还原点**：`pre-pd-merge-3891db5` @ `4081905`  
**报告**：[`full-regression-test-report-3891db5.md`](full-regression-test-report-3891db5.md)  
**合并 QA**：[`merge-qa-report-3891db5.md`](merge-qa-report-3891db5.md)

---

## 一、本次合并范围

### A. 上游 B1–B4（`7ec1f25..3891db5`）

proxy 顶层化、read_file、web_search 提示、telemetry、Always-On、MCP 截图、记忆 #183、权限/plan #195/#196/#203/#204、WS ping #201、plan-todo 软提醒等。

### B. 本地阶段 A（保留）

`5858343` 隔离/记忆/能力 v2；`c67b1bd` PG 控制面、Nova-1、文档/OCR 工具。

---

## 二、环境

| 栈 | 命令 |
|----|------|
| 单机 | `SERVER_PORT=3001` `VITE_PORT=5173` `PILOTDECK_GATEWAY_PORT=18789` → `npm --workspace ui run dev:concurrent` |
| SaaS SQLite | `npm run dev:saas` |
| SaaS PG（可选） | `SAAS_DATABASE_URL=postgresql://...` + `dev:saas` |

---

## 三、自动化分层

| 层级 | 命令 |
|------|------|
| L0 | build / npm test / check:saas-fork / brand:check |
| L1 | tool-failure-recovery 单测 / useAutoRecoveryContinue / userFacingErrors |
| L2 | smoke:templates/docx/aigeo/social-matrix/capabilities/capability-hub/document/marketing-install |
| L3 | integration-media-smoke / open-design-smoke（18789） |
| L4 | check-white-screen / ui-regression / artifact-preview / yixiaoer |
| L5 | test:ui:unit（基线） |
| L6 | test:saas:* / smoke:saas-isolation / smoke:project-memory / pg-validation |

---

## 四、角色矩阵

- **单机 OSS-***：对话、容错、能力中心、设置、proxy、plan、WS、品牌、文档 OCR  
- **SaaS 管理员 ADM-***：平台配置、运营、计费、隔离、PG  
- **SaaS 普通用户 MEM-***：注册、两租户隔离、配额、设置收敛、plan UI  

---

## 五、针对性全链路 T-*

T-proxy、T-readfile、T-websearch、T-telemetry、T-ws、T-plan、T-memory、T-pg、T-saas-proxy、T-bridge、T-doc 等（见 Phase 8 计划 §9.7）。

---

## 六、通过门槛

- **发布**：L0–L2 全绿 + S1–S7 + 阻塞 T-* 全绿 + P1/P2/P4（需 dev 端口可用）  
- **有条件**：OD 超时、L5 历史失败、vitest 环境缺依赖、Playwright 端口冲突  
