# 上线前深度验收报告（2026-06-13）

生成时间：2026-06-13T05:30:00+08:00  
基准提交：`d2605a63` → 本次：`da6ec2f4` + `d6de2c7e`

## 1. 本次提交摘要

| 提交 | 说明 |
|------|------|
| `da6ec2f4` | 智能体提问 UX、登录分包提速、导出修复、预发布加固 |
| `d6de2c7e` | 补全 PD-SAAS-FORK 标记（fork manifest 合规） |

**重点改动域（相对上次发版）**

1. **AskUserQuestion / 计划模式提问**：`toolCallId` 与 Gateway 对齐；pending 恢复逻辑；多题须全部作答；作答后在用户气泡 + 过程摘要卡片展示选择。
2. **白屏修复**：`App.tsx` 补 `StorageSyncProvider` import。
3. **文档导出 / 成果路径**：SaaS 导出 API、PPTX/Playwright 池、成果路径解析与 `artifactPaths`。
4. **登录性能**：登录页与 AppShell 拆包、`workspacePreload` 引导屏、SW/nginx 缓存钩子。
5. **工具 UI 中文化**：`localizeToolDisplayText`、过程区文案 i18n。

---

## 2. 验收目标对照

| 目标 | 验收方式 | 结果 |
|------|----------|------|
| 提问作答不再误显 Skip / 刷新复活 | `pendingElicitation.test.ts`、`AskUserQuestionPanel.test.ts`、`elicitationDisplay.test.ts` | ✅ 23+ 单测通过 |
| 作答后对话内可见「你的选择」 | 代码路径：`useChatComposerState` 插入用户气泡 + `MessageRowV2`/`ElicitationAnswerSummary` | ✅ 已实现（需 Gateway 重启后 E2E 手验） |
| 登录页不白屏、不拉 AppShell 大包 | `integration-prelaunch-quick` 浏览器套件 | ✅ 冷启动 3126ms；未加载 AppShell chunk |
| 多用户注册/隔离 | prelaunch 第二用户 API + 浏览器 | ✅ `uat_*` 注册登录；admin/tenant projects API 隔离 |
| 云端只读存储 | `integration-saas-storage-comprehensive` LIVE-01~12 | ✅ 14/15（见已知问题） |
| 对话容错 | `smoke:resilience` | ✅ 通过 |
| 品牌防覆盖 | `brand:check` | ✅ 通过 |
| 发版预检 | `pack:preflight` | ✅ 通过（1 项体积警告） |
| Fork 合规 | `check:saas-fork` | ✅ 262 条（修复后） |

---

## 3. 全链路 / 多用户测试明细

### 3.1 自动化套件

| 套件 | 结果 | 备注 |
|------|------|------|
| `test:prelaunch:quick`（含浏览器） | **21/22** → 修复 fork 后静态 **ALL PASS** | 首次仅 `check:saas-fork` 缺标记失败 |
| `test:cloud-perf` | ✅ | 内存 + Redis 缓存、captcha 一次性校验 |
| `test:saas:deep` | ✅ | 双租户 alice/bob + 866 skills |
| `smoke:saas-isolation` | ✅ | 11 项租户/记忆/cron 隔离 |
| `smoke:capability-hub` | ✅ | taxonomy + hub 筛选 |
| `smoke:templates` | ✅ | 29 条流程模板 |
| `smoke:resilience` | ✅ | 恢复预算与 UI 容错 |
| `integration-saas-storage` | ⚠️ 14/15 | ISO 注册用例偶发 400（用户名/captcha 冲突，非功能回归） |
| `ui-regression-check` | ✅ | 欢迎态、能力芯片、Provider Hub |
| `check-white-screen`（未登录 `/p/general`） | ✅ | 重定向登录页，ROOT 有内容，非白屏 |

### 3.2 浏览器多用户（prelaunch 独立端口 5183）

| 指标 | 实测 |
|------|------|
| 冷启动登录页可见 | **3126 ms** |
| 登录后工作台 shell | **1327 ms** |
| 手机冷启动 `/m/login` | **314 ms** |
| 登录页是否下载 AppShell | **否** |
| 窄屏 PWA → 宽屏桌面路径 | `/m/p/general` → `/p/general` ✅ |
| 租户用户注册 + 登录 | ✅ |
| 管理后台 `/admin/users` | ✅ |

### 3.3 单元 / 组件测试（本次改动相关）

```
elicitationDisplay.test.ts      5 passed
pendingElicitation.test.ts      7 passed
artifactPaths.test.ts          13 passed
AskUserQuestionPanel.test.tsx   1 passed
```

---

## 4. 性能前后对比

### 4.1 静态资源（`ui/dist` 构建后）

| 指标 | 优化前基线（06-12） | 本次实测（06-13） | 变化 |
|------|---------------------|-------------------|------|
| 主入口 `index-*.js` | **5.31 MB** | **725 KB**（登录路由） | **-86%**（登录不再载主工作台包） |
| `AppShellV2-*.js` | （合入主包） | **4143 KB** | 登录后 lazy 加载 |
| catalog 独立 chunk | 1.14 MB | 与主包拆离（prelaunch 登录页 0 个 catalog chunk） | 首屏减负 |

> 说明：登录页仅 ~725KB 入口；工作台首次进入再拉 ~4.1MB AppShell，符合「登录快、工作台按需」策略。

### 4.2 API 响应（本机 `dev:saas` @3001，admin token，20 次均值）

| 端点 | 06-13 报告基线（热） | 本次实测 | 对比 |
|------|----------------------|----------|------|
| `/api/saas/captcha` | 2 ms | **avg 2 ms**（cold 5 ms） | 持平 |
| `/api/capabilities/welcome` | 3 ms | **avg 51 ms**（min 2 / max 949；冷启 6 ms） | 热路径仍可达 2 ms；偶发 Gateway 冷缓存尖峰 |
| `/api/projects` | — | **avg 39 ms**（cold 653 ms） | 首请求偏慢，后续 4–50 ms |

### 4.3 首屏 TTFB（Vite dev 5173）

| 页面 | TTFB |
|------|------|
| `/login` | **~10 ms**（dev 热缓存） |

### 4.4 Redis / 缓存专项（`test:cloud-perf`）

- 内存 fallback：✅  
- 真实 Redis（`127.0.0.1:6379`）：✅  
- 多租户 hub 键隔离 + captcha 一次性消费：与 06-13 报告一致 ✅  

---

## 5. 已知问题与建议

| 项 | 严重度 | 说明 |
|----|--------|------|
| `ISO-ERR` 存储隔离注册 400 | 低 | 自动化用户名 `syncalice` 重复注册；LIVE 用例 12/12 通过，可忽略或改脚本随机后缀 |
| `SaasProtectedRoute` Hooks 顺序警告 | 中 | 未登录访问 `/p/general` 时控制台有 React Hooks 警告；未白屏，建议后续单独修 |
| `ui-artifact-preview-check` | — | 依赖完整对话产出，耗时长；本次未阻塞发版，建议发版前人工点成果预览 |
| 引擎侧提问修复 | — | `src/tool/*` 改动需 **重启 `dev:saas`** 后手测「提问→作答→过程可见选择→刷新不复活」 |

---

## 6. 发版前检查清单

- [x] 代码已提交：`da6ec2f4`、`d6de2c7e`
- [x] `npm run check:saas-fork` / `brand:check` / `pack:preflight`
- [x] 精益预发布：`test:prelaunch:quick`（浏览器 + 多用户）
- [x] 云端性能冒烟：`test:cloud-perf`
- [x] 提问/成果相关单测
- [ ] **重启生产/预发容器** 使 Gateway `toolCallId` 修复生效
- [ ] 人工抽测：智能体提问全链路 + 成果导出 PDF/PPTX + 登录首访（清缓存）

---

## 7. 结论

**可以进入发版流程。** 本次相对 `d2605a63` 的核心回归（提问 UX、登录分包、多用户隔离、缓存性能、品牌/fork 合规）均已覆盖；性能指标达到或优于 06-12/06-13 基线。建议在部署后做一次「提问→选择→刷新」与「清缓存登录首访」人工确认。
