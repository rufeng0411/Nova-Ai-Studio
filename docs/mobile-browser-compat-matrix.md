# Nova Ai-Studio 手机版浏览器兼容矩阵

本文档记录 `/m` 移动壳层在主流与非主流移动浏览器上的 UI / 操作 / 功能兼容策略与验收要点。

## 分层

| 层级 | 浏览器 | 自动化抽样 | 手工验收 |
| --- | --- | --- | --- |
| Tier A 必测 | iOS Safari 17+、Android Chrome、Samsung Internet | Playwright `webkit` + `chromium` | 真机各 1 台 |
| Tier B 高概率 | 微信内置浏览器、UC/夸克、Firefox Mobile | 手工 | 分享链接打开 `/m` |
| Tier C 长尾 | Opera Mini、旧版 WebView | 降级策略文档 | 按需 |

## 功能兼容清单

| 能力 | 风险 | 策略 | 验收 |
| --- | --- | --- | --- |
| 视口高度 `100dvh` / `--vvh` | iOS 软键盘、地址栏跳动 | `useMobileViewport` + `.mobile-vvh-shell` + `-webkit-fill-available` fallback | 键盘弹出 TabBar 隐藏、Composer 可见 |
| Safe area | 刘海、PWA standalone | `viewport-fit=cover` + Header/TabBar padding | 横竖屏无遮挡 |
| `backdrop-filter` 毛玻璃 | 旧 Android、部分微信 | 不支持时降级 `bg-sidebar` 不透明 | Header/TabBar 可读 |
| 触控目标 ≥44px | 全部 | `.mobile-touch-target`、Composer `h-11`、成果栏 `min-h-[44px]` | `mobile-regression-check` 断言 |
| 成果栏底 sheet | iOS 点击穿透 / 滚动锁 | `openMobileDeliverablesSheet` + `mobile-bottom-sheet` + body `position:fixed` 锁滚动 | 点击成果栏弹出「成果清单」表 |
| 惯性滚动 | iOS | `.mobile-scroll-touch` / `-webkit-overflow-scrolling: touch` | 长列表顺滑 |
| 能力中心卡片 | 双列 truncate 难读 | 手机双列无 icon 小卡 `mobile-grid` + 分组 L2/L3 标签 | 能力名换行、分组可读 |
| 流程模板 | 双列挤压标题/步骤 | 单列 `mobile-template-card` + 步骤竖排 | 模板标题与 outcome 可读 |
| PWA 安装 | 仅 Chromium | `beforeinstallprompt` + iOS 分享引导 | InstallPrompt 两分支 |
| Service Worker | 微信常禁用 | 离线页降级，不阻断主流程 | 微信内可登录对话 |
| WebSocket | 企业代理 | 断线重连已有 | 前后台切换恢复 |

## UI 走查页面（移动壳层）

- 对话：Composer 工具行间距、发送钮、**成果栏点击展开清单 sheet**
- 能力中心：搜索 icon、**仅 L1 大类 Tab**（无 L2/L3 导航条）、**卡片区 L2/L3 分组标签**、双列小卡无 icon
- 文件：单栏树、行高
- 我的：分组卡片、子页返回
- 登录 `/m/login`：表单与按钮触控
- 320px 宽：导航横滑、Composer 不溢出

## 自动化

```bash
node scripts/mobile-regression-check.mjs
```

默认跑 `chromium` + `webkit`（可用 `MOBILE_ENGINES=chromium` 仅跑单引擎）。

截图：`artifacts/ui-theme-preview/mobile-touch-*.png`

## 已知限制

- 微信内置浏览器：PWA 安装与 SW 离线不可用，核心 SPA 功能须可用
- Opera Mini：极端省流模式可能禁用部分 CSS，毛玻璃已降级
- 后台 `/m/admin`：故意桌面守卫，非兼容缺陷
