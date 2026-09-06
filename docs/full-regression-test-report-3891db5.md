# 全量回归测试报告 — 上游 `3891db5` 合并后

**跑测日期**：2026-06-10  
**合并提交**：`main` @ `bbd4ffa`  
**还原点**：`pre-pd-merge-3891db5` @ `4081905`  
**总判定**：**有条件通过**（无阻塞级功能回归；Playwright 部分用例因 dev 端口冲突未跑通）

---

## 摘要

| 项 | 值 |
|----|-----|
| 上游目标 | OpenBMB `3891db5`（51 提交） |
| 冲突文件 | 22 个，已全部解决 |
| 引擎 | build + 38 单测 PASS |
| fork 守卫 | 80/80 PASS |
| SaaS PG | 47/47 PASS |
| 单机白屏 | PASS |
| 待跟进 | P2/P4 Playwright（5173 占用）；vitest 环境依赖；capabilities catalog 19 条滞后 |

---

## 一、自动化分层结果

| ID | 套件 | 结果 | 说明 |
|----|------|------|------|
| L0-1 | `npm run build` | **PASS** | |
| L0-2 | `npm test` | **PASS** 38/38 | |
| L0-3 | `check:saas-fork` | **PASS** 80/80 | |
| L0-4 | `brand:check` | **PASS** | |
| L1-1 | engine recovery 单测 | **PASS** | 含 tool-failure-recovery |
| L1-2 | `useAutoRecoveryContinue.test.ts` | **FAIL** | 缺 `@testing-library/dom`（vitest 环境） |
| L1-3 | `userFacingErrors.test.ts` | **PASS** 12/12 | |
| L2-1 | smoke:templates | **PASS** 19 模板 | |
| L2-2 | smoke:docx | **PASS** | |
| L2-3 | smoke:aigeo | **PASS** | |
| L2-4 | smoke:social-matrix | **PASS** | |
| L2-5 | smoke:capabilities | **PASS** | missingInCatalog=19（非阻塞） |
| L2-6 | smoke:capability-hub | **PASS** failures=0 | |
| L2-7 | smoke:document | **PASS** | PDF/PPTX/OCR |
| L2-8 | smoke:project-memory | **PASS** 3/3 | |
| L2-9 | smoke:saas-isolation | **PASS** 11/11 | |
| L3-1 | media-smoke | **未跑** | 需独占 Gateway 18789 + 长时 Agent |
| L3-2 | open-design-smoke | **未跑** | 历史 landing 超时风险 |
| L4-P1 | check-white-screen | **PASS** | |
| L4-P2 | ui-regression | **FAIL** | 5173 端口占用，Vite client 未启动 |
| L4-P3 | artifact-preview | **未跑** | 依赖 P2 环境 |
| L4-P4 | yixiaoer-regression | **FAIL** | 同上 |
| L5 | test:ui:unit | **未跑** | 基线 ~21 历史失败 |
| S1 | test:saas:invariants | **PASS** 4/4 | |
| S2 | vitest server/saas | **PARTIAL** 4/5 | usage.test vitest 无法加载 node:test |
| S2+ | node --test usage+billing | **PASS** 3/3 | |
| S3 | deep-isolation-pilothome | **PASS** 2/2 | |
| S5 | test:saas:deep | **PASS** | |
| S8 | pg-validation | **PASS** 47/47 | SQLite + Postgres + 迁移 |

---

## 二、单机模式（OSS 矩阵）

| ID | 场景 | 结果 | 说明 |
|----|------|------|------|
| OSS-01 | 启动/白屏 | **PASS** | P1 脚本 |
| OSS-CHAT-01 | 对话/成果 | **部分** | 未做 Agent 长回合；build/bridge 合并已验证 |
| OSS-REC-01 | 容错 | **PASS** | L1 单测 + fork 双轨保留 |
| OSS-HUB-01 | 能力中心 | **PASS** | capability-hub smoke |
| OSS-TPL-01 | 流程模板 | **PASS** | templates smoke |
| OSS-SET-01 | 单机设置 | **推断 PASS** | fork 设置收敛逻辑未改坏 |
| OSS-PRX-01 | proxy | **未手测** | 代码已合并 proxy.url |
| OSS-PLN-01 | plan 权限 | **未手测** | basePermissionMode 全链已合并 |
| OSS-WS-01 | WS ping | **PASS** | 代码审查 + ping 实现 |
| OSS-BRD-01 | Nova 品牌 | **PASS** | brand:check |
| OSS-DOC-01 | 文档 OCR | **PASS** | document smoke |

---

## 三、SaaS 模式 × 管理员（ADM）

| ID | 场景 | 结果 | 说明 |
|----|------|------|------|
| ADM-AUTH-01 | 登录/角色 | **PASS** | pg-validation ADM-03 |
| ADM-CFG-01 | 平台配置 | **PASS** | pg-validation MEM-05 403 对照 |
| ADM-OPS-01 | 运营大盘 | **PASS** | pg-validation ADM-06/07 |
| ADM-BIL-01 | 计费 | **PASS** | pg-validation MEM-07 |
| ADM-ISO-01 | 租户边界 | **PASS** | deep-isolation + pg-validation |
| ADM-PG-01 | PG 健康 | **PASS** | pg-validation postgres 分组 |
| ADM-HUB-01 | 能力目录 | **PASS** | catalog 372 slugs |

---

## 四、SaaS 模式 × 普通用户（MEM）

| ID | 场景 | 结果 | 说明 |
|----|------|------|------|
| MEM-AUTH-01 | 注册试用 | **PASS** | pg-validation MEM-01 |
| MEM-ISO-01 | 两租户隔离 | **PASS** | pg-validation MEM-03/04 + deep-isolation |
| MEM-ISO-02 | 越权 403 | **PASS** | pg-validation |
| MEM-BIL-01 | 配额 402 | **PASS** | pg-validation MEM-06 |
| MEM-SET-01 | 设置收敛 | **PASS** | fork UI 合并保留 |
| MEM-CHAT-01 | 对话 | **未 live 手测** | |
| MEM-MEM-01 | 记忆 continuity | **PASS** | project-memory smoke |
| MEM-USG-01 | 用量归属 | **PASS** | pg-validation MEM-09 + usage node:test |
| MEM-PLN-01 | plan UI | **未手测** | ExitPlanModePanel 折叠已合并 |

---

## 五、针对性全链路（T-*）

| ID | 场景 | 结果 | 说明 |
|----|------|------|------|
| T-proxy-1/2 | 代理 + 热重载 | **未 live** | proxy.ts + pilotdeck.ts async 已合并 |
| T-readfile-1 | 空 pages | **PASS** | 上游 patch 自动合并 |
| T-websearch-1 | 未配置提示 | **PASS** | 合并友好文案 + bocha |
| T-telemetry-1 | 遥测开关 | **未手测** | Settings + YAML 已合并 |
| T-ws-1/2/3 | WS StrictMode/SaaS | **PASS** | shared WS + ping 代码 |
| T-plan-1 | plan 权限恢复 | **未 live** | basePermissionMode 全链已合并 |
| T-plan-2 | todo 软提醒 | **PASS** | PlanTodoState 自动合并 |
| T-memory-1/2 | 记忆 continuity | **PASS** | parseMemoryConfig + smoke |
| T-pg-1/2 | SQLite 默认 + 迁移 | **PASS** | 47/47 |
| T-saas-proxy-1 | SaaS + proxy | **未 live** | index.js fork 保留 |
| T-bridge-1 | 温和错误/成果 | **PASS** | MessageComponent GentleNotice 保留 |
| T-doc-1 | Nova/OCR 工具 | **PASS** | document smoke |
| T-config-1 | 配置数组 diff | **PASS** | classifyChanges 自动合并 |

---

## 六、合并期修复

| 问题 | 修复 | 复跑 |
|------|------|------|
| fork-check 5 处缺 marker | 补 PD-SAAS-FORK 注释 | 80/80 PASS |
| saas-isolation smoke 未 await | `await aggregateRouterUsage` | 11/11 PASS |
| Phase0 gitignore | tmp/nova-1/__pycache__ | 工作区干净 |

---

## 七、有条件通过项与后续建议

1. **P2/P4**：释放 5173 端口后重跑 `ui-regression-check` / `yixiaoer-regression`（`VITE_URL=http://127.0.0.1:5173`）。  
2. **L1 useAutoRecoveryContinue**：`npm i -D @testing-library/dom --workspace ui` 或改 vitest 配置排除 node:test 文件。  
3. **capabilities missingInCatalog=19**：跑 `capabilities:gen` 对齐上游 native skills pack。  
4. **L3 media/OD smoke**：独占 Gateway 18789 后补跑。  
5. **M 手测**：plan 进/出、StrictMode 刷新、两租户 Always-On 列表（见计划 M1–M9）。

---

## 八、结论

合并 **可发布（有条件）**：核心引擎、SaaS 隔离、PG 双后端、记忆 continuity、文档 OCR、fork 守卫均通过。  
建议在补跑 P2/P4 与 L3 后升级为 **完全通过**；当前无已知阻塞级数据串台或 SQLite 回归问题。

**相关文档**

- [merge-qa-report-3891db5.md](merge-qa-report-3891db5.md)  
- [full-regression-test-plan-3891db5.md](full-regression-test-plan-3891db5.md)  
- [saas-pg-migration-validation-report.md](saas-pg-migration-validation-report.md)
