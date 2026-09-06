# 主站正式生产落地 · 整站验收报告（2026-07-30）

## 结论（总评）

| 维度 | 裁决 | 说明 |
|------|------|------|
| L0/L1 门禁 | **VERIFIED** | `test:marketing-site:gate` + `check:saas-fork` 全绿 |
| 访问功能 / 静态全站 | **VERIFIED** | 营销代理 + `deploy/marketing@5501`：`/` `/docs/` `/contact/` `/geo/` `/for-ai/` /PWA 资源 200 |
| SEO / GEO | **VERIFIED** | robots/sitemap/llms/JSON-LD/FAQPage/canonical 门禁 + 浏览器实开 `/geo/` |
| 联系我们 | **VERIFIED** | 蜜罐 204、缺验证码 400、真提交入库；后台列表+标已处理 |
| 登录 / 邀请码注册 | **VERIFIED** | 无码/错码 400；有效码注册发 token；已登录访问 `/login?from=site` → 工作台 |
| 后台统计 / 线索集成 | **VERIFIED** | leads / invite 生成·作废 / analytics PV≥1 |
| PWA / 主流浏览器矩阵 | **VERIFIED** | 8 引擎 ×14 项 = **112/112**；见 `docs/marketing-browser-compat-20260730.zh-CN.md` |
| Mac/iOS 真机装屏 | **建议抽测** | WebKit 引擎已绿；真机 Safari「添加到主屏幕」发版前点一次即可 |
| 生产首页切流（Bridge `/`） | **部分** | 当前 Launcher 默认 `PILOTDECK_MARKETING_SITE=false`，`/` 仍为 SPA；**生产 pack 默认 1**；本地验收可用 `PILOTDECK_MARKETING_SITE=1` 重启 |

**可替换生产首页**：代码与 L0–L3 集成已绿；上线保持 `PILOTDECK_MARKETING_SITE=1`。本地若要看见营销 `/`，需显式开 flag 并重启 Bridge。

---

## 证据路径

| 产物 | 路径 |
|------|------|
| 联调 JSON | `artifacts/marketing-site-acceptance-20260730/acceptance-results.json` |
| 脚本 | `scripts/run-marketing-site-acceptance.mjs`（`SERVER_URL=http://127.0.0.1:7990`） |
| 静态预览 | `http://127.0.0.1:5501/`（`deploy/marketing`） |
| Bridge | `http://127.0.0.1:7990`（API）/ UI `8081` |

复跑：

```bash
npm run test:marketing-site:gate
npm run check:saas-fork
SERVER_URL=http://127.0.0.1:7990 npm run test:marketing-site:live
# 先起静态：npx serve deploy/marketing -p 5501 -L
MARKETING_BASE_URL=http://127.0.0.1:5501 npm run test:marketing-site:browsers
```

---

## 1. 访问功能与 PWA / 多端兼容

### 1.1 页面可达（营销代理强制 SITE=1）

联调 **42/42 PASS**，含：

- `/` `/docs/` `/contact/` `/geo/` `/for-ai/`
- `/llms.txt` `/robots.txt` `/sitemap.xml`
- `/manifest.webmanifest` `/sw.js` `/shared/analytics.js` `/shared/responsive.css`
- 首页四卡文案、JSON-LD、登录 CTA `/login?from=site`

### 1.2 PWA（Chromium @ 5501）

| 检查项 | 结果 |
|--------|------|
| `link[rel=manifest]` | 有 → `Nova Ai-Studio 2.0` / `display=standalone` / icons×3 |
| Service Worker | `navigator.serviceWorker` 注册成功，`active=true`，scope=`/` |
| theme-color / apple-mobile-web-app | HTML meta 齐全 |
| 离线壳 | `sw.js` precache 首页/CSS/JS（HTTP 本地；生产建议 HTTPS） |

### 1.3 响应式 / 移动端

| 环境 | 方法 | 结果 |
|------|------|------|
| PC Chromium | 浏览器实开首页 | Hero / 导航 / CTA 正常 |
| 移动模拟 390×844 | CDP `Emulation.setDeviceMetricsOverride` | `innerWidth=390`，`overflowX=false`，`h1≈35px`，`nav gap=4px`（命中 `responsive.css` ≤720） |
| Pad 断点 | CSS `@media (max-width:1024px)` 存在 | 代码层 VERIFIED；未单独截 Pad |
| Mac Safari / iOS Safari | — | **未实机** → INCONCLUSIVE（建议上线前真机装屏点一次） |

### 1.4 当前 Bridge 首页状态

```
GET http://127.0.0.1:7990/ → SPA shell（marketingHero=false）
public-flags: MARKETING_SITE=false, CONTACT/ANALYTICS/INVITE=true
```

devLauncher 默认关营销站属预期；验收静态用 5501 / 代理；生产 `pack.mjs` 默认 `PILOTDECK_MARKETING_SITE=1`。

---

## 2. SEO / GEO

| 检查 | 结果 |
|------|------|
| `check:marketing-seo` | PASS |
| robots → Sitemap | 含 `sitemap.xml`；Allow `/geo/` `/for-ai/` |
| sitemap | 首页/docs/contact/geo/for-ai |
| llms.txt | Agent Harness、400+、文档/联系/GEO 深链 |
| 首页 JSON-LD | Organization + SoftwareApplication |
| `/geo/` FAQPage | 浏览器实开；定义列表含 Agent Harness / Token 路由 / 私有化 / 团队协作 |
| 各页 title / description / canonical | 门禁全绿 |

---

## 3. 联系我们 + 登录 / 注册

### 3.1 联系我们（Bridge API）

| 用例 | 结果 |
|------|------|
| 蜜罐 `website` 有值 | **204** 丢弃 |
| 缺验证码 | **400**「请填写图形验证码」 |
| 合法提交（captcha=challenge） | **200** `{ok:true}` 入库 |
| 后台列表 | leads count≥1 |
| 标已处理 | PATCH → `done` |

浏览器：`/contact/` 表单含称呼/邮箱/手机/公司/诉求/验证码/蜜罐；文案「仅入库不发邮件」。

> 纯静态 5501 无 `/api`，验证码按钮显示「刷新」属预期；生产经 Bridge 同源调用。

### 3.2 登录 / 邀请码

| 用例 | 结果 |
|------|------|
| 无邀请码 + 合法验证码 | 400「请填写客服提供的四位邀请码」 |
| 错码 ZZZZ | 400「邀请码无效」 |
| 后台生成码 + 注册 | **token 签发**（例：`mkt_ok_*`） |
| 已登录打开 `/login?from=site` | 进工作台（`/p/general`） |
| 营销 CTA | `href` 含 `/login?from=site` |

---

## 4. 后台集成（访问统计 · 线索 · 邀请码）

| API | 结果 |
|-----|------|
| `GET …/marketing/leads` | 可读，含验收提交 |
| `PATCH …/leads/:id` | 新线索 → done |
| `POST …/invite-codes` | 生成四位码 |
| `POST …/invite-codes/:code/revoke` | 作废成功 |
| `GET …/marketing/analytics?days=14` | `pv≥1`、`series[]`、`uvApprox`、`leads` |

UI 路由已挂：`/admin/marketing-leads` · `/admin/invite-codes` · `/admin/marketing-analytics`（导航「主站」）。图表为 CSS 条形（无 recharts）。

Telemetry：`marketing_contact_submit` / `marketing_page_view` 经 `analytics_events`；PV 明细在 `marketing_page_events`（IP 哈希）。

---

## 5. Flag 与回滚

| Flag | 当前 Bridge | 生产默认 |
|------|-------------|----------|
| `PILOTDECK_MARKETING_SITE` | **0**（dev） | **1** |
| `PILOTDECK_MARKETING_CONTACT` | 1 | 1 |
| `PILOTDECK_REGISTER_INVITE_CODE` | 1 | 1 |
| `PILOTDECK_MARKETING_ANALYTICS` | 1 | 1 |

回滚：`PILOTDECK_MARKETING_SITE=0` → `/` 回 SPA（本机已观测到此态）。

---

## 6. 残留注意

1. **本地要看营销首页**：Launcher/环境加 `PILOTDECK_MARKETING_SITE=1` 后重启。  
2. **Mac/iOS PWA 装屏**：上线后用 Safari「添加到主屏幕」点验（本报告未覆盖）。  
3. **SW precache 版本**：`sw.js` 仍标 `v7` 资源 query；功能可用，后续可与 HTML `?v=9` 对齐升 CACHE。  
4. 验收产生测试用户 `mkt_ok_*` 与线索「验收同学」，可在后台清理。

---

## 附录 · 联调摘要（节选）

```
bridge.health PASS
contact.submit PASS
admin.leads / leads-patch / invite-create / invite-revoke / analytics PASS
register.no-invite / bad-invite / with-invite PASS
static./ … /geo/ … pwa-sw PASS
seo.* PASS
→ 42 pass / 0 fail
```
