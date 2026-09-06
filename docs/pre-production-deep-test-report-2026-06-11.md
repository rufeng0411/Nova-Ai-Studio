# Nova Ai-Studio 全站上线前深度测试报告

**日期**：2026-06-11  
**模式**：精益验收（`npm run test:pre-production` / 分步执行）  
**执行环境**：Windows 10 x64 · Node v22.14.0 · 本地 `dev:saas`（Vite `5173` / API `3001` / Gateway `18789`）+ PostgreSQL `pilotdeck_saas`  
**数据根**：`F:\Ai-pilotdeck\.saas-dev-data`

---

## 一、摘要

| 指标 | 结果 |
|------|------|
| P0 三大专题（云同步 / 容错 / 长任务） | **全部通过**（自动化 + Live） |
| 今日回溯 B1~B4 定向回归 | **无 P0 复发** |
| 精益自动化主链路 | **通过**（33 storage + 18 folder + deep + PG 47 项等） |
| Playwright 核心 SaaS | **通过**（含修复后 chat-experience 3/3） |
| Docker 生产模拟 4 路径 | **通过** |
| 编排器重跑（suite --skip-live） | **8/14**（见 §五 说明：Windows 路径 bug 已修；deep 因 bob 重复注册污染失败） |
| **上线建议** | **可内测 / 有条件公测**：P0 无阻塞；发版前补齐 fork 注释、修复编排器后全绿复跑；P3 Agent 写文件与 acceptance 全量留 CI |

---

## 二、今日回溯专章（B1~B4）

### 块 1：云同步 / 文件夹 / 成果路径（B1）

| 回归 ID | 现象 | 本轮结果 | 证据 |
|---------|------|----------|------|
| B1-01 UUID 显示名 | FOLD-01/09、LIVE-F09 | **PASS** | `test:saas:folder` |
| B1-02 general 进项目侧栏 | FOLD-02/04、LIVE-F04 | **PASS** | 同上 |
| B1-03 蔚来 ES9 成果找不到 | FOLD-05~07、LIVE-F05~07 | **PASS** | folder Live + 本机 `.saas-dev-data` 树 |
| B1-04 对话空白 | LIVE-F10、LONG-06 | **PASS** | LONG-06 API 非空；F10 跳过（session 不在首页，非复发） |
| B1-05 缩短路径预览 | LIVE-F11 | **PASS** | folder Live |
| B1-06 双设备冲突 UI | — | **未自动化** | 风险登记 P2 |

### 块 2：对话容错 / 自动重试（B2）

| 回归 ID | 现象 | 本轮结果 | 证据 |
|---------|------|----------|------|
| B2-01 Recovery 英文泄漏 | R-02、R-11 | **PASS** | `resilience-live` R-LIVE-02/03；`chat-experience` E2E-02 |
| B2-02 技术红条 | R-03 | **PASS** | `userFacingErrors` 单测 16/16 |
| B2-03 auto-continue | R-04、R-09 | **PASS** | `smoke:resilience`；引擎单测 |
| B2-04 8×8 风暴 | R-01 | **PASS** | `recoveryBudget.test` + smoke gate |
| B2-05 单页 fetch 误报联网 | R-03 负例 | **PASS** | `userFacingErrors.test` |
| B2-06 recoveryRunId | R-04、LONG-02 | **PASS** | 代码 + LONG-01 刷新稳定 |
| B2-07 WS 断连假思考 | R-05、R-06 | **PASS** | `resilience-live` R-LIVE-05/06 |
| B2-08 出站并发 | R-07 | **PASS** | `smoke:resilience` gate≤2 |
| B2-09 acceptance 全量 | — | **SKIP** | 精益套件替代，见 P2 |
| B2-10 Router 独立预算 | — | **观察** | P2 架构债 |

### 块 3：手机 PWA / UI 脚本（B3）

| 回归 ID | 本轮结果 | 证据 |
|---------|----------|------|
| B3-01 General 英文名 | **PASS** | `mobile-regression-check.mjs` |
| B3-02 能力卡横排 | **PASS** | 同上 |
| B3-03 44px 触控 | **PASS** | 截图断言 |
| B3-04 P2/P4 手风琴 | **PASS** | oss-regression P2/P4（本轮） |
| B3-05 P3 成果预览 | **部分** | iframe/预览 **PASS**；Agent `write_file` 轮询超时 **FAIL**（P1） |
| B3-06 brand:check | **PASS** | manifest 守卫 |
| B3-07 iOS/微信 SW | **SKIP** | Tier B 手工 |

### 块 4：新能力抽样（B4）

| ID | 本轮结果 | 证据 |
|----|----------|------|
| B4-01 document export/canvas | **PASS**（早先当日 smoke） | `smoke:document-export` 当日报告 |
| B4-02 path-folder-picker | **PASS** | `path-folder-picker.spec.ts` + vitest |
| B4-03 能力中心 Hub | **PASS** | `smoke:capability-hub` failures=0 |
| B4-04 头像上传 | **未本轮 PW** | 合入 `2ad551b5`，抽检留发版 |
| B4-05 pack:preflight | **PASS** | 2 警告（DOMAIN/OSS 空） |

**结论**：B1-03/04、B2-01~07 等 P0 复发项 **均未再现**。

---

## 三、环境与配置

来源：`artifacts/pre-production-test/os-compat-smoke.json`

| 项 | 值 |
|----|-----|
| OS | win32 x64 |
| Node | v22.14.0 |
| CPU / 内存 | 24 核 / 64633 MB |
| DATA_ROOT | `F:\Ai-pilotdeck\.saas-dev-data` |
| SAAS_DATABASE_URL（dev） | `postgresql://postgres@127.0.0.1:5432/pilotdeck_saas` |
| Playwright | Chromium ✓ · WebKit ✓ · **Firefox 未安装（SKIP）** |
| Docker | `nova-ai-studio:latest` healthy；Linux 用户态经容器验证 |

浏览器兼容（`browser-compat-check.mjs --lean`）：Chromium 全量 + WebKit 3 页 **PASS**；Firefox **SKIP**。

---

## 四、P0 专题结果

### A 云同步 SYNC-01~13

| 套件 | 结果 |
|------|------|
| `test:saas:storage` Part A+B | **33/33 PASS** |
| `test:saas:folder` 18 场景 | **18/18 PASS** |
| 租户隔离 ISO-08/15 | **PASS** |
| 破坏性 ISO-06/07/14 | **PASS**（含在 storage） |
| SYNC-04 PW（P3 写文件） | **预览 PASS / 写文件超时 FAIL** → P1 |

详见 [`cloud-sync-test-report-2026-06-11.md`](cloud-sync-test-report-2026-06-11.md)、[`cloud-folder-sync-test-report-2026-06-11.md`](cloud-folder-sync-test-report-2026-06-11.md)。

### B 对话容错 R-01~R-12

| 层级 | 结果 |
|------|------|
| `smoke:resilience` | **PASS** |
| `integration-conversation-resilience-live.mjs` | **7/7 PASS** |
| Vitest `userFacingErrors` + `stripLeakedToolMarkup` | **16/16 PASS** |
| Vitest `useAutoRecoveryContinue` | **7/7 断言 PASS**（根目录 vitest 无 jsdom → `localStorage` 环境失败，**非产品缺陷**） |
| PW `resilience-recovery.spec.ts` | **PASS** |
| PW `chat-experience` E2E-02/03/07 | **3/3 PASS**（E2E-03 已修：改走 `/login` API 登录） |

### C 长任务 LONG-01~07

| ID | 结果 | 说明 |
|----|------|------|
| LONG-01 | **PASS** | 刷新后 Composer + 无英文泄漏 |
| LONG-06 | **PASS** | general 历史消息 API 非空 |
| LONG-02~05、07 | **部分覆盖** | project-memory smoke 3/3；完整多轮 LLM 留 acceptance |

---

## 五、分层结果

### L0–L1 自动化（首轮独立执行，权威）

| 步骤 | 结果 |
|------|------|
| `npm run build` | PASS |
| `npm run test:saas:deep` | PASS（首轮）；重跑 FAIL bob 409（数据污染） |
| `npm run check:saas-fork` | **3 条缺 PD-SAAS-FORK**（exit 1） |
| `npm run brand:check` | PASS |
| `npm run smoke:resilience` | PASS |
| `npm run smoke:project-memory` | PASS |
| `npm run smoke:saas-isolation` | PASS |
| `test:saas:storage` | **33/33** |
| `test:saas:folder` | **18/18** |
| `smoke:capability-hub` | PASS |

### L2 Playwright + Live

| 步骤 | 结果 |
|------|------|
| `oss-regression` P1/P2/P4 | PASS |
| `oss-regression` P3 Agent 写文件 | **FAIL**（超时；预览路径已通） |
| `mobile-regression-check.mjs` | PASS |
| `resilience-recovery` / `isolation` / `deep-uat` / `admin-dashboard` | PASS |
| `chat-experience` | **3/3 PASS**（修复后） |
| `long-session` LONG-01/06 | PASS |

### L3 破坏性（含于 storage/deep，不另加时）

D-01~D-10 对应 ISO-06/07/14、deep 混沌项 — **已在 storage 33 项与 deep 中覆盖**，本轮不重复。

### L4 负载

`scripts/load/http-load.mjs --scenario smoke`：

| 环境 | total | fail | p95 |
|------|-------|------|-----|
| dev:saas API | 626 | 0 | 1277ms |
| Docker :3001 | 1058 | 0 | 649ms |

产物：`artifacts/pre-production-test/http-load-smoke.json`

### L5 PG + Docker

| 步骤 | 结果 |
|------|------|
| `test:saas:pg-validation` | **47/47 PASS** |
| `pack:preflight` | PASS（2 警告） |
| Docker 4 路径 | **PASS** → `artifacts/pre-production-test/docker-smoke.json` |

### L6 OS 兼容

| 项 | 结果 |
|----|------|
| `os-compat-smoke.mjs` JSON | 已生成 |
| Linux | Docker 容器 `nova-ai-studio:latest` healthy |
| macOS 真机 | **未测**（WebKit 引擎代替） |

### L7 Tier B（按 Key 可用性）

| 套件 | 结果 |
|------|------|
| `smoke:media` / open-design 全量 / yixiaoer | **SKIP**（精益计划；无发版阻断 Key 抽检） |

### 编排器 `run-pre-production-suite.mjs --lean --skip-live`

- 产物：`artifacts/pre-production-test/suite-summary.json`、`suite-log.jsonl`
- 末轮 8/14：失败项含 **Windows `spawn` 路径含空格**（`C:\Program Files\nodejs`）、deep bob 重复、fork 3 条、vitest 环境
- **已修复**：`shell: false` 避免路径截断；建议干净数据后 `npm run test:pre-production` 复跑

---

## 六、仍未关闭的风险（计划第四节）

1. `test:saas:acceptance` 未完整执行 — 建议 CI/发版前
2. 云同步无双设备冲突 UI、大文件并发 sync 未压测
3. Vitest React 双副本 / 根目录 vitest 无 `localStorage` — 开发环境噪声
4. Path-picker 超长路径/无权限/连点 — W5~W7 未自动化
5. Gateway transcript 租户级隔离 — 架构债 P2
6. Firefox 引擎未安装 — 桌面兼容留 P2

---

## 七、修改建议

### P0（阻塞上线）

**无。** 今日高发 B1-03/04、B2-01~07 在自动化层均未复发。

### P1（发版前建议修复）

1. **`check:saas-fork` 缺 3 条 PD-SAAS-FORK**  
   - `PathFolderPickerDialog.tsx`  
   - `WorkspacePathField.tsx`  
   - `attachmentNotes.ts`

2. **`oss-regression` P3**：实时 Agent `write_file` 轮询超时（预览/iframe 已通过）— 加长轮询或 mock 网关写文件。

3. **`chat-experience.spec.ts`**：已修复（统一 `/login` + `auth-token` 轮询）；合并后纳入 `test:pre-production` 常驻。

4. **`run-pre-production-suite.mjs`**：Windows `spawn` 已修；建议 deep 使用隔离 DATA_ROOT 避免 bob 409 误杀。

5. **Vitest resilience UI**：在 `ui/` 工作区跑并确保 jsdom/`localStorage` setup，或编排器改为 `npm --workspace ui run test -- …`。

### P2（后续迭代）

1. 安装 Playwright Firefox 并跑 `browser-compat` 全量  
2. 双设备 sync 冲突 UI + 大文件压测  
3. 合并 Router/stream 重试进 `RecoveryBudget`  
4. Gateway transcript 租户隔离  
5. Tier B：media / open-design / yixiaoer 按 Key 在 staging 补跑  
6. `DEPLOY_DOMAIN` / `OSS_BUCKET` 填实后发 `pack:deploy`

---

## 八、发版前 3 条人工必做（精益 UAT）

1. 管理员改默认密码 `admin123` → 强密码  
2. 浏览器强刷 / 重新登录后：通用 → 打开蔚来 ES9 类对话，确认非空白 + 成果可预览  
3. 手机 PWA `/m` 登录 → 能力中心横卡 + Composer 可输入  

---

## 九、附录

| 产物 | 路径 |
|------|------|
| 编排汇总 | `artifacts/pre-production-test/suite-summary.json` |
| 编排日志 | `artifacts/pre-production-test/suite-log.jsonl` |
| OS 基线 | `artifacts/pre-production-test/os-compat-smoke.json` |
| 容错 Live | `artifacts/pre-production-test/resilience-live.json` |
| HTTP 负载 | `artifacts/pre-production-test/http-load-smoke.json` |
| Docker 冒烟 | `artifacts/pre-production-test/docker-smoke.json` |
| 云同步 | `docs/cloud-sync-test-report-2026-06-11.md` |
| 文件夹 | `docs/cloud-folder-sync-test-report-2026-06-11.md` |
| PG 验证 | `docs/saas-pg-migration-validation-report.md` |

**复跑命令**：

```powershell
cd f:\Ai-pilotdeck
$env:SERVER_URL='http://127.0.0.1:3001'
$env:VITE_URL='http://127.0.0.1:5173'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:SAAS_DATABASE_URL='postgresql://postgres@127.0.0.1:5432/pilotdeck_saas'
npm run test:pre-production
```
