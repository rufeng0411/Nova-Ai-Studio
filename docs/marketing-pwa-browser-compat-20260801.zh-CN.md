# 营销站 PWA + 手机版 + 浏览器兼容检查（2026-08-01 晚）

## 总判：**GATE PASS**

| 线 | 结果 |
|----|------|
| 静态门禁 | **PASS**（`check:marketing-site` + `check:marketing-seo`） |
| PWA 结构 | **PASS**（manifest + SW `nova-product-site-v14` + viewport/theme） |
| 浏览器/手机矩阵 | **PASS**（8 profiles × 18 项 = **144/144**） |
| 关于我们弹窗 | **PASS**（M-16 全引擎打开 75% 弹窗，正文 ≥255 字） |

命令证据：

```bash
npm run check:marketing-site          # PASS
npm run check:marketing-seo           # PASS
npm run test:marketing-site:browsers  # 144 pass / 0 fail / GATE PASS
```

明细报告：[`docs/marketing-browser-compat-20260801.zh-CN.md`](marketing-browser-compat-20260801.zh-CN.md)  
截图/JSON：`artifacts/marketing-browser-compat-20260801/`

---

## PWA 审计

| 项 | 状态 | 说明 |
|----|------|------|
| `manifest.webmanifest` | OK | name / short_name / start_url / display=standalone / theme `#0a0a0a` / icons |
| `sw.js` | OK | CACHE=`nova-product-site-v14`；precache 含 `legalModal.js?v=3`、`site.js?v=25`、Showcase 壳 |
| 注册 | OK | `shared/site.js` 在带 manifest 的页注册；activate 清旧 cache |
| 导航策略 | OK | navigate network-first；跳过 `/login` `/api` `/app` |
| Apple | OK | viewport-fit=cover；首页/Showcase 有 apple-mobile-web-app 标签 |
| 缺口（P1 记债） | 可选 | icon 复用同一 PNG 多 sizes；无独立 512 maskable 专用图；manifest `lang` 单语 zh-CN |

---

## 浏览器 / 手机矩阵

| Profile | 代表浏览器 | 结果 |
|---------|------------|------|
| chrome-desktop | Chrome Win/Mac | 18/18 |
| edge-desktop | Edge Win | 18/18 |
| firefox-desktop | Firefox | 18/18 |
| safari-desktop-webkit | Safari macOS（WebKit） | 18/18 |
| chrome-android | Chrome Android Pixel 7 | 18/18 |
| safari-ios-webkit | Safari iPhone 14 | 18/18 |
| safari-ipad-webkit | Safari iPad Pro 11 | 18/18 |
| firefox-mobile | Firefox 移动视口 | 18/18 |

检查项：

| ID | 含义 |
|----|------|
| M-01～M-05 | 首页可达、文案、导航、登录 CTA、无横向溢出 |
| M-06～M-08 | PWA manifest / SW / viewport |
| M-09～M-11 | JSON-LD、联系表单+验证码、GEO |
| M-12～M-14 | docs、robots/sitemap/llms、无 pageerror |
| M-15 | FAQ + 左栏 TOC |
| M-16 | 关于我们 75% 弹窗 |
| M-17～M-18 | Showcase 壳 + 无横向溢出 |

> Windows 上 Safari = Playwright WebKit，与真机高度接近但非 100% 等同；发版前建议 Mac/iPhone 各抽测一屏。

---

## 手机版要点

- 全矩阵移动/平板 profile：**无横向溢出**（首页 + Showcase）
- FAQ 在窄屏 TOC 可渲染（M-15）
- 法律弹窗在 iPhone / Android / iPad 均可打开（M-16；窄屏 CSS 约 94vw × 82vh）
- 联系页图形验证码字段在移动端存在（M-10）

---

## 复跑

```bash
npm run test:marketing-site:browsers
# 或指定已运行的营销站：
# MARKETING_BASE_URL=http://127.0.0.1:5501 npm run test:marketing-site:browsers
```
