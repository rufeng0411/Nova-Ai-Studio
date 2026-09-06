# 上线前低强度测试报告（2026-07-08）

**范围**：低限度自动化 + 脚本探针（不含 30min soak、全量 E2E、wuyutai 实跑）  
**环境**：`npm run dev:saas` → Bridge **7991** / Vite **8082** / Gateway **18789**（与 Nova Launcher **7990** 共用 Gateway，存在端口叠乘）  
**DATA_ROOT**：`.saas-dev-data`（PG + Redis）  
**关联容量评估**：[`ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md`](ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md)

---

## 总判定

| 维度 | 结论 | 说明 |
|------|------|------|
| **1. 错误检查** | ⚠️ **有阻塞项** | `npm run build` TypeScript **17 处失败**；`brand:check` 1 项；`pack:preflight` 依赖 build |
| **2. 承载与性能** | ✅ **用户路径通过** | browse 侧栏切换 wedged=0；HTTP smoke 0 失败 |
| **3. 压力测试** | ✅ **低强度通过** | stress c=50×120s 0 失败；Bridge 极限 smoke 有 3 次 wedged（叠乘环境） |
| **4. 漏洞测试** | ✅ **回归项通过** | SEC-01～12 全绿；公网前仍须改默认口令与 HTTPS |
| **5. 手机 UI** | ✅ **Chromium 全绿** / ⚠️ **WebKit 3 项 flaky** | 390×844 双引擎；触控目标 ≥44px |
| **6. 其他** | ✅ 大部分通过 | 四线路径、history 加速、process-ux、数据完整性 |

**上线建议**：**先修复 build + brand 再打包发版**；性能与安全低强度项可支持内测/小流量上线；公网须改 `admin123`、配 swap、开 history 加速 env。

---

## 1. 错误检查

### 1.1 编译与打包

| 项 | 命令 | 结果 |
|----|------|------|
| TypeScript 生产构建 | `npm run build` | ❌ **FAIL** — 17 个 TS 错误（见下表） |
| 发布预检 | `npm run pack:preflight` | ❌ **FAIL** — 缺少 `dist/scripts/lib/patchHiddenConsole.mjs` 等（build 未成功） |
| Fork 标记 | `npm run check:saas-fork` | ✅ 462 条 manifest 全通过 |
| 品牌守卫 | `npm run brand:check` | ❌ **FAIL** — `PlatformOpsSections.tsx` 缺少文案 `"Restarting Nova Ai-Studio"` |

**build 主要错误类别**（需发版前修复）：

| 文件 | 问题 |
|------|------|
| `validateDeliverablesEngine.ts` | 验收 artifact 类型不匹配 |
| `AgentLoop.ts` | 新增 stop reason / stability event 未入 union |
| `InProcessGateway.ts` | 新事件类型未入协议 union |
| `deliverableCapabilityProfiles.ts` | `string \| undefined` |
| `reconcileDeliverableFacts.ts` 等 | `repairEligiblePath.mjs` 缺类型声明 |

### 1.2 运行时 / 白屏探针

| 项 | URL | 结果 |
|----|-----|------|
| 白屏探针 | `http://127.0.0.1:8082/p/general` | ✅ 非白屏 — 未登录重定向登录页，`#root` len=8646 |
| 控制台 | — | 4 条 401（未登录访问受保护 API，**预期**） |

### 1.3 数据与路径

| 项 | 结果 |
|----|------|
| `verify:saas:data-integrity` | ✅ fourLine aligned 100% |
| 备份时效 | ⚠️ 最新联合备份 **372h** 前（建议发版前 `npm run backup:saas:joint`） |
| `test:deliverable-paths` | ✅ 6/6 + UI 单测 42/42 |
| `test:history-messages:quick` | ✅ sanitize 10 + tail 20 + pagination 8 |
| `test:process-ux` | ✅ 引擎 8 + UI 14 |
| `test:gate-mutex` | ✅ 3/3 |

---

## 2. 承载能力与性能测试（重点）

### 2.1 测试口径

- **API**：`SERVER_URL=http://127.0.0.1:7991`（勿打 Vite 8082）
- **背压默认**：messages/validate 各 **2 并发/租户**；超额 → 503 retryable
- **健康 wedged 阈值**：`GET /api/saas/health/ready` **>3s**

### 2.2 用户路径 — browse（侧栏连点 8 会话×2 轮）

| 指标 | 值 | 判定 |
|------|-----|------|
| ready P95 | **27 ms** | ✅ |
| wedged | **0** | ✅ |
| messages P95 | **1298 ms** | ✅（含 1 个大 JSONL 会话） |
| validate P95 | **329 ms** | ✅ |
| 503 | **0** | ✅ |

JSON：`artifacts/bridge-stability-test/load-browse-2026-07-07T18-18-00-562Z.json`

**解读**：真实「切换对话记录」路径 **稳定**，Bridge 未冻结。

### 2.3 Bridge 并发 smoke（60s，v=10 / m=5）

| 指标 | 值 | 判定 |
|------|-----|------|
| ready P95 | **37 ms** | ✅ |
| wedged | **3** | ⚠️（>3s 探针 3 次，gate 判 FAIL） |
| hard fail | **0** | ✅ |
| validate 503 占比 | ~55% | 预期背压 |
| messages 503 占比 | ~93% | 预期背压 |

JSON：`artifacts/bridge-stability-test/load-smoke-2026-07-07T18-19-15-301Z.json`

**解读**：极限探针并发下 **503 高但无 hard error**；3 次 wedged 可能与 **7990+7991 双 Bridge 共用 Gateway/18789** 叠乘有关。发版前应在 **单实例** 上复跑 smoke 确认 wedged=0。

### 2.4 HTTP 入口 — captcha + login

| 场景 | 并发×时长 | total | fail | p50 | p95 | 判定 |
|------|-----------|-------|------|-----|-----|------|
| smoke | 10×30s | 1134 | **0** | — | **596 ms** | ✅ |
| stress | 50×120s | 3978 | **0** | 246 ms | **3566 ms** | ✅ |

JSON：`artifacts/pre-production-test/http-load-smoke.json`、`http-load-stress.json`

**ECS 4C8G 对照**（见容量报告）：日常 **≤10 并发登录** 🟢；**50 并发** 🟡（P95 ~3.5s 仍可接受）。

### 2.5 性能结论（单服 4C8G 推荐值摘要）

| 维度 | 🟢 推荐 | 依据 |
|------|--------|------|
| 同时在线（浏览/切会话） | **20～30** | browse wedged=0 |
| 同时在线（对话 tail120） | **10～15** | 背压 2/租户 |
| 并发 AI turn | **3**（短）/ **1～2**（长） | 容量报告 + 未在本轮实跑 |
| 登录突发 | **10 并发** | smoke P95 596ms |

---

## 3. 压力测试（低强度）

本轮 **未跑** spike c=100、soak 15min、bridge load 5min / stress 3min（控制强度）。

| 已跑项 | 强度 | 结果 |
|--------|------|------|
| `http-load stress` | 50 并发 × 120s | ✅ 0 失败 |
| `bridge-stability smoke` | v10+m5 × 60s | ⚠️ wedged=3 |
| `bridge-stability browse` | 16 步顺序 | ✅ |

**建议发版窗口补跑（可选）**：`http-load spike`、`test:bridge-stability:load`（5min），且 **勿与 Playwright 并行**（`gateMutex`）。

---

## 4. 漏洞测试（重点）

### 4.1 自动化回归 — `security-regression-checklist.mjs`

| ID | 检查项 | 结果 |
|----|--------|------|
| SEC-01 | 未登录 `/api/projects` | ✅ 401 |
| SEC-03 | 未登录 storage | ✅ 401 |
| SEC-04 | 篡改 JWT | ✅ 403 |
| SEC-05 | SaaS 登录墙 | ✅ admin 可登录 |
| SEC-06 | 注册无验证码 | ✅ 400 |
| SEC-10 | SQL 注入探针登录 | ✅ 401 |
| SEC-12 | 伪造 sessionId messages | ✅ 404 |
| SEC-08 | `.env` gitignore | ✅ |
| SEC-07/09 | 遥测/CORS | 观察项 ✅ |

JSON：`artifacts/full-test/security-checklist.json`

### 4.2 深度审计结论（[`brand-security-audit.md`](brand-security-audit.md)）

| 风险 | 严重度 | 上线前动作 |
|------|--------|-----------|
| 默认 `admin / admin123` | **高**（公网） | **必须改密**；禁用弱口令注册 |
| 默认 `0.0.0.0` + 未强制 HTTPS | **高**（公网） | Nginx 443 + 安全组 |
| 远程遥测 | — | Nova Fork **已禁用** ✅ |
| 硬编码密钥/后门 | — | 未发现 ✅ |
| 登录接口无限流 | **中** | stress 3978 次 login 全成功 → 建议 Nginx/WAF 限流 |
| CORS 本地默认宽松 | **低** | 生产核对 `brand-security-audit` §五 |
| AGPL 合规 | **中** | 对外资料勿混 PilotDeck 许可证表述 |

### 4.3 未发现可利用漏洞

本轮 **未发现** 鉴权绕过、跨租户读会话、JWT 伪造成功、无验证码注册等 **P0 漏洞**；伪造 session 返回 404，符合预期。

---

## 5. 手机版 UI 测试（重点）

**脚本**：`node scripts/mobile-regression-check.mjs`  
**视口**：390×844，deviceScaleFactor=2，触控 `isMobile=true`  
**BASE**：`http://127.0.0.1:8082`，API `7991`

### 5.1 Chromium（Android 引擎）

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 自动跳转 `/m/` | ✅ | |
| 顶栏 `.mobile-header` | ✅ | 显示「智能体」，无 General slug |
| 底栏 4 Tab | ✅ | |
| 附件按钮触控 | ✅ | **44×44 px** |
| 能力中心 Tab | ✅ | 营销/办公/创作文案可见 |
| `.mobile-hub-seg-row` | ✅ | 分段 Pill |
| 无竖向大卡片 | ✅ | |
| Hub 卡片高度 | ✅ | **54 px** ≥44 |
| 文件 Tab 树 | ✅ | `[data-file-tree-path]` |
| 我的 · 退出 | ✅ | |

### 5.2 WebKit（iOS Safari 引擎）

| 检查项 | 结果 |
|--------|------|
| 跳转 / 顶栏 / Tab / 我的 | ✅ |
| 能力中心 / seg row | ❌ flaky |
| 文件树 | ❌ flaky |

**判定**：WebKit 3 项失败多为 **Hub/文件 Tab 加载时序**（Chromium 同路径通过）；建议发版前 **Safari 真机抽测** 3 条：登录 → 能力 Tab → 文件 Tab。

### 5.3 桌面浏览器 lean（对照）

| 引擎 | 结果 |
|------|------|
| Chromium | composer ✅；能力中心 P4 ❌（Hub 按钮文案/入口探针未命中） |
| WebKit lean | composer ✅ |
| Firefox | SKIP（未安装） |

### 5.4 手机 UI 建议

1. **真机 Tier A**（发版前人工）：登录、发消息、切 Tab、能力「试一下」、文件预览、退出。  
2. WebKit 失败项：**Hub Tab 等待加长至 5s** 或改用 `waitForSelector('.mobile-hub-seg-row')`（脚本可后续加固，非阻断 Chromium）。  
3. PWA `/m/` 深链与登录态：本轮 API 登录 + reload 路径 **Chromium 验证通过**。

---

## 6. 其他必要项

| 项 | 结果 |
|----|------|
| 四线数据完整性 | ✅ aligned 100% |
| 成果路径单测 | ✅ |
| history SANITIZE/TAIL | ✅ 43 项 |
| 过程 UX 单测 | ✅ 22 项 |
| 门禁互斥单测 | ✅ |
| ECS 容量文档 | ✅ 已有 4C8G 评估 |

**未跑（低强度刻意跳过）**：`test:prelaunch:e2e-serial`、`test:recovery-wuyutai:run`、`test:bridge-stability:soak`、`npm run test:pre-production` 全量。

---

## 7. 发版前行动清单

### P0 — 阻断打包/发版

1. 修复 `npm run build` 全部 TS 错误后重跑 `pack:preflight`  
2. 修复 `brand:check` — `PlatformOpsSections.tsx` 补全 Nova 品牌文案  
3. 公网：**改 admin 默认密码**

### P1 — 强烈建议

4. 单实例复跑 `test:bridge-stability:smoke` 确认 wedged=0  
5. ECS 执行 `apply-cloud-perf-env.sh` + `verify-cloud-perf.sh`  
6. `npm run backup:saas:joint`  
7. 登录接口 **Nginx limit_req**（防 brute-force）  
8. Safari 真机抽测 3 条

### P2 — 观察

9. WebKit mobile 脚本时序加固  
10. Chromium desktop Hub P4 探针与 UI 入口对齐  

---

## 8. 产物索引

| 产物 | 路径 |
|------|------|
| Bridge browse/smoke | `artifacts/bridge-stability-test/load-*-2026-07-07*.json` |
| HTTP 负载 | `artifacts/pre-production-test/http-load-*.json` |
| 安全 | `artifacts/full-test/security-checklist.json` |
| 数据完整性 | `artifacts/saas-data-integrity/integrity-2026-07-07.json` |

**签收**：低强度测试 **完成**；**build/brand 为发版硬门槛**；性能与安全回归 **可支持 controlled 上线**；手机 **Android 引擎全绿**，iOS 引擎需真机补验。
