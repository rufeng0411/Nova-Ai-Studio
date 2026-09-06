# Showcase 管理端 i18n 与落地设计摘要（2026-08-01）

PR1 范围：演示案例静态站接入营销主站 `/showcase/`，全案子页 HTML 壳 ASCII 化，界面中文由 `fullcase-viewer.js` 注入；同步脚本 `scripts/showcase/sync-to-marketing.mjs` 为唯一拷贝入口。

## 关键决策

| 项 | 决策 |
|----|------|
| 壳层语言 | 全案 HTML **文件内禁止中文**（UTF-8 仅 ASCII 可见文案）；`SHELL_COPY` + `applyShellCopy()` 按 `locale()` 写 DOM |
| 英文路由 | `location.pathname.startsWith('/en/')` → `en`，否则默认 `zh` |
| 营销路径 | 全案页 `/shared/tokens.css` + 相对 `shared/fullcase.css`；返回链 `/showcase/#fullcase` |
| 资源版本 | 静态资源统一 `?v=15`（与 PR1 bump 对齐） |
| 主站导航 | Showcase `index.html` 使用营销 `shell.css` 顶栏：主页 / **演示案例（current）** / 文档 / 对比 / FAQ / 联系 / 登录 |
| 目录 href | 部署副本 `catalog.js` 中 `./` 前缀改为 `/showcase/`；`index.html` 加 `<base href="/showcase/" />` |

## Feature flags（规划，PR1 未接 Bridge）

| Flag | 默认 | 说明 |
|------|------|------|
| `PILOTDECK_SHOWCASE_ADMIN` | off | 后台编辑 Showcase 条目（后续 PR） |
| `PILOTDECK_SHOWCASE_DATA_ROOT_OVERLAY` | off | 允许从 `DATA_ROOT` 只读覆盖 catalog/fullcases |
| `VITE_MARKETING_SHOWCASE_NAV` | on（打包） | 主站展示「演示案例」入口 |

## DATA_ROOT overlay（后续 PR，PR1 仅文档契约）

- **权威源**：仓库 `artifacts/saas-design/demos-showcase/shared/{catalog,fullcases}.js`
- **可选覆盖**：`$DATA_ROOT/marketing/showcase-overlay/`（JSON 或 JS 模块），Bridge 读盘 merge 后写 Redis 缓存；**禁止**写回租户 `cloud-storage`
- **回滚**：关 `PILOTDECK_SHOWCASE_DATA_ROOT_OVERLAY` 即回静态包；运维不手改 `deploy/marketing/showcase/`

## §1A Motion tokens（与主站一致）

Showcase 滚动/ Pill 动效复用 `deploy/marketing/shared/tokens.css`：

- `--ease: cubic-bezier(0.22, 1, 0.36, 1)`
- `--dur-fast: 180ms` · `--dur: 280ms` · `--dur-slow: 420ms`
- `prefers-reduced-motion: reduce` 时 deck 面板切换瞬时完成（`site.js` 已有分支）
- 禁止 Showcase 单独引入第二套 duration / 霓虹 spring

## 禁止项

- HTML 壳内写中文或依赖服务端 SSR 翻译
- 在 `deploy/marketing/showcase/` 手改后不跑 sync（会被覆盖）
- 用户可见文案出现 PilotDeck / OpenBMB / 面壁 / AGPL
- 全案页再注册 Service Worker（viewer 启动时 unregister）
- 用 emoji 或紫粉霓虹作强调（遵循 `deploy/marketing/DESIGN.md`）

## 验收命令

```bash
node scripts/showcase/write-fullcase-shells.mjs
node scripts/showcase/sync-to-marketing.mjs
```

本地预览：营销根静态服 + `/showcase/`；artifacts 独立服 `5511` 时全案壳的 `/shared/tokens.css` 需与主站同源或临时代理。