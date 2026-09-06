# Nova Ai-Studio 手机版 PWA 验收报告（2026-06-11）

按《手机版 PWA 设计开发计划》完成阶段 0–5 全部交付。本报告覆盖功能清单、回归结果与截图位置。

## 一、交付范围

### 阶段 0 — 设计稿（已选定 V1）
- 3 版 HTML Sketch：`artifacts/mobile-design/v1-glass-dock.html` / `v2-floating-pill.html` / `v3-graphite-minimal.html`（含 `index.html` 总览）
- 选定 V1「玻璃 Dock」风格作为实现基准

### 阶段 1 — 移动壳层与导航
- `ui/src/mobile/MobileTabBar.tsx`：底部 4 Tab（对话 / 能力 / 文件 / 我的），毛玻璃 + safe-area
- `ui/src/mobile/MobileHeader.tsx`：移动顶栏（抽屉按钮 + 标题 + 新会话）
- `ui/src/mobile/MobileAdminBlock.tsx`：`/admin/*` 移动守卫（提示请用桌面端）；侧栏「后台管理」入口移动端隐藏
- `ui/src/mobile/useMobileViewport.ts`：`visualViewport` 键盘避让（`--vvh` 变量 + 键盘弹出时隐藏 TabBar）

### 阶段 2 — 对话移动化
- Composer 吸底 + 紧凑边距；消息流 `max-md` 边距优化
- 模板 Hub 弹窗 → 移动端 Bottom Sheet（全宽、顶部圆角、拖拽柄）
- WebSocket `visibilitychange` 回前台静默重连

### 阶段 3 — 能力中心与流程模板移动版
- 三级导航（L1 Tab / L2 步进 / L3 Pill）横滑不换行，触控目标加大
- 能力卡触控高度 ≥44px；搜索框移动端全宽

### 阶段 4 — 我的页 / 文件只读 / 轻量页面
- `ui/src/mobile/MobileMeScreen.tsx`：头像资料、本月用量摘要卡（Token / 次数 / 费用，复用 `saasApi.myUsage`）、个人资料 / 记忆 / 计划任务子页、主题与语言快切、设置、退出
- `ui/src/mobile/MobileTasksScreen.tsx`：跨项目计划 + 定时任务只读列表（运行中任务仅提供停止）
- 文件 Tab 移动端单栏全宽：聊天分栏隐藏、无拖拽把手（`MainContent.tsx`）
- 文件只读浏览：工具栏隐藏新建/上传/删除（保留下载/刷新/折叠）、长按菜单禁用、行高 ≥44px（`FilesV2.tsx`）
- 编辑器移动端只读：CodeMirror `readOnly` + 保存按钮隐藏 + 桌面快捷键提示隐藏（`CodeEditor.tsx` / `CodeEditorHeader.tsx` / `CodeEditorFooter.tsx`）
- 设置弹窗在移动端本就全屏（`h-full w-full` + `md:` 降级），租户项裁剪沿用既有 SaaS 逻辑

### 阶段 5 — PWA 增强
- `manifest.json`：新增 `shortcuts`（新对话 `/?tab=chat`、能力中心 `/?tab=discover`）
- `?tab=` 深链：`useProjectsState.readPersistedTab` 优先读 URL 参数
- iOS 启动屏：`scripts/generate-nova-brand-assets.mjs` 新增 8 个主流 iPhone 尺寸 splash（`ui/public/splash/`），`index.html` 注册 `apple-touch-startup-image`，并登记 `config/nova-brand.manifest.json`（资产 15 → 23）
- 安装引导：`ui/src/mobile/InstallPrompt.tsx`（Android `beforeinstallprompt` 一键安装 / iOS 分享引导，一次性、可关闭记忆）
- 离线页：`ui/public/sw.js` 导航失败回退 Nova 品牌中文离线页（深浅色自适应），缓存名 bump `nova-v3`

## 二、回归结果

### 移动视口回归（`node scripts/mobile-regression-check.mjs`，390×844）
| 检查项 | 结果 |
| --- | --- |
| 移动 Header 渲染 / 无桌面 chrome | PASS |
| 底部 TabBar 4 项 | PASS |
| Composer 可见可用 | PASS |
| 能力中心渲染（五 Tab 文案） | PASS |
| 文件树单栏全宽 / 无可见拖拽把手 | PASS |
| 我的页（用量卡 + 行项 + 退出） | PASS |
| `/admin` 移动守卫 | PASS |
| `?tab=discover` 深链 | PASS |
| manifest shortcuts ×2 / splash 资产 200 | PASS |

阶段 4 专项（文件只读 + 计划任务）：文件全屏预览打开、编辑面 0 个 contenteditable、保存按钮隐藏、计划任务子页渲染 — 全部 PASS。

### 桌面 P1–P4
| 项目 | 命令 | 结果 |
| --- | --- | --- |
| P1 白屏 | `node scripts/check-white-screen.mjs "http://127.0.0.1:5173/p/general"` | PASS（登录页正常渲染，401 为未登录预期） |
| P2 欢迎态 + Provider Hub | `node scripts/ui-regression-check.mjs` | PASS（脚本已更新：能力接入中心改为折叠手风琴，需先展开再数「拉取模型列表」按钮） |
| P3 成果预览 | `node scripts/ui-artifact-preview-check.mjs` | PASS（脚本已更新两处：① SaaS dev 模式 general 项目根在 `.saas-dev-data/tenants/default/`，补充文件轮询路径；② 文件落盘早于助手回合结束，folder card 改为带重载的 90s 轮询） |
| P4 蚁小二 | `node scripts/ui-yixiaoer-regression-check.mjs` | PASS（脚本已更新：设置内蚁小二段落为折叠手风琴，先展开再查字段） |

### 守卫
- `npm run brand:check`：PASS（23 资产、27 文本守卫、i18n 干净；本次修复 3 条过期守卫指向 + 2 条 i18n 残留 PilotDeck 文案）
- `npm run check:saas-fork`：PASS（manifest 150 条全部验证）

## 三、UI 细节精修（2026-06-11 增补）

按 V1「玻璃 Dock」设计稿对 `/m` 移动壳层做美学与 UX 遍历精修：

| 区域 | 改动摘要 |
| --- | --- |
| 导航 / General | `projectLabels.ts` 隐藏 `general` 英文名；移动 Header 无会话时显示「智能体」；抽屉去掉「项目/General」分段，合并为「智能体对话 + 项目」列表 |
| 能力中心 | 独立全宽搜索条（`searchPlaceholderMobile`、44px 触控高度）；L1 纯文字 seg pills；L2 下划线 stage；2 列竖向能力卡含「试一下 →」 |
| 对话 / 文件 / 我的 | 消息区与 Composer `px-3.5`；文件行高 48px；我的页分组卡片圆角与边距对齐 sketch |
| 样式 token | `index.css` 增补 `.mobile-hub-*` 组件类；`mobileHubStyles.ts` 导出常量 |

移动回归新增断言：Header 不含 General、`.mobile-hub-seg-row`、移动搜索 placeholder、`.mobile-hub-cap-card` 数量。

精修截图：`mobile-polish-*.png`（与 `mobile-final-*.png` 并存）。

## 四、截图（`artifacts/ui-theme-preview/`）
- `mobile-polish-chat.png` / `mobile-polish-hub.png` / `mobile-polish-files.png` / `mobile-polish-me.png` — UI 精修后截图
- `mobile-final-chat.png` — 对话 Tab（移动壳层 + Composer）
- `mobile-final-hub.png` — 能力中心移动版
- `mobile-final-files.png` — 文件只读单栏
- `mobile-final-me.png` — 我的页（用量摘要 + 行项）
- `mobile-final-admin-block.png` — 后台移动守卫
- `mobile-stage4-me.png` / `mobile-stage4-tasks.png` / `mobile-stage4-files.png` / `mobile-stage4-file-open.png` — 阶段 4 专项
- 设计稿截图见 `artifacts/mobile-design/`

## 五、fork / 品牌登记
- `config/pilotdeck-core-fork.manifest.json` 新增 UI 精修条目（`projectLabels.ts`、`CapabilityHubCategoryNav` mobile layout、`CapabilityCard` mobile variant 等）
- `config/nova-brand.manifest.json`：splash ×8 进资产清单；过期守卫修正（AuthShell 用 `NOVA_PRODUCT_NAME` 常量、SidebarV2 wordmark alt、重启文案移至 `PlatformOpsSections.tsx`）

## 六、触控与浏览器兼容精修（2026-06-11 第二轮）

用户反馈：能力卡片竖向改版画蛇添足，恢复极简横排；系统性放大触控间距；补浏览器兼容。

| 区域 | 改动 |
| --- | --- |
| 能力卡片 | 撤销 `variant=mobile` 竖向卡，恢复 icon+名称横排（仅 `max-md:min-h-[44px]`） |
| Composer | 工具行 `gap-3`、按钮 44px、发送/停止 44px |
| 壳层菜单 | Header/TabBar/抽屉会话行/模板弹层/预览工具栏触控加大 |
| 浏览器 | `backdrop-filter` 降级、`-webkit-fill-available`、`search` 去 iOS 默认样式；文档 `docs/mobile-browser-compat-matrix.md` |
| 回归 | `mobile-regression-check.mjs` 增 webkit 引擎 + 触控尺寸断言；截图 `mobile-touch-*.png` |

## 七、遗留与建议
- iOS 真机（Safari）键盘避让与启动屏建议在实机上抽查一轮（模拟视口已验证逻辑）
- 安装引导条首次出现延迟 6s，可按运营需要调整 `SHOW_DELAY_MS`
- 记忆面板移动端复用桌面 `MemoryPanel`（可编辑）；如需严格只读可后续加 `readOnly` 变体
