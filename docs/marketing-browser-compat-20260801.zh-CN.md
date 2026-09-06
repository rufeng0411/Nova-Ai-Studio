# 主站主流浏览器兼容验收（2026-08-01）

**BASE**：`http://127.0.0.1:55957`  
**工具**：Playwright `scripts/run-marketing-browser-compat.mjs`  
**截图**：`artifacts/marketing-browser-compat-20260801/`  
**JSON**：`artifacts/marketing-browser-compat-20260801/report.json`

## 引擎映射

| 配置 | 对应用户浏览器 |
|------|----------------|
| chrome-desktop | Google Chrome（Win/Mac） |
| edge-desktop | Microsoft Edge（Win；缺省回退 Chromium） |
| firefox-desktop | Mozilla Firefox（Win/Mac） |
| safari-desktop-webkit | Safari macOS（WebKit 引擎模拟） |
| chrome-android | Chrome Android（Pixel 7） |
| safari-ios-webkit | Safari iOS（iPhone 14 WebKit） |
| safari-ipad-webkit | Safari iPad（iPad Pro 11） |
| firefox-mobile | Firefox 移动视口 |

> Windows 上 **Safari = WebKit 引擎**，与真机 Safari 高度接近但非 100% 等同；发版前建议 Mac/iOS 各抽测装屏。

## 总判定

| 指标 | 值 |
|------|-----|
| 配置数 | 8 |
| PASS 检查 | 144 |
| FAIL 检查 | 0 |
| 裁决 | **VERIFIED** — 主流引擎矩阵全绿 |

## 明细矩阵

| 检查项 | Chrome 桌面（Win/Mac） | Edge 桌面（Win） | Firefox 桌面（Win/Mac） | Safari macOS（WebKit 引擎） | Chrome Android（Pixel 7） | Safari iOS（iPhone 14 WebKit） | Safari iPad（iPad Pro 11 WebKit） | Firefox 移动视口 |
|--------|------|------|------|------|------|------|------|------|
| M-01-home-status | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-02-home-h1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-03-nav | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-04-login-cta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-05-no-h-overflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-06-manifest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-07-service-worker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-08-viewport-meta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-09-jsonld | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-10-contact-form | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-11-geo-page | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-12-docs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-13-seo-files | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-14-no-pageerror | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-15-faq-toc | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-16-legal-modal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-17-showcase | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M-18-showcase-no-h-overflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |


## 检查项说明

| ID | 含义 |
|----|------|
| M-01～M-04 | 首页可达、文案、导航、登录 CTA |
| M-05 | 无横向溢出 |
| M-06～M-08 | PWA manifest / SW / viewport |
| M-09 | 首页 JSON-LD |
| M-10 | 联系表单+验证码字段 |
| M-11 | GEO 页 + FAQPage |
| M-12 | 白皮书 docs |
| M-13 | robots/sitemap/llms |
| M-14 | 无 pageerror |
| M-15 | FAQ + 左栏 TOC + JSON-LD |
| M-16 | 关于我们 75% 弹窗 |
| M-17 | 演示案例壳 |
| M-18 | Showcase 无横向溢出 |

复跑：`npm run test:marketing-site:browsers`
