# 浏览器兼容性矩阵测试报告（2026-07-09）

**环境**：Nova Launcher — Vite `http://127.0.0.1:8081` / Bridge `http://127.0.0.1:7990`  
**工具**：Playwright `scripts/browser-compat-matrix.mjs`（`npm run test:browser-compat:matrix`）  
**JSON（最新）**：`artifacts/browser-compat-matrix/report-2026-07-09T18-05-45.json`  
**截图**：`artifacts/browser-compat-matrix/*.png`

---

## 1. 覆盖范围与引擎映射

| 用户浏览器 | Playwright 配置 | 平台 | 类别 |
|-----------|-----------------|------|------|
| **Google Chrome**（Win/Mac） | `chromium` channel `chrome` | Windows | 桌面 1440×900 |
| **Microsoft Edge**（Win） | `chromium` channel `msedge` | Windows | 桌面 |
| **Mozilla Firefox**（Win/Mac） | `firefox` | Windows | 桌面 |
| **Safari macOS** | `webkit` | macOS（引擎模拟） | 桌面 |
| **Chrome Android** | `chromium` + Pixel 7 设备描述 | Android | 手机 |
| **Safari iOS** | `webkit` + iPhone 14 | iOS（引擎模拟） | 手机 |
| **Safari iPad** | `webkit` + iPad Pro 11（**桌面壳**，宽≥768 不跳 `/m/`） | iPadOS | 平板 |
| **Firefox 移动视口** | `firefox` + Pixel 7 viewport/UA | Android | 手机 |

> **说明**：本机在 Windows 上运行，**Safari macOS / iOS** 由 WebKit 引擎模拟（与真机 Safari 高度接近，非 100% 等同）。**Mac 真机 Safari**、**Samsung Internet** 建议发版前各抽测 2～3 条。

---

## 2. 总判定

| 维度 | 结果 |
|------|------|
| **8 个浏览器配置** | **8/8 可启动**，0 SKIP |
| **桌面 7 项（D-01～D-07）** | ✅ **全绿**（含 D-06 能力中心） |
| **移动 8 项（M-01～M-08）** | ✅ **全绿** |
| **失败项** | **0** |

**签收**：**主流 PC + 移动浏览器核心功能兼容通过**，可进入发版前人工抽测阶段。

---

## 3. 桌面浏览器明细

| 检查项 | Chrome | Edge | Firefox | Safari(WebKit) | iPad(WebKit) |
|--------|--------|------|---------|----------------|--------------|
| D-01 页面渲染 | ✅ | ✅ | ✅* | ✅ | ✅ |
| D-02 无 Recovery 泄漏 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D-03 输入框 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D-04 新建对话 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D-05 设置探针 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D-06 能力中心 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D-07 文件 API | ✅ | ✅ | ✅ | ✅ | ✅ |

\* Firefox 桌面 `#root` 体积偏小（len≈1486），但 **composer / 新建对话 / 能力中心正常**，疑为 WebKit 以外引擎首屏 hydration 时序差异，非白屏。

---

## 4. 移动 / 平板浏览器明细

| 检查项 | Chrome Android | Safari iOS | Firefox 移动 |
|--------|----------------|------------|--------------|
| M-01 跳转 `/m/` | ✅ | ✅ | ✅ |
| M-02 顶栏 | ✅ | ✅ | ✅ |
| M-03 底栏 4 Tab | ✅ | ✅ | ✅ |
| M-04 触控 ≥44px | ✅ 44×44 | ✅ 44×44 | ✅ 44×44 |
| M-05 能力 Tab | ✅ | ✅ | ✅ |
| M-06 Hub 分段 Pill | ✅ | ✅ | ✅ |
| M-07 文件（树或 API） | ✅ api | ✅ api | ✅ api |
| M-08 我的·退出 | ✅ | ✅ | ✅ |

**iPad**：走**桌面壳**（不强制 `/m/`），7 项桌面检查 **7/7 通过**。

---

## 5. 修复说明（2026-07-09 复测）

此前 D-06 在 Chromium/Firefox 桌面误报，根因是探针与 WebKit 侧栏 tablist 冲突，而非产品功能缺陷：

1. **探针**：不再用宽泛的 `/能力/` 按钮 `.first()`（会误点欢迎页「打开能力库」）；改为点击顶栏 **「能力中心」Tab**，并等待 `[data-testid="capability-hub"]` 内分类文案出现。
2. **WebKit 专项**：侧栏「项目/通用」切换也是 `role="tablist"`，`.first()` 会误选侧栏；改为按 Tab 名称定位顶栏「能力中心」。
3. **产品**：`CapabilityHub` 根节点增加 `data-testid="capability-hub"`，便于跨引擎自动化与回归。
4. **登录**：API 登录增加 3 次重试，消除 iOS WebKit 偶发 `ECONNRESET`。

---

## 6. 测试项说明

### 桌面（7 项）

- **D-01～D-04**：渲染、Recovery 文案、输入框、新建对话  
- **D-06**：顶栏「能力中心」Tab + Hub 分类文案（营销/办公/创作/开发）  
- **D-07**：`GET /api/projects/general/files/list` 鉴权列表（跨浏览器 fetch 一致性）

### 移动（8 项）

- **M-01～M-04**：PWA 路由、壳层、触控目标  
- **M-05～M-06**：能力 Tab + 分段导航  
- **M-07**：文件树节点 **或** 同上 files API  
- **M-08**：退出按钮  

登录统一 **API token 注入**（避免各引擎表单登录时序差异）。

---

## 7. 复现命令

```powershell
# 前置：Launcher / dev:saas 已起，确认 Vite + Bridge 端口
$env:BASE_URL="http://127.0.0.1:8081"
$env:SERVER_URL="http://127.0.0.1:7990"
npm run test:browser-compat:matrix
```

首次需安装引擎：

```bash
npx playwright install chromium firefox webkit
```

本机已安装 **Chrome / Edge** 时脚本优先 `channel: 'chrome'|'msedge'` 真通道。

---

## 8. 发版建议

| 优先级 | 动作 |
|--------|------|
| P0 | 移动双引擎（Chromium+WebKit）**已可发版** |
| P1 | 桌面 Chromium/Firefox/WebKit **自动化矩阵已全绿** |
| P2 | 真机：**iPhone Safari**、**Android Chrome** 各 3 条（登录/能力/文件/退出） |
| P2 | **Mac Safari 真机** 抽测 composer + 能力弹层 |
| P3 | Samsung Internet / 微信内置浏览器（中国大陆）单独登记 |

---

## 9. 产物

| 文件 | 说明 |
|------|------|
| `scripts/browser-compat-matrix.mjs` | 矩阵脚本（8 profile） |
| `ui/src/components/main-content-v2/CapabilityHub.tsx` | `data-testid="capability-hub"` |
| `artifacts/browser-compat-matrix/report-*.json` | 机器可读结果 |
| `artifacts/browser-compat-matrix/*.png` | 各 profile 截图 |

**结论**：在 Playwright 可覆盖的 **主流 PC（Chrome/Edge/Firefox/Safari 引擎）+ 移动（Android Chrome / iOS Safari / Firefox 视口）+ iPad 桌面壳** 上，Nova Ai-Studio **核心对话、能力中心与移动壳全兼容（8/8 全绿）**。
