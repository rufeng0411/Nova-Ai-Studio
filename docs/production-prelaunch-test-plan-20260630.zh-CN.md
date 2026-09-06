# Nova Ai-Studio 生产上线前深度测试方案

> **版本**：2026-06-30（含 Goal-Loop 交付闭环终验）  
> **适用对象**：发版前 QA / Agent 自主验收 / 运维 Gate-B  
> **权威对照**：[`prelaunch-production-gate-checklist.zh-CN.md`](prelaunch-production-gate-checklist.zh-CN.md)（逐项打勾）  
> **及格线**：全部 **P0** 通过；P1 失败 ≤3 且须豁免单；否则 **不具备上线能力**

---

## 1. 目标与范围

### 1.1 测试目标

| 维度 | 说明 |
|------|------|
| **功能正确** | 对话、能力中心、成果五线、导出、后台管理端到端可用 |
| **交付闭环** | Goal Contract → 引擎验收 → repair → 终端 UI 单链，无第四轨 UI 误续跑 |
| **多租户隔离** | 租户/用户/项目/成果路径不串台 |
| **稳定性** | Recovery 双轨、长任务自动续跑、Gateway/WS 断连可恢复 |
| **性能** | 重会话 tail120 P95 <1.5s、payload <500KB（R2 配置） |
| **安全** | 鉴权、路径穿越、跨租户访问、默认关遥测 |

### 1.2 不在本轮范围（另开专项）

- 全量 `test:saas:acceptance`（1h+，留 nightly / 发版后）
- IM 通道（飞书/微信）私有化专项
- 项 4/5/9/10 待命开发（见 `post-gate-dev-plan-4-5-9-10.zh-CN.md`）

### 1.3 环境矩阵

| 环境 | 用途 | 必测阶段 |
|------|------|----------|
| **本地 dev:saas** | 主战场；全自动化 + 手工实任务 | Phase 0–7 |
| **Docker 本地镜像** | 与生产同 Dockerfile | Phase 7 CH-06 |
| **预发 / ECS 新包** | upgrade.sh 后 | Phase 8 |
| **生产 www.novapage.online** | Gate-B 只读抽检 | Phase 9 |

**Flag 轮次（历史加速，每轮重启 dev:saas）**

| 轮次 | SANITIZE | TAIL_READ | CACHE | 说明 |
|------|----------|-----------|-------|------|
| R1 | 1 | 0 | 0 | 基线截断 |
| R2 | 1 | 1 | 0 | 真尾读（生产默认） |
| R3 | 1 | 1 | 1 | Redis 缓存（观察后开） |

---

## 2. 执行总览（建议 3 天）

```mermaid
flowchart LR
  P0[Phase0 前置] --> P1[Phase1 离线门禁]
  P1 --> P2[Phase2 Goal-Loop]
  P2 --> P3[Phase3 对话稳定性]
  P3 --> P4[Phase4 多用户]
  P4 --> P5[Phase5 实任务矩阵]
  P5 --> P6[Phase6 Playwright]
  P6 --> P7[Phase7 负载混沌]
  P7 --> P8[Phase8 打包上云]
  P8 --> P9[Phase9 生产抽检]
  P9 --> RPT[输出测试报告]
```

| 天 | 阶段 | 预估耗时 | 产出 |
|----|------|----------|------|
| D-3 | Phase 0–2 | 4–6h | 离线绿 + Goal-Loop 报告 |
| D-2 | Phase 3–6 | 6–8h | 稳定性报告 + E2E 日志 |
| D-1 | Phase 5 实任务 + Phase 7 | 8h+ | 实任务签收表 + 负载数据 |
| D0 | Phase 8–9 | 2–4h | Gate-B 报告 + **总报告** |

---

## 3. Phase 0 — 前置（P0）

| ID | 操作 | 命令 / 步骤 | 通过标准 |
|----|------|-------------|----------|
| PRE-01 | 工作区干净 | `git status` | 无未提交核心代码；记录 **Git HEAD** |
| PRE-02 | 基础设施 | `npm run dev:infra` | Redis 绿；设 `SAAS_DATABASE_URL` 则 PG 绿 |
| PRE-03 | 开发栈 | `npm run dev` | 5173 / 3001 / 18789 可访问，无白屏 |
| PRE-04 | 登录 | admin / admin123 | 进入工作台（生产须已改密） |
| PRE-05 | Playwright | `npx playwright install chromium` | 安装成功 |
| PRE-06 | 互斥锁 | `npm run test:gate-mutex` | 3/3 pass |
| PRE-07 | 品牌 | `npm run brand:check` | exit 0 |
| PRE-08 | Fork 登记 | `npm run check:saas-fork` | 0 issue 或豁免已登记 |

**禁止**：长任务进行中用 Nova Launcher「重启」或 `restart-ui-dev` 杀 Gateway。

---

## 4. Phase 1 — 离线自动化门禁（P0，约 2h）

### 4.1 一键精益套件（主入口）

```bash
npm run test:pre-production
# 离线子集（无 live Playwright）：
npm run test:pre-production:offline
```

覆盖：build、termination-policy、display-engine-alignment、four-line-e2e、dialogue-stability:full-chain、saas:deep、storage、folder、capability-hub、conversation-catalog、pack:preflight 等。

**日志**：`artifacts/pre-production-test/suite-log.jsonl`、`suite-summary.json`

### 4.2 构建与合规

```bash
npm run build
npm run check:saas-fork
npm run brand:check
npm run capabilities:gen    # 发版前建议
npm run pack:preflight
```

### 4.3 历史 messages 加速（单元）

```bash
npm run test:history-messages:quick
node scripts/check-history-message-flags.mjs
```

### 4.4 P0–P2 任务驱动对话

```bash
npm run test:p0-p2:full
npm run analyze:task-completion -- --gate   # 可选 KPI 门禁
```

### 4.5 云端存储 CLOUD-01~12

```bash
npm run test:saas:storage
npm run test:saas:folder
```

| CLOUD | 断言摘要 |
|-------|----------|
| 01–02 | cloud-only、workspace 自动 provision |
| 03–05 | 文件树、单文件/ZIP 下载 |
| 06 | browse-filesystem → 403 |
| 07–08 | 新建项目、跨租户路径拒绝 |
| 09–10 | 租户隔离、多根 workspace |
| 11–12 | 缓存头、同租户跨 userId 拒绝 |

---

## 5. Phase 2 — Goal-Loop 交付闭环深度（P0，约 1.5h）

> **背景**：Goal Contract → 引擎验收 → repair → 终端 UI；禁止 UI 第四轨 auto-continue。

### 5.1 自动化终验

```bash
# 增量（离线为主）
npm run test:goal-loop:acceptance

# 全链路终验（含 prelaunch:quick + Playwright）
npm run test:goal-loop:final

# 跳过 live prelaunch（CI 友好）
npm run test:goal-loop:final -- --skip-live

# 第二遍复测（防 flaky）
npm run test:goal-loop:final -- --retest
```

**报告**：`docs/deliverable-goal-loop-acceptance-YYYYMMDD.md`（脚本自动生成）

### 5.2 专项单测矩阵

| 领域 | 命令 | 核心断言 |
|------|------|----------|
| Goal Contract | `npx vitest run src/saas/taskState/taskGoalContract.test.ts` | Nova minCount=8；GEO 全案 minCount=undefined |
| 引擎验收 | `npx tsx --test tests/agent/validate-deliverables-engine.test.ts` | Nova manifest+PNG 通过；HTML 替代 → needs_repair |
| continuationOwner | `npx vitest run ui/src/shared/turnAcceptanceMeta.test.ts` | 嵌套 meta 优先；repair vs none |
| Repair 预算 | `npx tsx --test tests/saas/resilience/recoveryBudget.test.ts` | acceptance_repair 保留末 4 槽 |
| 汇总表 UX | `npm --workspace ui run test -- src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx` | repair-active →「补齐中…」 |
| 消息渲染 | `npm --workspace ui run test -- src/components/chat-v2/MessagesPaneV2.render.test.tsx` | 底部唯一 deliverable-summary-table |
| 部分交付 | `npm run test:deliverable-partial:unit` | legacyPathMode + buildDeliverableSummaryRows |
| 四线 audit | `npm run test:four-line-audit` | gate 绿；aligned% 记录 |
| 五线对齐 | `npm run test:display-engine-alignment` | PASS |

### 5.3 Goal-Loop 手工探针（P0，每场景 1 次）

| ID | 场景 | 操作 | 通过标准 |
|----|------|------|----------|
| GL-M01 | Nova 6 页缺 3 页 | 能力中心「Nova-美学幻灯」→ 6 页；模拟仅 3 PNG + manifest | 汇总表 missing 显示「**补齐中…**」，非「需继续」；`continuationOwner=deliverable_repair` 时不叠 UI 重试 |
| GL-M02 | 交付完成后 | 同上任务补齐至 6 页 | 状态变「已交付」；五入口路径一致 |
| GL-M03 | 脑爆纯聊天 | 脑爆 Tab 随便聊 | **无**底部交付汇总表 |
| GL-M04 | 雷蛇 HTML 落地页 | 「做 5 页官网落地页」 | 底部汇总表 + 正文无自造路径清单 |
| GL-M05 | 历史 JSONL | 打开旧会话（无 continuationOwner） | legacy 轨正常；四线 audit 零 diff |

---

## 6. Phase 3 — 对话稳定性与 Recovery（P0，约 2–3h）

### 6.1 历史事故回归（16 场景）

```bash
npm run test:dialogue-stability:full-chain
# 或仅历史子集：
npm run test:dialogue-stability:historical
```

**报告**：`docs/dialogue-stability-full-chain-acceptance-YYYYMMDD.md`

### 6.2 Recovery 专项

```bash
npm run test:recovery-wuyutai
npm run smoke:resilience
npm run test:recovery:breakdown          # 可选深度
npm run test:task-resilience:acceptance  # 会话 durability + infra 续跑
```

### 6.3 长任务实跑（P0，需模型 Key，各 1 次）

| ID | 任务 | 命令 / 手工 | 通过标准 |
|----|------|-------------|----------|
| REC-L01 | 吴裕泰 PPT | `npm run test:recovery-wuyutai:run` | turn 收敛；有真 pptx 或 policy 通过 |
| REC-L02 | 北京 AI 报告 | `npm run test:recovery-beijing-ai-report:run` | artifacts 可扫；无永久「进行中」 |
| REC-L03 | Gateway 断连 | 任务进行中 `taskkill` Gateway | UI「开发服务连接中断，正在自动续跑」；恢复后自动续做 |
| REC-L04 | WS 闪断 | 断网 10s 恢复 | 弱提示；可继续发送 |
| REC-L05 | 用户无需打「继续」 | PPT 只规划未出文件 | 引擎自动续跑至产出或耗尽预算 |

### 6.4 过程 UX

```bash
npm run test:process-ux
npm run test:prelaunch:stability:offline   # 离线子集
```

断言：单点 Timeline、dock 常驻、非正式过程弱于正文、无英文 Recovery 气泡。

---

## 7. Phase 4 — 多用户与 SaaS 隔离（P0，约 3h）

### 7.1 自动化多用户

```bash
# 模拟多用户并发 turn（recovery ≤6/turn）
set FORCE_MULTI_USER_SIM=1
npm run test:multi-user:sim

npm run test:multi-skill:matrix
npm run smoke:saas-isolation
npm run test:saas:deep
npm run test:saas:pg-validation          # 需 SAAS_DATABASE_URL
npm run test:saas:conversation-catalog
```

### 7.2 Playwright 隔离套件

```bash
npx playwright test -c ui/playwright.config.ts ui/e2e/saas/isolation.spec.ts
```

| 用例 | 断言 |
|------|------|
| 双租户注册 | 各自 projects 独立 |
| 常驻跨租户 | 非 500 |
| /usage/me | 仅本人数据 |
| 成员 /usage/admin | 403 |

### 7.3 手工多用户场景（详细）

#### 场景 MU-A：双租户成果隔离

| 步骤 | 用户 A（tenant-a） | 用户 B（tenant-b） | 预期 |
|------|-------------------|-------------------|------|
| 1 | 注册/登录 `user_a` | 注册/登录 `user_b` | 各自进入工作台 |
| 2 | 新建项目「项目 Alpha」 | 新建项目「项目 Beta」 | 侧栏即时出现，无需 F5 |
| 3 | 对话交付 `artifacts/alpha/report.html` | 对话交付 `artifacts/beta/report.html` | 各自文件树可见 |
| 4 | B 尝试 API 读 A 的路径 | `GET .../file/resolve?path=artifacts/alpha/...` | **403/404** |
| 5 | A 刷新侧栏 | — | 仍只见 Alpha，无 Beta 串台 |

#### 场景 MU-B：同租户双用户

| 步骤 | 用户 A | 用户 B | 预期 |
|------|--------|--------|------|
| 1 | admin 创建成员 B | B 登录 | B 无模型池/后台入口 |
| 2 | A 建会话写成果 | B 开另一浏览器 | projects 列表按 role 过滤 |
| 3 | B 访问 A 的 sessionId | 改 URL / API | **403** |
| 4 | 同时各开 1 个 live turn | 15 min | 无 WS 全断、无 SessionStore 错乱 |

#### 场景 MU-C：三 Tab 并发读历史

| Tab | 行为 | 预期 |
|-----|------|------|
| Tab1 | 重会话（>120 条）上滚 fetchMore ×3 | cursor 连续、无重复 id |
| Tab2 | 同账号打开另一项目 | messages 带 limit=120 |
| Tab3 | 同项目 live 新消息 | Tab1/2 刷新后 tail 一致 |

#### 场景 MU-D：新建项目侧栏同步

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | SaaS 用户点「新建项目」 | 对话框仅填名称 |
| 2 | 创建成功 | **无感**出现在侧栏（乐观插入） |
| 3 | 另一 Tab 同账号 | `projects_updated` 后列表一致 |

#### 场景 MU-E：后台管理员

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | admin 进后台 | 左栏冻结；返回前端 / 退出在左下 |
| 2 | 普通用户访问 `/admin` | 403 或重定向 |
| 3 | admin 改租户用户密码/头像 | 前台生效 |

---

## 8. Phase 5 — 实任务矩阵（P0/P1，约 8h，需模型 Key）

> **原则**：每类至少 1 次 **端到端实跑**；记录 sessionId、成果路径、是否自动 repair、用户是否需介入。

### 8.1 任务清单（按能力大类）

| ID | 大类 | 实任务描述（可直接复制） | 必交付物 | 优先级 |
|----|------|--------------------------|----------|--------|
| T-01 | 营销飞轮 | 帮【某品牌】做 GEO 全案：关键词 + 3 平台成稿 + schema.jsonld + visibility-report.html | md/html/jsonld 多文件 | P0 |
| T-02 | 营销飞轮 | 用 Nova-美学幻灯做 6 页 16:9 配图 PNG，主题：阿根廷旅游 | slide-manifest.json + 6×PNG | P0 |
| T-03 | 办公 | 根据附件写一份 3000 字调研报告，输出 md + docx + pdf | 三格式齐全 | P0 |
| T-04 | 办公 | 做法务风险快评（流程模板 legal-risk-quick） | docx/md | P1 |
| T-05 | 创作 | 雷蛇风格 5 页官网落地页 HTML | index.html + 多页 | P0 |
| T-06 | 创作 | 视频分镜包 ad-storyboard-seedance（8 镜） | 三件套 + manifest | P1 |
| T-07 | 开发 | 读 skills 写一个小工具脚本并交付 README.md | md + 可运行产物 | P1 |
| T-08 | 教育 | Hermes 学段：初中物理趣味讲解提纲 | md | P1 |
| T-09 | 脑爆 | 脑爆 Tab：聊产品命名，**不要文件** | 无汇总表 | P0 |
| T-10 | 流程 | content-flywheel 模板完整跑一轮 | 多阶段 artifacts | P1 |

### 8.2 每个实任务必查项（签收表）

| 检查项 | 说明 |
|--------|------|
| □ 首段 ACK | 慢时仅「好的，请稍等」 |
| □ 过程 UX | 思考/工具步骤 muted、可折叠 |
| □ 成果五线 | 正文链接 = 汇总表 = 右栏 = 弹窗 = 前往文件夹 |
| □ validate | 无 phantom；broken 有 resolvedPath 可软展示 |
| □ Goal-Loop | 缺页时「补齐中…」；完成后 terminal |
| □ 无英文 Recovery | 气泡无 Failed tools / Several tools failed |
| □ 自动续跑 | 交付类未产出时无需用户打「继续」 |
| □ 文件 Tab | 全量文件可下载/预览 |

### 8.3 能力中心「试一下」

```bash
npm run smoke:capability-try-prompts
npm run smoke:skills-batch-ui    # 需 dev:saas
```

手工：从 **发现** 与 **输入框能力弹层** 各试 1 张卡片，确认预填不覆盖用户已输入文字。

---

## 9. Phase 6 — Playwright 与 UX E2E（P0，约 2h）

### 6.1 串行 E2E（防互斥）

```bash
npm run test:prelaunch:e2e-serial
```

### 6.2 核心套件（pre-production live 已含）

```bash
npx playwright test -c ui/playwright.config.ts \
  ui/e2e/chat-experience.spec.ts \
  ui/e2e/saas/resilience-recovery.spec.ts \
  ui/e2e/saas/isolation.spec.ts \
  ui/e2e/saas/deep-uat.spec.ts \
  ui/e2e/saas/long-session.spec.ts \
  ui/e2e/phase3/admin-dashboard.spec.ts \
  ui/e2e/prelaunch/deliverable-five-entry.spec.ts \
  ui/e2e/prelaunch/goal-loop-repair-terminal.spec.ts
```

### 6.3 白屏与 LAN

```bash
node scripts/check-white-screen.mjs "http://127.0.0.1:5173/p/general"
npm run test:saas:regression
node scripts/mobile-regression-check.mjs
node scripts/browser-compat-check.mjs --lean
```

---

## 10. Phase 7 — 负载、混沌与安全（P0，约 2–4h）

### 10.1 HTTP 负载

> **注意**：`SERVER_URL` 指向 Bridge **3001**（非 Vite 5173）

```bash
node scripts/load/http-load.mjs --scenario smoke
node scripts/load/http-load.mjs --scenario stress
node scripts/load/http-load.mjs --scenario spike
# P1 浸泡：
node scripts/load/http-load.mjs --scenario soak
```

| 场景 | 通过标准 |
|------|----------|
| smoke 30s c=10 | 错误率 <1%；captcha P95 <1s；login P95 <3s |
| stress 120s c=50 | 错误率 <2%；login P95 <5s |
| spike 60s c=100 | 无崩溃；错误率 <5% |

### 10.2 混沌（手工）

| ID | 操作 | 预期 |
|----|------|------|
| CH-01 | 杀 Gateway | disk fallback；messages 200 |
| CH-02 | 停 Redis | 登录可用；降级非雪崩 |
| CH-03 | 10× 切项目 refresh | 无 limit=null 全量 |
| CH-04 | corrupt jsonl 末行 | warning 不崩 |
| CH-05 | curl limit=999999 | 无 OOM |
| CH-06 | `node scripts/docker-smoke.mjs` | PASS |
| CH-08 | 连续重启 dev:saas ×3 | 仍可登录对话 |

### 10.3 安全回归

```bash
node scripts/security-regression-checklist.mjs
```

覆盖：未登录 401、JWT 篡改、无验证码注册 400、路径穿越、跨租户 session、XSS 标题、超大 POST。

### 10.4 内存（P1）

```bash
npm run test:memory-leak:audit
```

---

## 11. Phase 8 — 打包与上云（P0，D0）

见 [`next-pack-reminders.zh-CN.md`](next-pack-reminders.zh-CN.md)。

```bash
npm run pack:preflight
npm run pack:deploy
# 或 pack:deploy:upload
```

**ECS 上**：

```bash
sudo bash /opt/nova-ai-studio/upgrade.sh
sudo bash /opt/nova-ai-studio/verify-cloud-runtime.sh
sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh
# 性能 env 分阶段：
sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh
```

**必核**：容器内 `ui/dist/index.html` 哈希与 tar 一致；`nova-redis` 同 compose 网络；admin 改密。

---

## 12. Phase 9 — 生产 Gate-B 抽检（P0，只读）

```powershell
$env:PROD_BASE_URL='https://www.novapage.online'
$env:DIAG_USER='...'
$env:DIAG_PASS='...'
node scripts/check-white-screen.mjs https://www.novapage.online/p/general
npm run test:cloud:chat-load
```

| 指标 | 目标 |
|------|------|
| 白屏 | 无 |
| tail120 P95 | <1.5s |
| 响应体积 | <500KB（R2） |
| HTTPS | 443 正常 |

**禁止**：生产 stress/spike/混沌。

---

## 13. 测试报告规范（最终交付物）

### 13.1 报告文件

| 文件 | 生成方式 |
|------|----------|
| `docs/production-prelaunch-report-YYYYMMDD.md` | **主报告**（本方案签收） |
| `docs/deliverable-goal-loop-acceptance-YYYYMMDD.md` | `npm run test:goal-loop:final` |
| `docs/dialogue-stability-full-chain-acceptance-YYYYMMDD.md` | dialogue-stability 脚本 |
| `docs/pre-production-deep-test-report-YYYYMMDD.md` | 可选：pre-production 摘要 |
| `docs/prelaunch-gate-b-YYYYMMDD.md` | 生产抽检 |
| `artifacts/pre-production-test/suite-summary.json` | 机器可读 |
| `artifacts/goal-loop-acceptance/suite-log.jsonl` | Goal-Loop 分层日志 |

### 13.2 主报告模板（复制填写）

```markdown
# Nova Ai-Studio 生产上线测试报告

- **日期**：
- **Git HEAD**：
- **执行人**：
- **环境**：本地 dev:saas / ECS 版本 / 生产 Gate-B
- **历史加速轮次**：R1 / R2 / R3
- **最终结论**：☐ 具备上线能力　☐ 不具备

## 1. 摘要

| 维度 | 结果 | 说明 |
|------|------|------|
| Phase1 离线门禁 | PASS/FAIL | |
| Phase2 Goal-Loop | PASS/FAIL | |
| Phase3 对话稳定性 | PASS/FAIL | |
| Phase4 多用户 | PASS/FAIL | |
| Phase5 实任务 | n/m 通过 | |
| Phase6 Playwright | PASS/FAIL | |
| Phase7 负载混沌 | PASS/FAIL | |
| Phase8 上云 | PASS/FAIL/SKIP | |
| Phase9 生产抽检 | PASS/FAIL/SKIP | |

## 2. P0 失败项（须清零或豁免）

| ID | 描述 | 根因 | 修复/豁免 |
|----|------|------|-----------|

## 3. 实任务签收

| ID | 任务 | sessionId | 主成果路径 | repair 次数 | 五线 | 备注 |
|----|------|-----------|------------|-------------|------|------|

## 4. 多用户场景

| 场景 | 结果 | 证据 |
|------|------|------|
| MU-A 双租户隔离 | | |
| MU-B 同租户双用户 | | |
| MU-C 三 Tab 并发 | | |
| MU-D 新建项目同步 | | |
| MU-E 后台权限 | | |

## 5. 性能数据

| 指标 | R1 | R2 | R3 | 生产 Gate-B |
|------|----|----|-----|-------------|
| tail120 P50 (ms) | | | | |
| tail120 P95 (ms) | | | | |
| payload KB | | | | |
| smoke 错误率 | | | | |

## 6. Goal-Loop 专项

- continuationOwner 全链路：☐
- repair-active「补齐中…」：☐
- 脑爆无汇总表：☐
- Nova minCount + manifest：☐
- 四线 audit aligned%：

## 7. 已知风险与上线后观察

- catalog_rows=0 → backfill 脚本
- R3 CACHE 观察 24h 再全开
- …

## 8. 附件索引

- suite-summary.json
- goal-loop suite-log.jsonl
- four-line-alignment jsonl
```

### 13.3 一键生成报告骨架（可选）

```bash
# 跑完全部门禁后，由 Agent 汇总 artifacts/* 与 docs/* 自动生成主报告
node scripts/run-goal-loop-final-acceptance.mjs
npm run test:pre-production 2>&1 | tee artifacts/pre-production-test/console.log
```

---

## 14. 推荐执行命令（最小 P0 路径，约 4h 自动化 + 4h 手工）

```bash
# === 自动化（顺序执行）===
npm run test:gate-mutex
npm run test:goal-loop:final
npm run test:pre-production
npm run test:dialogue-stability:full-chain
npm run test:history-messages:quick
set FORCE_MULTI_USER_SIM=1 && npm run test:multi-user:sim
npm run test:prelaunch:e2e-serial

# === 手工（并行安排）===
# Phase5 实任务 T-01~T-05、T-09
# Phase4 MU-A~E
# Phase7 CH-01~03 混沌抽测

# === 打包前 ===
npm run pack:preflight && npm run pack:deploy

# === 上云后 ===
# verify-cloud-runtime + verify-cloud-perf + test:cloud:chat-load
```

---

## 15. 签收标准（Go / No-Go）

| 级别 | 条件 |
|------|------|
| **Go** | 全部 P0 Phase 0–7 绿；实任务 P0 项 ≥90% 通过；P1 失败 ≤3 且有豁免；Gate-B 无白屏、chat-load 达标 |
| **No-Go** | 任一 P0 自动化红；双租户可互读成果；Goal-Loop repair 显示「需继续」；生产 tail120 >10s 或 >1MB；admin 仍为默认密码 |

---

## 16. 参考文档

| 文档 | 用途 |
|------|------|
| [`prelaunch-production-gate-checklist.zh-CN.md`](prelaunch-production-gate-checklist.zh-CN.md) | 500+ 项打勾清单 |
| [`conversation-resilience-spec.md`](conversation-resilience-spec.md) | Recovery 双轨 + Goal-Loop repair 预算 |
| [`dialogue-stability-deliverable-governance-final-review-2026-06-22.md`](dialogue-stability-deliverable-governance-final-review-2026-06-22.md) | 五线治理终验 |
| [`history-messages-deploy-runbook.zh-CN.md`](history-messages-deploy-runbook.zh-CN.md) | 云端加速分期 |
| [`next-pack-reminders.zh-CN.md`](next-pack-reminders.zh-CN.md) | 打包后运维三项 |

---

**维护**：Goal-Loop 或 dialogue-stability 矩阵变更时，同步更新 Phase 2 / 5 与 [`run-goal-loop-final-acceptance.mjs`](../scripts/run-goal-loop-final-acceptance.mjs)。
