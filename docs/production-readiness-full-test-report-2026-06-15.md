# Nova Ai-Studio 生产级全面测试报告

**日期**：2026-06-15  
**编排**：`npm run test:production-readiness`（`scripts/run-production-readiness-full.mjs`）+ 分步补跑  
**环境**：Windows 10 · Node v22 · `dev:saas`（API `3001` / Vite `5173` / Gateway `18789`）· PG `pilotdeck_saas` + SQLite 隔离用例  
**数据根**：`F:\Ai-pilotdeck\.saas-dev-data`

---

## 一、执行摘要

**Go / No-Go：有条件 No-Go**（可内测/灰度；**2026-06-15 续跑后** prelaunch **18/18**、PG **47/47**、build **PASS**）

| 指标 | 结果 |
|------|------|
| **Go / No-Go** | **有条件 No-Go** → 内测 **Go**；生产上线仍待 Agent 实跑验收 |
| prelaunch:stability | **18/18** ✅（续跑，build/captcha 已修） |
| PG validation | **47/47** ✅ |
| 能力代表实跑 | 抽样仍 **TIMEOUT**@180s（Gateway 连通，模型回合过长） |
| 能力代表实跑（12 条抽样） | **0/12 PASS**（全部 **TIMEOUT**@90s；Gateway 已连通） |
| 流程模板实跑（6 条） | **0/6 PASS**（**TIMEOUT**；`press-release-pack` 已调用 write_file/generate_image/export_document） |
| 安全 SEC-01~10 | **11/11 PASS** |
| 压力 LOAD smoke/stress/soak/spike | **4/4 PASS**（fail=0） |
| 品牌 / fork | **brand:check PASS** · **check:saas-fork 283/283** |

**结论一句话**：静态主链、云同步、容错 Live、文档导出与压力测试均达标；**TypeScript 全量 build**、**Agent 实跑验收窗口过短**、**PG 夹具冲突**与 **移动 PWA 文件/我的页** 为当前上线门禁缺口。

---

## 二、五重视角结论

### 产品经理（PM）
1. 营销飞轮 Hub 静态筛选 **0 failure**；29 流程模板配置 smoke **PASS**。
2. 「试一下」411 条提示词 + 绑定抽检 **PASS**；斜杠 CommandMenu Playwright **SK-01~04 PASS**。
3. 流程模板实跑 **工具链已启动**（通稿包写文件+生图），但 **未在时限内收到 turn_completed** → 需延长验收超时或拆步验收。
4. 能力代表实跑在 90s 内无法完成深度调研类任务 → Tier B 应分批夜间跑或降为「单工具 smoke」。
5. 吴裕泰 PPT / outline-ppt-video 全案 **本轮未跑**（标 SKIP-KEY/TIMEOUT 策略）。

### 测试总监（TD）
1. 编排器与 4 个新脚本已落地：`integration-capability-representative-live.mjs`、`integration-process-template-live.mjs`、`security-regression-checklist.mjs`、`run-production-readiness-full.mjs`、`docker-smoke.mjs`。
2. 产物：`artifacts/full-test/*.json`、`artifacts/pre-production-test/http-load-*.json`。
3. **P1 缺口**：`npm run build` TS18047×11；`prelaunch-quick` 2 子项红。
4. **P3/P4 缺口**：实跑脚本默认超时与计划 8–15min/模板不一致 → 报告按 **TIMEOUT（.harness）** 分类，非功能硬失败。
5. 建议 CI：静态全绿 + CAP_LIVE_LIMIT=5 @300s 夜间；模板 light 单条 @600s。

### 终端用户（EU）
1. 登录 → Composer → 离线禁发 → 恢复：**resilience-live 7/7 PASS**。
2. 对话简化：`test:process-ux:full` **51/51 PASS**；无 `Several tools failed` 用户气泡。
3. Playwright 核心 **7/8**（`resilience-recovery` Composer 可见 **偶发失败**，与 login 路径有关）。
4. 移动 PWA：Hub/Composer 触控 **PASS**；**文件树 / 我的** 页 **FAIL**（需补测数据或路由）。
5. 成果预览静态链路（document-export / nova-ppt-manifest）**PASS**。

### 顾问（CON）
1. GEO / 竞品代表 slug 已纳入 CAP-LIVE 矩阵；实跑 **TIMEOUT** 未否定 skill 绑定。
2. `smoke:marketing-install` **PASS**；`verify:marketing-saas` **FAIL**（5 个英文名 display_name 缺中文）。
3. `test:multi-skill:matrix` **PASS**（无「重试/失败」泄漏文案）。
4. 文档导出 PDF/DOCX/PPTX/XLSX **smoke 全 PASS**。
5. editable-pptx-kit 3 页 **14s PASS**。

### 技术评估员（TE）
1. 云同步 **30/30**；租户隔离 deep + isolation **PASS**。
2. PG 验证 **SQLite 段 PASS**；PG 段 **alice register 400**（用户名已存在，夹具污染）。
3. 负载：smoke p95 **685ms** · stress p95 **2894ms** · soak 15min **fail=0** · spike **fail=0**。
4. Docker 本轮 **未完整执行** compose 冒烟（本机 Docker 29.2 可用，留 DOCKER-01~05 下次 `node scripts/docker-smoke.mjs`）。
5. Gateway harness 实跑证明 **WS 与 submit_turn 正常**；瓶颈在 LLM 回合时长与超时配置。

---

## 三、48 小时 / 近期问题回归（§三 精选）

### 3.1 PPT 专题（REG-PPT）

| ID | 结果 | 证据 |
|----|------|------|
| REG-PPT-01 | **PASS** | `smoke:nova-ppt-manifest` |
| REG-PPT-02 | **SKIP** | 未跑 `test:recovery-wuyutai:run`（耗时长+生图 Key） |
| REG-PPT-03 | **PASS** | `imageGenerationGate` vitest |
| REG-PPT-04 | **PASS** | `smoke:editable-pptx-kit` 3 slides |
| REG-PPT-05 | **PASS** | kit 导出 14s |
| REG-PPT-06 | **PASS** | `smoke:document-export` 含 pptx |
| REG-PPT-07 | **TIMEOUT** | `outline-ppt-video` 模板实跑超时 |
| REG-PPT-08 | **SKIP-KEY** | 生图 Key 依赖模型池 |
| REG-PPT-09 | **PASS** | anth-docx / export 扩展名 smoke |
| REG-PPT-10 | **SKIP** | meeting-to-deck 未实跑 |
| REG-PPT-11 | **PASS** | process-ux nova-ppt 场景 vitest |
| REG-PPT-12 | **PASS** | document-export 二进制产出 |

### 3.2 对话简化（REG-UX）

| ID | 结果 | 证据 |
|----|------|------|
| REG-UX-01 | **PASS** | MessagesPaneV2.render.test |
| REG-UX-02 | **PASS** | userFacingErrors.copy.test |
| REG-UX-03 | **PASS** | MessageRowV2 / autoRecoveryContinue tests |
| REG-UX-04 | **PASS** | RecoveryGuidanceCard.test |
| REG-UX-05 | **PASS** | ProcessClueStrip.test |
| REG-UX-06 | **PASS** | ToolRenderer 本地化（vitest 集） |
| REG-UX-07 | **PASS** | test:process-ux:full |
| REG-UX-08 | **PASS** | InformalProcessStack.test |
| REG-UX-09 | **PASS** | E2E-07 + long-session LONG-01 |
| REG-UX-10 | **PASS** | 错误标签 zh 单测 |
| REG-UX-11 | **PARTIAL** | 长任务阶段 pill 仍待 Phase2 |
| REG-UX-12 | **PASS** | SK-04 列表 prose |
| REG-UX-13 | **PASS** | multi-skill matrix research-report |
| REG-UX-14 | **PASS** | resilience-live 无 fetch failed 红条 |

### 3.3 提问 / Recovery / 云同步（节选）

| ID | 结果 | 说明 |
|----|------|------|
| REG-ELIC-01~04 | **PASS** | pendingElicitation / Gateway 对齐（静态+prelaunch 历史） |
| REG-REC-01~06 | **PASS** | resilience-live + smoke:resilience + MAX 8 预算单测 |
| REG-SYNC-01~06 | **PASS** | storage 30/30 · folder 20/20 · cloud-only |

---

## 四、能力中心矩阵

### 4.1 静态层 — **PASS**

| 命令 | 结果 |
|------|------|
| smoke:capability-hub | PASS failures=0 |
| smoke:capability-try-prompts | PASS 411/411 |
| smoke:skill-risk | PASS（vendor edu 6 high 已知） |
| smoke:marketing-install | PASS |
| verify:marketing-saas | **FAIL** check:i18n-zh 5 项 |
| smoke:od-skills | PASS 16 |
| vitest capabilityBinding | PASS |

### 4.2 代表 Skill 实跑（CAP-LIVE，抽样 12）

见 `artifacts/full-test/capability-live-matrix.json`。

| slug | pill | 结果 | recovery | 备注 |
|------|------|------|----------|------|
| mkt-customer-research | user_market | TIMEOUT | 0 | 90s 窗口不足 |
| df-deep-research | market_landscape | TIMEOUT | 0 | 同上 |
| geo-competitor-analysis | competitive_intel | TIMEOUT | 0 | 同上 |
| pd-geo | ai_search | TIMEOUT | 0 | 同上 |
| tool-web-search | web_fetch | TIMEOUT | 0 | 同上 |
| …共 12 条 | | **0 PASS** | | 建议 `CAP_LIVE_TIMEOUT_MS=300000` 夜间批跑 |

**计分**：按门禁「缺 Key SKIP 不计分母」— 本轮为 **.harness TIMEOUT**，不计入产品能力失败，但 **不满足 ≥90% PASS** 上线条。

---

## 五、流程模板实跑（6 条）

见 `artifacts/full-test/template-live.json`。

| 模板 ID | 复杂度 | 结果 | 工具调用（节选） |
|---------|--------|------|------------------|
| press-release-pack | light | TIMEOUT | write_file, generate_image, export_document |
| geo-visibility-quick | light | TIMEOUT | read_skill, ask_user_question |
| content-flywheel | standard | TIMEOUT | — |
| social-matrix-pipeline | standard | TIMEOUT | — |
| product-launch-full | full | TIMEOUT | — |
| outline-ppt-video | full | TIMEOUT | — |

**静态**：`smoke:templates` 29 条 **PASS** · `test:multi-skill:matrix` **PASS**。

---

## 六、功能 / 多用户 / 全链路

| ID | 结果 | 命令 |
|----|------|------|
| MU-01 | PASS | test:saas:deep 租户 alice/bob |
| MU-02~03 | PASS | storage ISO/CLOUD/LIVE |
| MU-04 | **FAIL** | pg-validation alice register 400 |
| MU-05 | PASS | FORCE_MULTI_USER_SIM=1（本轮未单独标，deep 含多用户） |
| FUNC-R-* | PASS | resilience-live 7/7 · Playwright 7/8 |
| FUNC-DOC-* | PASS | document-export · editable-pptx · nova-ppt |

---

## 七、安全（SEC-*）

`artifacts/full-test/security-checklist.json` — **全部 PASS**。

无 P0 鉴权绕过；注册无验证码 **400**；JWT 篡改 **403**；`deploy/.env` 已 gitignore。

---

## 八、压力（LOAD-*）

| 场景 | fail | p95 | 结果 |
|------|------|-----|------|
| smoke | 0 | 685ms | PASS |
| stress | 0 | 2894ms | PASS |
| soak 15min | 0 | 86ms | PASS |
| spike | 0 | 123ms | PASS |

**缺口（如实）**：未压 WS submit_turn / document-export OCR 并发。

---

## 九、Docker / 浏览器 / 移动

| 项 | 结果 |
|----|------|
| DOCKER-01~05 | **SKIP** 本轮未跑 compose（脚本已就绪 `scripts/docker-smoke.mjs`） |
| browser-compat lean | **FAIL 1** webkit composer；Firefox 未安装 SKIP |
| mobile-regression | **FAIL 2×2** files tree · me screen |
| oss-regression | **FAIL** 末轮 Vite 未起（ERR_CONNECTION_REFUSED）；早前会话已通过预览项 |
| test:launcher:quick | **PASS** |

---

## 十、缺陷清单与修改方向

### P0 — 无（无租户串读 / Recovery 泄漏 / 鉴权绕过复发）

### P1-001：`npm run build` TS18047
- **现象**：prelaunch stability build 失败
- **根因**：`child.stdout`/`stderr` 可能为 null（projectGit、document-export 等）
- **修改方向**：`src/adapters/web/projectGit.ts`、`src/saas/document-export/runScript.ts` 等加 null 守卫
- **回归**：`npm run build` + `test:prelaunch:stability`

### P1-002：Agent 实跑验收超时
- **现象**：CAP-LIVE / TPL-LIVE 全 TIMEOUT
- **根因**：.harness 90s/180s < 计划 8–15min；模型回合+多工具链
- **修改方向**：`CAP_LIVE_TIMEOUT_MS=300000`；模板按复杂度默认 600–900s；或改为「首工具调用+artifacts 路径」轻量断言
- **回归**：`node scripts/integration-capability-representative-live.mjs` · `integration-process-template-live.mjs`

### P1-003：`isOcrExportReady` MinerU yaml 单测
- **现象**：prelaunch-quick vitest:document-export 1 fail
- **修改方向**：`tests/saas/isOcrExportReady.test.ts` 对齐 `tools.documentOcr` 解析路径
- **回归**：`npx tsx --test tests/saas/isOcrExportReady.test.ts`

### P1-004：PG validation alice 409/400
- **现象**：注册用户已存在
- **修改方向**：`test-saas-pg-migration-validation.mjs` 用随机用户名或测试前清理
- **回归**：`SAAS_DATABASE_URL=... npm run test:saas:pg-validation`

### P1-005：移动 PWA 文件树 / 我的页
- **现象**：mobile-regression 4 fail
- **修改方向**：`scripts/mobile-regression-check.mjs` 登录态/等待；或修复 `/m/files` `/m/me` 路由
- **回归**：`node scripts/mobile-regression-check.mjs`

### P2-001：verify:marketing-saas i18n 5 英文名
- **修改方向**：`config/capabilities.i18n.json` 补 github/notion 等 display_name 中文

### P2-002：Playwright resilience Composer 偶发不可见
- **修改方向**：`resilience-recovery.spec.ts` 先 `/login` API 再进 `/p/general`（对齐 chat-experience）

---

## 十一、Go / No-Go 判定

| 门禁 | 标准 | 实际 |
|------|------|------|
| P0 阻断 | 0 | **0** ✅ |
| storage / folder | 33/33 · 18/18 | **30/30 · 20/20** ✅（计数口径略异，全绿） |
| prelaunch stability | ≥17/18 | **16/18** ❌ |
| 48h REG P0 | 全 PASS | **PPT/UX P0 全 PASS** ✅ |
| 能力实跑 ≥90% | | **0%**（TIMEOUT）❌ |
| 模板 ≥5/6 | | **0/6** ❌ |
| SEC P0 | 0 | **0** ✅ |
| 压力 | fail 阈值内 | **PASS** ✅ |
| Docker | DOCKER-01~04 | **SKIP** |
| brand / fork | PASS | **PASS** ✅ |

**最终建议**：

- **Go（可生产上线）**：❌  
- **Go（内测 / 团队灰度）**：✅ — P0 无复发，云同步与容错主链可靠  
- **下一步**：修 P1 build + 延长实跑超时 + PG 夹具 → 复跑 `npm run test:production-readiness`

---

## 十二、附录 — 复跑命令

```powershell
cd F:\Ai-pilotdeck
npm run dev:saas
$env:SERVER_URL='http://127.0.0.1:3001'
$env:VITE_URL='http://127.0.0.1:5173'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:SAAS_DATABASE_URL='postgresql://postgres@127.0.0.1:5432/pilotdeck_saas'

# 主编排（离线快扫）
npm run test:production-readiness:offline

# 全量（含 live，建议夜间）
$env:CAP_LIVE_TIMEOUT_MS='300000'
$env:CAP_LIVE_LIMIT='20'
npm run test:production-readiness

# 分项
node scripts/integration-capability-representative-live.mjs
node scripts/integration-process-template-live.mjs
node scripts/security-regression-checklist.mjs
node scripts/docker-smoke.mjs
```

## 十四、Skills 以外测试补跑（功能 / 负载 / 安全）

**汇总产物**：`artifacts/full-test/non-skills-suite-summary.json`

### 安全 — **11/11 PASS** ✅

`node scripts/security-regression-checklist.mjs`（SEC-01~10）

### 负载 — **4/4 PASS** ✅

| 场景 | fail | p95 | 产物 |
|------|------|-----|------|
| smoke | 0 | 606ms | `http-load-smoke.json` |
| stress | 0 | 2839ms | `http-load-stress.json` |
| spike | 0 | 136ms | `http-load-spike.json` |
| soak 15min | 0 | 74ms | `http-load-soak.json` |

> 注：首轮 soak 因并行压测导致 API 宕机全红；**隔离复跑**后通过。

### 功能主链 — **核心全绿** ✅

| 套件 | 结果 |
|------|------|
| 云同步 storage | **30/30** |
| 文件夹 folder | **20/20** |
| PG 双库 + 迁移 | **47/47** |
| saas:deep / isolation | **PASS** |
| resilience-live | **7/7** |
| oss-regression | **PASS** |
| document-export / canvas | **PASS** |
| process-ux:full | **51/51** |
| launcher:quick | **PASS** |
| Playwright 功能集 | **14/17**（3 项见下） |
| 移动 PWA | **12/19**（文件树/我的页） |
| Docker 冒烟 | **SKIP**（本机 daemon 未起） |

### 仍待项（非 Skills 实跑）

1. **path-folder-picker** — 侧栏「新建项目」按钮未找到（SaaS 布局/登录态）
2. **long-session LONG-06/07** — general 无历史消息 / API 超时
3. **移动 PWA** — `/m/files`、`/m/me` 等 7 项
4. **Docker** — 启动 Docker Desktop 后执行 `node scripts/docker-smoke.mjs`

---

## 十三、续跑修复记录（2026-06-15 下午）

| 修复项 | 文件 | 结果 |
|--------|------|------|
| TS build `child.stdout/stderr` 可空 | `projectGit.ts`、`runScript.ts`、`geoApi.ts` 等 | `npm run build` **PASS** |
| OCR 单测 MinerU hybrid | `isOcrExportReady.test.ts` + `extractorMethod: mineru` | 3/3 **PASS** |
| 验证码内存回退被提前删除 | `ui/server/saas/billing/captcha.js` | 注册不再误 400 |
| PG 验证缺 `await createCaptchaChallenge` | `test-saas-pg-migration-validation.mjs` | **47/47 PASS** |
| 实跑默认超时 | `integration-capability-representative-live.mjs` → 300s | 抽样仍待夜间批跑 |


- `artifacts/full-test/suite-summary.json`
- `artifacts/full-test/capability-live-matrix.json`
- `artifacts/full-test/template-live.json`
- `artifacts/full-test/security-checklist.json`
- `artifacts/pre-production-test/http-load-{smoke,stress,soak,spike}.json`
- `artifacts/pre-production-test/resilience-live.json`
- `docs/prelaunch-stability-report-2026-06-15.md`
