# Nova Ai-Studio 品牌守护与防覆盖指南

> 本仓库为 PilotDeck 上游的 SaaS fork。**对用户可见的品牌已永久改为 `Nova Ai-Studio`。**
> 每次拉取/合并上游核心代码后，品牌 logo 与品牌文字**必须保留 Nova 版本，不得被上游 PilotDeck 覆盖**。

## 一句话流程（每次合并上游后必做）

```bash
npm run brand:check        # 校验品牌是否完好；失败会逐条列出要修的地方
```

- 通过 → 品牌完整，无需处理。
- 失败 → 按下方「恢复步骤」修复，再次 `npm run brand:check` 直到通过。

## 品牌定义

| 项 | 值 |
|----|-----|
| 品牌名 | `Nova Ai-Studio` |
| 原品牌名（需替换） | `PilotDeck` / `OpenBMB PilotDeck` |
| Logo 源图 | 仓库根 `logo-3.png`（蓝色 N） |
| 资产生成 | `npm run brand:assets`（= `node scripts/generate-nova-brand-assets.mjs`） |
| 能力中心重生成 | `npm run capabilities:gen` |
| 校验 | `npm run brand:check`（= `node scripts/check-nova-brand.mjs`） |
| 清单 | `config/nova-brand.manifest.json`（资产 + 文本守卫断言 + i18n 规则） |

## 防覆盖机制（三层）

1. **`.gitattributes` 合并策略**：品牌二进制资产（favicon / logo / PWA 图标 / wordmark / banner / manifest.json / logo-3.png）标记为 `merge=ours`，合并时自动保留本仓版本。
   - **每个克隆需一次性启用驱动**：
     ```bash
     git config merge.ours.driver true
     ```
   - 未启用时该策略不生效；务必先执行一次。
2. **文本守卫断言**：`config/nova-brand.manifest.json` 的 `textGuards` 记录了每个可见品牌文案所在文件与精确字符串（`expect` 必须存在 / `forbid` 必须消失）。`brand:check` 会逐条校验，定位被上游改回 PilotDeck 的文件。
3. **i18n 值扫描**：`brand:check` 解析 `ui/src/i18n/locales/**/*.json`，只检查字符串**值**是否混入 `PilotDeck` / `OpenBMB`（忽略 JSON 键与 `~/.pilotdeck` 路径）。

## 恢复步骤（brand:check 失败时）

1. **资产类失败**（`[asset]`）：
   ```bash
   npm run brand:assets
   ```
2. **能力中心文案失败**：先确认 `skills/pilotdeck-skills-migration/SKILL.md` 与 `scripts/generate-capabilities-i18n.mjs` 仍为 Nova，再：
   ```bash
   npm run capabilities:gen
   ```
3. **文本守卫失败**（`[guard]` / `[i18n]`）：打开报告中列出的文件，把 `forbid` 的 PilotDeck 文案改回对应的 `Nova Ai-Studio`（参考 `expect` 字符串）。

## 已覆盖的可见品牌面（25 处文本守卫 + 15 个资产）

- **HTML/PWA**：`ui/index.html`、`ui/public/manifest.json`、`ui/public/sw.js`（缓存号统一 `?v=nova1`）
- **Web UI**：侧边栏、登录/注册/onboarding、聊天占位符、设置与项目删除提示、**loading 动画**（`AuthLoadingScreen` 用 Nova logo 替代 MessageSquare）
- **i18n**：`ui/src/i18n/locales/{en,zh-CN}/*.json` 的可见值
- **服务端**：通知标签、终端欢迎、Ready 横幅、PR 落款、CLI 帮助、`/help` 命令
- **TUI**：`PilotDeckLogo`（NOVA + Ai-Studio）、`PromptInput`、`HelpDialog`、`ChannelCommandRegistry`
- **能力中心**：技能迁移卡（catalog / i18n 由生成脚本产出）

## 红线（rebrand 永不触碰，也不会被 brand:check 误报）

> 这些是系统标识，改了会破坏运行/数据/兼容；只换"显示给用户看的文字"。

- provider slug `pilotdeck`
- 配置/数据路径 `~/.pilotdeck`、`.pilotdeck/…`、`pilotdeck.yaml`
- CLI 命令名 `pilotdeck`
- 代码标识符：`PilotDeckConfig`、`getPilotDeck*`、`usePilotDeckConfig`、`PilotDeckWorkStatus`、`PilotDeckSettings` 等
- 后端用量限额匹配正则（`chatFormatting.ts` 中 `PilotDeck usage limit reached`）
- 引擎 `src/**` 内部类名/注释/日志（非用户可见）
- i18n JSON 键名（如 `runPilotDeckCli`、`pilotdeck`）
- 包名 `pilotdeck`、`pilotdeck-ui`、GitHub 仓库 URL
