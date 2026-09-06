# 生产上线严苛测试 — 逐项打勾清单

> **主战场**：本地 `npm run dev`（dev:saas）  
> **及格线**：全部 **P0** 行打 ☑；P1 失败 ≤3 条且须豁免单；否则 **不具备上线能力**  
> **符号**：☐ 未测｜☑ 通过｜☒ 失败｜⏭ 跳过（须备注）

**签收信息**

| 字段 | 填写 |
|------|------|
| 执行日期 | |
| 执行人 | |
| Git HEAD | |
| Flag 轮次 | R1 / R2 / R3 |
| 最终结论 | ☐ 具备上线能力　☐ 不具备 |

---

## A0. 门禁互斥与串行 E2E（P0，Remediation 2026-06-22）

| ☐ | ID | 子项 | 操作 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | GM-01 | gateMutex 单测 | `npm run test:gate-mutex` | 3/3 pass |
| ☐ | GM-02 | 串行 Playwright | `npm run test:prelaunch:e2e-serial` | 0 fail |
| ☐ | GM-03 | E2E 与 spike 互斥 | spike 运行中再跑 e2e-serial | 拒绝或顺序 enforced |
| ☐ | GM-04 | 分阶段门禁 | `npm run test:production-gate-full:offline` | offline 绿 |

**约定**：`artifacts/pre-production-test/.gate-lock`；阶段 `offline → e2e → load`；**禁止** spike 与 Playwright 并行。

---

## A. 发版前置（P0）

| ☐ | ID | 子项 | 优先级 | 操作 | 通过标准 |
|---|-----|------|--------|------|----------|
| ☐ | PRE-01 | 工作区 WIP 已 commit | P0 | `git status` 干净或仅允许 artifacts | 历史加速+deploy runbook 已入库 |
| ☐ | PRE-02 | 还原点可回退 | P0 | `git show restore-point/pre-history-messages-accel-2026-06-20` | 标签存在 |
| ☐ | PRE-03 | dev:infra 就绪 | P0 | `npm run dev:infra` | Redis（+PG 若设 SAAS_DATABASE_URL）绿 |
| ☐ | PRE-04 | dev:saas 启动 | P0 | `npm run dev` | 5173/3001/18789 可访问，无白屏 |
| ☐ | PRE-05 | 登录 admin | P0 | admin / admin123 | 进入工作台 |
| ☐ | PRE-06 | Playwright 浏览器 | P0 | `npx playwright install chromium` | 安装成功 |
| ☐ | PRE-07 | 记录基线 commit | P0 | 写入本表「Git HEAD」 | 与 pack 版本一致 |

**Flag 环境（每轮测试前重启 dev:saas）**

| 轮次 | SANITIZE | TAIL_READ | CACHE | ☐ 已测 |
|------|----------|-----------|-------|--------|
| R1 | 1 | 0 | 0 | ☐ |
| R2 | 1 | 1 | 0 | ☐ |
| R3 | 1 | 1 | 1 | ☐ |

---

## B. 构建与合规（P0）

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | B-01 | TypeScript 构建 | `npm run build` | exit 0 |
| ☐ | B-02 | SaaS fork 标记 | `npm run check:saas-fork` | 0 issue（或豁免已登记） |
| ☐ | B-03 | Nova 品牌守卫 | `npm run brand:check` | exit 0 |
| ☐ | B-04 | capabilities 生成 | `npm run capabilities:gen` | exit 0（发版前建议） |

---

## C. 历史 messages 加速 — 单元/集成（P0）

### C.1 基线与 sanitize

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | C-01 | 生成 2MB fixture | `npm run test:history-messages:baseline` | exit 0 |
| ☐ | C-02 | fixture <500KB | ↑ 内含 | 红灯变绿 |
| ☐ | C-03 | 2MB sanitize | `historyMessageSanitize.test.ts` | <500KB |
| ☐ | C-04 | 12KB 边界截断 | ↑ | historyTruncated=true |
| ☐ | C-05 | writtenFilePath 保留 | ↑ | 路径不丢 |
| ☐ | C-06 | base64 图剔除 | ↑ | 无 toolResultImages |
| ☐ | C-07 | permission 不截断 | ↑ | 全量保留 |
| ☐ | C-08 | tool_use 路径保留+html截断 | ↑ | file_path 完整 |
| ☐ | C-09 | batch 顺序不变 | ↑ | 顺序一致 |
| ☐ | C-10 | flag env 开关 | `messagesRoute.sanitize.test.ts` | on/off 正确 |
| ☐ | C-11 | Gateway=disk sanitize 一致 | ↑ | deepEqual |
| ☐ | C-12 | collectDeliverables 截断后 | `collectDeliverables.test.ts` | 路径仍可收集 |

### C.2 尾读与分页

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | C-20 | countTranscriptLines | `TranscriptReader.tail.test.ts` | 行数正确 |
| ☐ | C-21 | tail entries 仅尾段 | ↑ | 末条 sequence 最大 |
| ☐ | C-22 | tail 与全量尾一致 | ↑ | sequence 数组相同 |
| ☐ | C-23 | slice backward 首页 | `readSessionMessages.pagination.test.ts` | 顺序+nextCursor |
| ☐ | C-24 | slice backward 第二页 | ↑ | 无重叠 |
| ☐ | C-25 | slice forward 兼容 | ↑ | offset 语义 |
| ☐ | C-26 | limit=null 全量 | ↑ | 条数=total |
| ☐ | C-27 | 空会话 | ↑ | 0 条 |
| ☐ | C-28 | 多 turn backward 分页 | ↑ | 3 页连续 |
| ☐ | C-29 | compact/tool 行保留 | ↑ | kinds 含 tool/compact |
| ☐ | C-30 | tail-read=全量 tail 一致 | ↑ | text 数组 deepEqual |
| ☐ | C-31 | tail perf 800 行 | `readSessionMessages.tailPerf.test.ts` | tail<30% full 时间 |
| ☐ | C-32 | structuredClone 一致 | `readSessionMessages.clone.test.ts` | flatten 相同 |

### C.3 Redis 缓存

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | C-40 | cache key 字段 | `cacheKeys.test.js` | tenant/user/session/mtime |
| ☐ | C-41 | cache hit/miss | ↑ | 第二次命中 |
| ☐ | C-42 | invalidate 后 miss | ↑ | 删除后 null |

### C.4 SessionStore 防全量 refresh

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | C-50 | tail query params | `useSessionStore.pagination.test.ts` | backward+limit |
| ☐ | C-51 | fetchMore cursor | ↑ | cursor 对齐 |
| ☐ | C-52 | merge 无重复 | ↑ | id 不重复 |
| ☐ | C-53 | start=0 仍 tail refresh | ↑ | limit=120 非 null |

### C.5 一键门禁

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | C-60 | history quick | `npm run test:history-messages:quick` | 全部 exit 0 |
| ☐ | C-61 | effective flags | `node scripts/check-history-message-flags.mjs` | 与当前轮次一致 |

---

## D. 历史 messages 加速 — 实机（P0，按 R1→R2→R3）

### D.1 HM-01 重会话首屏

| ☐ | ID | 子项 | 操作 | 通过标准 | 实测 |
|---|-----|------|------|----------|------|
| ☐ | D-01a | 导入大 jsonl 会话 | 复制 fixture 到 `.saas-dev-data` chats | 会话可打开 | |
| ☐ | D-01b | Network 响应体积 | DevTools / curl | **<500KB** | KB= |
| ☐ | D-01c | 首屏耗时 R1 | 同上 | **<2s** | ms= |
| ☐ | D-01d | 首屏耗时 R2 | 开 TAIL_READ=1 | **<1.5s** | ms= |
| ☐ | D-01e | 无浏览器卡死 | 目视 | 可交互 | |
| ☐ | D-01f | writtenFilePath 可点成果 | 点成果 | 预览/文件夹正常 | |

### D.2 HM-02 轻量会话

| ☐ | ID | 子项 | 通过标准 | 实测 |
|---|-----|------|----------|------|
| ☐ | D-02a | 打开文本型长会话 | 成功加载 | |
| ☐ | D-02b | 响应 **<200KB** | KB= |
| ☐ | D-02c | 耗时 ±20% 历史基线 | ms= |

### D.3 HM-03 上滚加载更多

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-03a | 滚顶触发 fetchMore 第 1 次 | 更早消息出现 |
| ☐ | D-03b | 第 2 次 fetchMore | cursor 连续 |
| ☐ | D-03c | 第 3 次 fetchMore | 无重复 bubble id |
| ☐ | D-03d | 时间戳单调 | 不乱序 |
| ☐ | D-03e | hasMore 与 total 一致 | 滚到顶 hasMore=false |

### D.4 HM-04 成果四线

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-04a | 成果面板点击 | 弹窗/右栏预览 |
| ☐ | D-04b | 正文路径链接 | 右栏预览非下载 |
| ☐ | D-04c | 前往任务文件夹 | 文件树选中 |
| ☐ | D-04d | 四线 audit | `npm run test:four-line-audit` 绿 |
| ☐ | D-04e | deliverable-paths | `npm run test:deliverable-paths` 绿 |

### D.5 HM-05 refresh 不爆量

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-05a | 切项目再切回 | messages 带 limit=120 |
| ☐ | D-05b | projects_updated 刷新 | 无 limit=null |
| ☐ | D-05c | 单次 payload | **<1MB** |
| ☐ | D-05d | loadedRange.start=0 时 | 仍 tail 非全量 |

### D.6 HM-06 Gateway 断连

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-06a | 停止 Gateway 进程 | ui/server 仍运行 |
| ☐ | D-06b | GET messages | HTTP 200 |
| ☐ | D-06c | 响应已 sanitize | 体积受控 |
| ☐ | D-06d | UI 弱提示 | 非红色 Recovery 长文 |

### D.7 HM-07 WS 进行中

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-07a | 发送新消息 | 流式正常 |
| ☐ | D-07b | turn 完成后 tail | 与 API 一致 |
| ☐ | D-07c | 无 duplicate 气泡 | id 唯一 |

### D.8 HM-08 Recovery

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | D-08a | wuyutai jsonl 对比 | `npm run test:recovery-wuyutai` | 无回归 |
| ☐ | D-08b | 无 synthetic 英文气泡 | 目视/脚本 | 用户气泡无 Recovery 指南 |

### D.9 HM-09 R3 缓存（可选 P1，R3 轮）

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | D-09a | 同 session 第二次 tail | 延迟下降 |
| ☐ | D-09b | 新消息后第三次 | cache miss 后仍正确 |

---

## E. Conversation Catalog（P0）

| ☐ | ID | 子项 | 命令/操作 | 通过标准 |
|---|-----|------|-----------|----------|
| ☐ | E-01 | catalogStore 单测 | `test:saas:conversation-catalog` | PASS |
| ☐ | E-02 | smoke catalog | `npm run smoke:conversation-catalog` | PASS |
| ☐ | E-03 | CC-01 侧栏 vs jsonl | 比对数量 | catalog≥80% jsonl |
| ☐ | E-04 | CC-02 软删 messages | DELETE 会话后 GET | **403** |
| ☐ | E-05 | CC-03 新建对话 | 新建后 30s | 侧栏可见 |
| ☐ | E-06 | SAAS_CONVERSATION_CATALOG=1 | env 确认 | 已开 |
| ☐ | E-07 | shadow upsert | 新 turn 后 | catalog 行更新 |

---

## F. Playwright 实机 E2E（P0）

| ☐ | ID | 套件 | 用例名 | 通过标准 |
|---|-----|------|--------|----------|
| ☐ | F-01 | isolation | ① 常驻跨租户 | 非 500 |
| ☐ | F-02 | isolation | ② /usage/me 无 byUser | 仅本人 |
| ☐ | F-03 | isolation | ③ 成员 /usage/admin 403 | 403 |
| ☐ | F-04 | resilience-recovery | R5 无 Recovery 英文 | 无泄漏 |
| ☐ | F-05 | resilience-recovery | Composer 可见 | 可输入 |
| ☐ | F-06 | long-session | LONG-01 刷新 Composer | 可用 |
| ☐ | F-07 | long-session | LONG-06 历史 API 非空 | 200+数据 |
| ☐ | F-08 | long-session | LONG-07 尾部分页有序 | limit 生效 |
| ☐ | F-09 | deep-uat | 注册无验证码 400 | 400 |
| ☐ | F-10 | deep-uat | 成员无配置 Tab | UI 正确 |
| ☐ | F-11 | deep-uat | 非管理员 /admin 403 | 权限提示 |
| ☐ | F-12 | deep-uat | 管理员后台 | 可访问 |
| ☐ | F-13 | history-messages-perf | 登录打开会话 | messages<800KB |
| ☐ | F-14 | chat-experience | （全套件） | exit 0 |
| ☐ | F-15 | admin-dashboard | （全套件） | exit 0 |
| ☐ | F-16 | process-ux-live | P-UX1~7 | exit 0 |
| ☐ | F-17 | lan-login-chat | 登录+输入框 | exit 0 |

**批量命令**：`npx playwright test -c ui/playwright.config.ts ui/e2e/saas ui/e2e/chat-experience.spec.ts ui/e2e/phase3/admin-dashboard.spec.ts`

---

## G. pre-production 精益套件（P0）

| ☐ | ID | 子项 | 命令块 | 通过标准 |
|---|-----|------|--------|----------|
| ☐ | G-01 | os-compat-smoke | `test:pre-production` 步骤 | PASS |
| ☐ | G-02 | build | ↑ | PASS |
| ☐ | G-03 | test:saas:deep | ↑ | PASS |
| ☐ | G-04 | check:saas-fork | ↑ | PASS |
| ☐ | G-05 | brand:check | ↑ | PASS |
| ☐ | G-06 | smoke:resilience | ↑ | PASS |
| ☐ | G-07 | smoke:project-memory | ↑ | PASS |
| ☐ | G-08 | smoke:saas-isolation | ↑ | PASS |
| ☐ | G-09 | vitest-resilience-ui | ↑ | PASS |
| ☐ | G-10 | test:saas:storage CLOUD | ↑ | PASS |
| ☐ | G-11 | test:saas:folder | ↑ | PASS |
| ☐ | G-12 | smoke:capability-hub | ↑ | PASS |
| ☐ | G-13 | smoke:conversation-catalog | ↑ | PASS |
| ☐ | G-14 | test:saas:pg-validation | ↑ 或 SKIP | PASS/SKIP |
| ☐ | G-15 | resilience-live | ↑ live | PASS |
| ☐ | G-16 | oss-regression | ↑ | PASS |
| ☐ | G-17 | mobile-regression | ↑ | PASS |
| ☐ | G-18 | browser-compat-lean | ↑ | PASS |
| ☐ | G-19 | playwright-saas-core | ↑ | PASS |
| ☐ | G-20 | http-load-smoke | ↑ | PASS |
| ☐ | G-21 | pack:preflight | ↑ | PASS |

---

## H. 云端存储 CLOUD-01~12（P0）

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | H-01 | CLOUD-01 默认 cloud-only prefs | PASS |
| ☐ | H-02 | CLOUD-02 workspace provision | PASS |
| ☐ | H-03 | CLOUD-03 读文件树 | PASS |
| ☐ | H-04 | CLOUD-04 下载单文件 | PASS |
| ☐ | H-05 | CLOUD-05 ZIP 下载 | PASS |
| ☐ | H-06 | CLOUD-06 browse-filesystem 403 | PASS |
| ☐ | H-07 | CLOUD-07 SaaS 创建项目 | PASS |
| ☐ | H-08 | CLOUD-08 跨租户路径 | 403 |
| ☐ | H-09 | CLOUD-09 租户隔离 provision | PASS |
| ☐ | H-10 | CLOUD-10 多根 workspace | PASS |
| ☐ | H-11 | CLOUD-10b 成果跨根 | PASS |
| ☐ | H-12 | CLOUD-11 缩略图/缓存头 | PASS |
| ☐ | H-13 | CLOUD-12 同租户跨 userId | 拒绝 |

**命令**：`npm run test:saas:storage`

---

## I. 多用户与并发（P0）

| ☐ | ID | 子项 | 命令/操作 | 通过标准 |
|---|-----|------|-----------|----------|
| ☐ | I-01 | Playwright 双租户注册 | isolation.spec | PASS |
| ☐ | I-02 | A 写成果 B 不可读 | 手工/API | 403/404 |
| ☐ | I-03 | MU-01 multi-user sim | `FORCE_MULTI_USER_SIM=1 npm run test:multi-user:sim` | recovery≤6/turn |
| ☐ | I-04 | MU-02 产物 tenant 隔离 | ↑ | 路径不串 |
| ☐ | I-05 | multi-skill matrix | `npm run test:multi-skill:matrix` | PASS |
| ☐ | I-06 | 3 tab 同时开重会话 | 手工 15min | 无 WS 全断 |
| ☐ | I-07 | 1 tab live turn + 2 tab 读历史 | 手工 | SessionStore 不错乱 |
| ☐ | I-08 | 2 用户同时登录不同浏览器 | 手工 | 互不影响 |

---

## J. 负载测试（P0）

> **口径**：`SERVER_URL` 须指向 Bridge/API 端口（本地 dev:saas 常见 **3002**），**勿**用 Vite `5173`。示例：`SERVER_URL=http://127.0.0.1:3002 node scripts/load/http-load.mjs --scenario smoke`

| ☐ | ID | 场景 | 命令 | 通过标准 | 实测 |
|---|-----|------|------|----------|------|
| ☐ | J-01 | smoke 30s c=10 | `node scripts/load/http-load.mjs --scenario smoke` | 错误率<1% | % |
| ☐ | J-02 | smoke P95 captcha | ↑ | <1s | ms |
| ☐ | J-03 | smoke P95 login | ↑ | <3s | ms |
| ☐ | J-04 | stress 120s c=50 | `--scenario stress` | 错误率<2% | % |
| ☐ | J-05 | stress P95 login | ↑ | <5s | ms |
| ☐ | J-06 | spike 60s c=100 | `--scenario spike` | 无崩溃；错误率<5% | % |
| ☐ | J-07 | HM 并发 5× tail120 | stress 期间 curl | P95<2s R2 | ms |
| ☐ | J-08 | soak 15min（P1） | `--scenario soak` | RSS 增幅<20% | % |

---

## K. 破坏 / 异常 / 混沌（P0）

| ☐ | ID | 子项 | 操作 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | K-01 | CH-01 杀 Gateway | 停 Gateway | disk fallback；HM-06 |
| ☐ | K-02 | CH-02 停 Redis | dev:infra 停 Redis | 登录可用；messages 200 |
| ☐ | K-03 | CH-03 refresh 风暴 | 10× 切项目 | 无全量；内存稳定 |
| ☐ | K-04 | CH-04 半截 jsonl | 手动 corrupt 末行 | warning 不崩 |
| ☐ | K-05 | CH-05 limit=999999 | curl 超大 limit | 无 OOM |
| ☐ | K-06 | CH-06 docker-smoke | `node scripts/docker-smoke.mjs` | PASS |
| ☐ | K-07 | CH-07 flag 回滚 | SANITIZE=0,TAIL=0 | JSONL 不变 |
| ☐ | K-08 | 重启 dev:saas 3 次 | 连续重启 | 仍可登录对话 |
| ☐ | K-09 | PG 断连降级（若 PG） | 停 PG 30s | 降级非 500 雪崩 |
| ☐ | K-10 | 磁盘满模拟（P1） | 临时满卷 | 优雅错误 |

---

## L. 安全攻击模拟（P0）

| ☐ | ID | 子项 | 命令/操作 | 通过标准 |
|---|-----|------|-----------|----------|
| ☐ | L-01 | SEC-01 未登录 projects | `security-regression-checklist.mjs` | 401/403 |
| ☐ | L-02 | SEC-02 admin config 写 | ↑ | 非 500 |
| ☐ | L-03 | SEC-03 匿名 storage | ↑ | 401/403 |
| ☐ | L-04 | SEC-04 篡改 JWT | ↑ | 401/403 |
| ☐ | L-05 | SEC-05 admin 登录 | ↑ | token 有 |
| ☐ | L-06 | SEC-05b saasMode | ↑ | true |
| ☐ | L-07 | SEC-06 无验证码注册 | ↑ | 400 |
| ☐ | L-08 | SEC-07 遥测默认关 | 观察 | 文档一致 |
| ☐ | L-09 | SEC-08 deploy/.env ignore | ↑ | gitignore |
| ☐ | L-10 | SEC-09 CORS 观察 | 文档 | 已记录 |
| ☐ | L-11 | SEC-10 SQLi 登录 | ↑ | 401/400 |
| ☐ | L-12 | SEC-11 路径穿越 | 手工 file/resolve | 403/404 |
| ☐ | L-13 | SEC-12 跨租户 sessionId | 手工 messages | 403 |
| ☐ | L-14 | SEC-13 XSS 标题 | 手工输入 `<script>` | 不执行 |
| ☐ | L-15 | SEC-14 10MB POST | 超大 body | 413/400 服务存活 |

---

## M. 辐射回归 — 文档/PPT/能力（P1，建议全跑）

| ☐ | ID | 子项 | 命令 | 优先级 |
|---|-----|------|------|--------|
| ☐ | M-01 | test:process-ux:full | npm run | P1 |
| ☐ | M-02 | smoke:document-export | npm run | P1 |
| ☐ | M-03 | smoke:nova-ppt-try | npm run | P1 |
| ☐ | M-04 | smoke:editable-pptx-kit | npm run | P1 |
| ☐ | M-05 | test:prelaunch:quick | npm run | P1 |
| ☐ | M-06 | smoke:capability-try-prompts | npm run | P1 |
| ☐ | M-07 | smoke:templates | npm run | P1 |
| ☐ | M-08 | smoke:skill-risk | npm run | P1 |
| ☐ | M-09 | smoke:marketing-install | npm run | P1 |
| ☐ | M-10 | verify:marketing-saas | npm run | P1 |
| ☐ | M-11 | test:task-resilience:unit | npm run | P1 |
| ☐ | M-12 | selfcheck:p0-p2 | npm run | P2 记录 |

---

## N. production-readiness 全量（P1）

| ☐ | ID | Phase | 子项 | 命令 |
|---|-----|-------|------|------|
| ☐ | N-01 | P0 | capabilities:gen | `test:production-readiness` |
| ☐ | N-02 | P0 | test:process-ux:full | ↑ |
| ☐ | N-03 | P0 | smoke:document-export | ↑ |
| ☐ | N-04 | P0 | smoke:nova-ppt-try | ↑ |
| ☐ | N-05 | P0 | smoke:editable-pptx-kit | ↑ |
| ☐ | N-06 | P0 | test:prelaunch:quick | ↑ |
| ☐ | N-07 | P1 | test:prelaunch:stability | ↑ |
| ☐ | N-08 | P1 | test:saas:storage | ↑ |
| ☐ | N-09 | P1 | test:saas:folder | ↑ |
| ☐ | N-10 | P2 | smoke:capability-hub | ↑ |
| ☐ | N-11 | P2 | capability-representative-live | ↑ |
| ☐ | N-12 | P2 | process-template-live | ↑ |
| ☐ | N-13 | P5 | test:saas:deep | ↑ |
| ☐ | N-14 | P5 | test:multi-user:sim | ↑ |
| ☐ | N-15 | P5 | resilience-live | ↑ |
| ☐ | N-16 | P5 | playwright saas 全量 | ↑ |
| ☐ | N-17 | P6 | security-regression | ↑ |
| ☐ | N-18 | P7 | http-load 四场景 | ↑ |
| ☐ | N-19 | P8 | pack:preflight | ↑ |
| ☐ | N-20 | P8 | docker-smoke | ↑ |
| ☐ | N-21 | P8 | browser-compat | ↑ |
| ☐ | N-22 | P8 | mobile-regression | ↑ |
| ☐ | N-23 | P8 | oss-regression | ↑ |
| ☐ | N-24 | P8 | test:launcher:quick | ↑ |

**命令**：`npm run test:production-readiness`

---

## O. prelaunch-stability 全量（P1）

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | O-01 | build | PASS |
| ☐ | O-02 | test:saas:deep | PASS |
| ☐ | O-03 | smoke:saas-isolation | PASS |
| ☐ | O-04 | smoke:resilience | PASS |
| ☐ | O-05 | smoke:project-memory | PASS |
| ☐ | O-06 | smoke:capability-hub | PASS |
| ☐ | O-07 | smoke:capability-try-prompts | PASS |
| ☐ | O-08 | smoke:templates | PASS |
| ☐ | O-09 | smoke:skill-risk | PASS |
| ☐ | O-10 | smoke:document-export | PASS |
| ☐ | O-11 | test:saas:storage | PASS |
| ☐ | O-12 | test:saas:folder | PASS |
| ☐ | O-13 | check:saas-fork | PASS |
| ☐ | O-14 | brand:check | PASS |
| ☐ | O-15 | vitest-capability-binding | PASS |
| ☐ | O-16 | vitest-ui-skills | PASS |
| ☐ | O-17 | pack:preflight | PASS |
| ☐ | O-18 | prelaunch-skill-live | PASS |
| ☐ | O-19 | prelaunch-quick-full | PASS |

**命令**：`npm run test:prelaunch:stability`

---

## P. 发版包与 DEP 配置（P0）

| ☐ | ID | 子项 | 通过标准 |
|---|-----|------|----------|
| ☐ | P-01 | pack:preflight | exit 0 |
| ☐ | P-02 | pack:deploy 成功 | tar.gz 生成 |
| ☐ | P-03 | DEP-01 MANIFEST historyMessagesAccel | JSON 存在 |
| ☐ | P-04 | DEP-02 deploy.env SANITIZE=1 | 已写入 |
| ☐ | P-05 | DEP-03 TAIL/CACHE 文档化 | DEPLOY.md 含三阶段 |
| ☐ | P-06 | DEP-04 HISTORY-MESSAGES-DEPLOY.md | 包内存在 |
| ☐ | P-07 | DEP-05 CACHE_TTL_MESSAGES_SEC=120 | deploy.env |
| ☐ | P-08 | docker-smoke | PASS |
| ☐ | P-09 | verify-export-runtime | PDF/PPT 链路 |
| ☐ | P-10 | verify-cloud-runtime | Playwright/Redis |
| ☐ | P-11 | verify-cloud-perf 本地模拟 | history flag warn 已理解 |

---

## Q. 生产只读抽检（P1，本地全绿后）

| ☐ | ID | 子项 | 命令 | 通过标准 |
|---|-----|------|------|----------|
| ☐ | Q-01 | 白屏检查 | `node scripts/check-white-screen.mjs https://www.novapage.online/p/general` | PASS |
| ☐ | Q-02 | cloud chat-load | `npm run test:cloud:chat-load` | 无 >10s 且 >1MB |
| ☐ | Q-03 | tail120 P95 体积 | diag 输出 | <500KB 为主 |
| ☐ | Q-04 | HTTPS 443 | curl -I | 200/302 |

**禁止**：生产 stress/spike/混沌/SEC 暴力。

---

## R. 汇总计分

| 类别 | P0 总数 | ☑ 通过 | ☒ 失败 | ⏭ 跳过 |
|------|---------|--------|--------|--------|
| A 前置 | 7 | | | |
| B 构建 | 4 | | | |
| C 历史单元 | 35 | | | |
| D 历史实机 | 30 | | | |
| E Catalog | 7 | | | |
| F Playwright | 17 | | | |
| G pre-production | 21 | | | |
| H CLOUD | 13 | | | |
| I 多用户 | 8 | | | |
| J 负载 | 7 | | | |
| K 混沌 | 10 | | | |
| L 安全 | 15 | | | |
| P 发版包 | 11 | | | |
| **P0 合计** | **~180** | | | |

| P1 类别 | 建议跑满 | ☑ |
|---------|----------|---|
| M 辐射 | 12 | |
| N readiness | 24 | |
| O stability | 19 | |
| Q 生产抽检 | 4 | |

---

## S. 失败与豁免登记

| ID | 失败描述 | 优先级 | 是否豁免 | 影响面 | 回滚方案 | 修复 ETA |
|----|----------|--------|----------|--------|----------|----------|
| | | | ☐ | | | |
| | | | ☐ | | | |
| | | | ☐ | | | |

---

## T. 最终签收

| ☐ | 声明 |
|---|------|
| ☐ | 全部 P0 行已 ☑，或失败项已填 §S 且 P1 豁免 ≤3 |
| ☐ | R2（SANITIZE+TAIL_READ）作为生产默认 flag 已确认 |
| ☐ | 回滚：`restore-point/pre-history-messages-accel-2026-06-20` + env flag=0 |
| ☐ | **判定：具备上线能力** |

**签名人**：____________　**日期**：____________
