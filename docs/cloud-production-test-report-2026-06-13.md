# 云端生产环境深度测试报告

生成时间：2026-06-13（UTC+8）  
目标环境：`http://www.novapage.online`（ECS `47.79.32.199`）  
管理员：`admin` / `admin123`（未改密，与线上一致）  
前端构建指纹：`index-CAM3Vd8n.js`（入口 ~725KB，对应已部署包 5061 系列）

---

## 1. 执行摘要

| 维度 | 结果 | 说明 |
|------|------|------|
| **HTTP 可用性** | ✅ 通过 | 登录页、API、工作台可访问 |
| **HTTPS** | ❌ 未通过 | 443 连接被拒绝，Nginx 未监听 HTTPS |
| **API 深度探测** | ✅ 20/23 | 认证、隔离、承载、能力目录均正常 |
| **Playwright 云端** | ⚠️ 8/15 | 核心登录/后台/多用户通过；部分用例因线上包滞后或首屏加载慢失败 |
| **破坏性探测** | ✅ 通过 | 错误密码、无效 JWT、成员越权均被拒绝 |
| **承载（轻量）** | ✅ 通过 | 登录页 20 并发、Captcha 15 并发无失败 |
| **Skills 全链路** | ⚠️ 部分 | 目录层 5 类抽样 4/5；智能体实跑未在云端自动完成（耗时/API Key） |

**结论：HTTP 生产可用，核心 SaaS 与多租户隔离正常；HTTPS 与部分 48h 内 UI 修复尚未上线。建议在恢复 HTTPS 并发布含最新前端/导出修复的包后，再跑一轮导出与 AppShell 性能验收。**

---

## 2. 测试范围与方法

### 2.1 自动化脚本（本次新建/复用）

| 脚本 | 作用 |
|------|------|
| `scripts/integration-production-cloud-deep.mjs` | 云端 API、安全、承载、能力目录、技能抽样 |
| `ui/e2e/production/cloud-prod-deep.spec.ts` | 云端 Playwright：Smoke + 48h 回归 + Skills「试一下」 |
| `scripts/check-white-screen.mjs` | 登录页白屏探测 |
| 复用 `ui/e2e/saas/deep-uat.spec.ts` | 多用户注册/权限/管理后台 |
| 复用 `ui/e2e/phase1`、`phase3`、`chat-experience` | 对照本地规格（部分与线上 UI 版本不一致） |
| 本地 `npm run smoke:capability-hub` | 能力分类体系（仓库 catalog，非远程） |

复跑命令：

```bash
# API + 承载 + 破坏性
PROD_BASE_URL=http://www.novapage.online node scripts/integration-production-cloud-deep.mjs

# Playwright（需本机已 npx playwright install chromium）
PLAYWRIGHT_BASE_URL=http://www.novapage.online npx playwright test -c ui/playwright.config.ts ui/e2e/production/cloud-prod-deep.spec.ts ui/e2e/saas/deep-uat.spec.ts
```

原始 JSON：`artifacts/production-cloud-test/api-report.json`  
Playwright 报告：`artifacts/e2e/chat-experience/report/index.html`

### 2.2 未在云端自动执行（需人工或专用环境）

- 真实智能体长对话（需模型 Key、单轮 1–5 分钟）
- PDF/DOC/PPT 导出二进制验收（需项目内已有成果文件 + Playwright 池）
- 文件树侧栏点选路径（5061 已含修复，需 UI 手测）
- 高压破坏性（删库、反复 upgrade、磁盘打满）

---

## 3. 近 48 小时改动 — 针对性覆盖

| 改动域 | 提交/说明 | 云端验证 | 结果 |
|--------|-----------|----------|------|
| 提问/作答 UX（elicitation） | `da6ec2f4` | `deep-uat` 多用户 + 本地单测（报告 06-13） | ⚠️ API/权限 OK；引擎侧需容器重启后手测 |
| 登录分包 / N2 加载页 | `da6ec2f4` | 白屏检查 + P2 登录进工作台 | ✅ 登录页非白屏；⚠️ 工作台首进 ~40s，并行时偶发停在「N2 加载中」 |
| 文档导出 / Playwright | `d2605a63` / 5061 | 导出 capabilities API | ⚠️ 接口可达但需有效 `path`；未测实文件导出 |
| 文件树路径 / 成果解析 | 5061 侧栏修复 | 未自动 E2E | ⏳ 待发布后手测 |
| HTTPS 升级防覆盖 | `nginx-site.sh` 等 | HTTPS 探测 | ❌ 仍未恢复 |
| 侧栏管理员图标入口 | 本地 `SaasSidebarAccount` | `saas-admin-entry` testId | ❌ 线上未部署该前端 |
| 主界面留白收紧 | 本地未发版 | — | — |
| 过程透明 / 云存储 / 容错 | `04c4b544` 等 | R3 无 Recovery 泄露 | ✅ |
| 能力中心 v2 / 425 项 | catalog | `/api/capabilities` | ✅ 425 capabilities |

---

## 4. API / Smoke / 承载 / 破坏性 — 明细

### 4.1 连通与认证

| ID | 项 | 结果 | 数据 |
|----|-----|------|------|
| NET-01 | HTTP | ✅ | 200, ~500ms |
| NET-02 | HTTPS | ❌ | Connection refused |
| AUTH-01 | admin 登录 | ✅ | ~750ms |
| AUTH-02 | SaaS 模式 | ✅ | `saasMode=true` |
| AUTH-03 | 无验证码注册 | ✅ | 400 |
| AUTH-04 | 成员注册 | ✅ | 动态用户 `clouduat_*` |

### 4.2 破坏性 / 安全（非毁数据）

| ID | 项 | 结果 |
|----|-----|------|
| DEST-01 | 无效 JWT | ✅ 403 |
| DEST-02 | 错误密码 | ✅ 401 |
| DEST-03 | 成员访问管理 API | ✅ 403 |
| ISO-01 | 租户项目隔离（排除 shared `general`） | ✅ overlap=0 |

### 4.3 功能 API

| ID | 项 | 结果 | 数据 |
|----|-----|------|------|
| FUNC-01 | 项目列表 | ✅ | admin 2 项 |
| FUNC-03 | 能力 hub | ✅ | **425** 项, ~1s |
| FUNC-04 | 管理仪表盘 API | ✅ | 200 |
| PERF-01 | Captcha 10 次 | ✅ | avg **247ms** |

### 4.4 承载（轻量）

| ID | 场景 | 结果 |
|----|------|------|
| LOAD-01 | 登录页 GET ×20 并发 | ✅ 20/20, 1.5s |
| LOAD-02 | Captcha API ×15 并发 | ✅ 15/15, 267ms |

> 说明：未做长时间压测或 WebSocket 洪水；当前为「生产友好」轻量探测。

---

## 5. Playwright 云端结果

### 5.1 通过（8）

| 用例 | 说明 |
|------|------|
| P1 登录页非白屏 | ROOT_LEN≈14308 |
| P2 管理员登录进工作台 | ~40s（含 AppShell 下载） |
| P3 管理后台仪表盘 | KPI 可见 |
| P4 成员无法进 `/admin` | 权限文案正确 |
| Phase3 admin-dashboard | KPI + 图表 |
| Phase1 admin 用户页 | 3 个 KPI |
| R3 无权限下拉 / 无 Recovery 英文 | 对话区合规 |
| **deep-uat 全部 4 项** | 注册验证码、成员无配置 Tab、成员禁后台、管理员后台 |

### 5.2 失败 / 跳过（7）

| 用例 | 原因 | 严重度 |
|------|------|--------|
| chat-experience ×3 | 并行跑时工作台未在 30s 内出现 `textarea`（与 P2 单跑 40s 矛盾） | 中（时序/性能） |
| Phase1 品牌 tab | 选择器 `.saas-auth-brand-name` 与线上 DOM 不一致 | 低（用例过时） |
| Phase1 platform 页 | `saas-admin-platform` testId 与线上一致性待核 | 低 |
| R1 管理员图标入口 | **`saas-admin-entry` 未部署** | 低（待发版） |
| R2 能力中心飞轮 Tab | 页面停在 **「N2 智能体正在加载中」** | **高（首屏性能）** |
| S1 Skills「试一下」 | 依赖 R2 进入能力中心，**跳过** | — |

---

## 6. Skills 分类型抽样

### 6.1 目录层（API `/api/capabilities?locale=zh-CN`）

| 类型 | 抽样 slug | 结果 |
|------|-----------|------|
| 营销飞轮 / GEO | `pd-geo` | ✅ |
| 办公 / Word | `anth-docx` | ✅ |
| 创作 / 设计 | `open-design` | ✅ |
| 流程模板关联 | `geo-aeo-audit` | ✅ |
| 教育学习 | `teacher-biology-homework-generation` 等存在；脚本误用 `hermes-primary-math` | ⚠️ 脚本 slug 需更正，**线上教育类能力正常** |

教育类线上实测存在：`teacher-biology-*`、`anth-pdf`、`nova-research-academic-professional` 等。

### 6.2 全链路（对话实跑）

| 类型 | 计划 | 云端执行 |
|------|------|----------|
| GEO 营销 | 「试一下」→ 预填对话 | ⏭ 跳过（能力 Tab 加载超时） |
| DOCX 办公 | 上传/生成 docx | 未执行（需模型 + 长时） |
| Open Design | 设计系统选型对话 | 未执行 |
| 教育 Hermes | 出题/备课 prompt | 未执行 |
| MCP / 联网 | web_search 软失败路径 | 未执行 |

**建议手测清单（管理员 + 新注册成员各 1 次）：**

1. 能力中心 → 营销飞轮 → `pd-geo` → 试一下 → 发送一句「帮我做竞品 GEO 简析」  
2. 办公 → `anth-docx` → 生成一页 Word 大纲  
3. 创作 → `open-design` → 要一套落地页结构  
4. 教育 → 任选 `teacher-*-lesson-planning` → 要一节教案  
5. 对话产出 `artifacts/**` 后：侧栏文件树点开 + 导出 PDF  

---

## 7. 性能观察

| 指标 | 实测 |
|------|------|
| 登录页 TTFB | HTTP 正常 |
| 入口 JS | `index-CAM3Vd8n.js` ~725KB |
| AppShell 懒加载 | P2 单测 ~**40s** 才出现输入框 |
| Captcha API | 热路径 ~250ms |
| 能力 hub 冷启动 | ~**1s**（425 项） |
| 登录页 20 并发 | 1.5s 全部 200 |

**风险：** 弱网或并行自动化时，用户可能长时间看到「N2 智能体正在加载中」；与 06-13 本机 dev 报告（AppShell ~4.1MB lazy）一致，生产未做 CDN 分片加速时体验偏慢。

---

## 8. 问题清单与处置建议

| 优先级 | 问题 | 建议 |
|--------|------|------|
| **P0** | HTTPS 不可用 | ECS 执行 `setup-https-aliyun.sh` + 安全组 443；升级时用 `https-aliyun.env` 防覆盖 |
| **P1** | AppShell 首进过慢 / N2 加载卡住 | 确认 nginx 对 `assets/*` 缓存；考虑 OSS/CDN；压缩或再拆 chunk |
| **P1** | 导出 API 未端到端验证 | 在 general 项目生成 `artifacts/test.md` 后测 `files/export` PDF/DOC/PPT |
| **P2** | 侧栏管理员图标、留白等 UI 未上线 | 打包发版 `upgrade.sh` |
| **P2** | 文件树路径修复 | 5061 已含代码，建议手测侧栏点文件 |
| **P3** | Playwright 用例与线上 DOM 漂移 | 更新 `phase1` 品牌选择器；生产套件加长 `waitForAppShell` |
| **P3** | 默认密码 `admin123` | 公网前务必改密 |

---

## 9. 测试统计汇总

| 类别 | 通过 | 失败 | 警告/跳过 |
|------|------|------|-----------|
| API 深度（23 项） | 20 | 1* | 2 |
| Playwright（15 项） | 8 | 7 | 1 skip |
| deep-uat（4 项） | 4 | 0 | 0 |
| 白屏检查 | 1 | 0 | 0 |
| 本地 capability-hub | 1 | 0 | 0 |

\* SKILL-EDU 为脚本 slug 写错，非线上缺陷。

---

## 10. 结论与下一步

**可以继续在 HTTP 下使用核心功能**（登录、多用户、能力目录、管理后台、租户隔离）。  
**不建议对外正式推广**，直到：

1. HTTPS 恢复  
2. 发布含导出修复 + UI 修复的最新包  
3. 完成导出与文件树手测  
4. 修改默认管理员密码  

**推荐发版后复测命令：**

```bash
PROD_BASE_URL=https://www.novapage.online node scripts/integration-production-cloud-deep.mjs
PLAYWRIGHT_BASE_URL=https://www.novapage.online npx playwright test -c ui/playwright.config.ts ui/e2e/production/cloud-prod-deep.spec.ts ui/e2e/saas/deep-uat.spec.ts
```

---

## 附录 A — 复测记录（2026-06-13 19:23 UTC+8）

| 维度 | 首轮 | **复测** | 变化 |
|------|------|----------|------|
| API 深度 | 20/23 | **20/23** | 持平 |
| Playwright（串行 workers=1） | 8/15 | **10/12** | ↑ R2、P2 稳定通过 |
| deep-uat | 4/4 | **4/4** | 持平 |
| HTTPS | ❌ | **❌** | 未修复 |
| 前端 hash | index-CAM3Vd8n.js | **同左** | 未发新版 |

### 复测 Playwright 明细（12 项，单 worker）

| 用例 | 结果 | 耗时 |
|------|------|------|
| P1 登录页非白屏 | ✅ | 4.3s |
| P2 管理员登录进工作台 | ✅ | **47.6s** |
| P3 管理后台仪表盘 | ✅ | 13.9s |
| P4 成员禁后台 | ✅ | 13.8s |
| R1 管理员图标入口 | ❌ | `saas-admin-entry` 仍不存在（未发版） |
| R2 能力中心营销飞轮 | ✅ | 26.8s（首轮并行失败，串行通过） |
| R3 无权限/无 Recovery | ✅ | 39.0s |
| S1 Skills「试一下」 | ⏭ 跳过 | 能力卡片未定位到 |
| deep-uat ×4 | ✅ | 32s |

### 复测 API 关键指标

- Captcha 均值：**234ms**
- 能力 hub：**425** 项，**1892ms**
- 登录 20 并发：**20/20**，1.18s
- admin 登录：**1732ms**（较首轮略慢）

**复测结论：** 与首轮一致 — HTTP 核心功能稳定；HTTPS、管理员图标发版、Skills「试一下」自动化仍为缺口。建议发版后仅重跑 `R1` + `S1` + HTTPS 探测。

```bash
PROD_BASE_URL=http://www.novapage.online node scripts/integration-production-cloud-deep.mjs
PLAYWRIGHT_BASE_URL=http://www.novapage.online npx playwright test -c ui/playwright.config.ts ui/e2e/production/cloud-prod-deep.spec.ts ui/e2e/saas/deep-uat.spec.ts --workers=1
```

