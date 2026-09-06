# Launch Registry QA Report — 2026-06-10

## 范围

Track A：`html-ppt` 整包 vendor + Hub 单卡  
Track B：`launch-registry.json` 首版仅 `html-ppt`（`launch_mode: visual`）

## Tier 0 — 静态 / 单元

| 检查 | 结果 |
|------|------|
| `npm run launch:check` | 通过（1 条 registry） |
| `npm run launch:audit` | 通过，`docs/launch-registry-audit.md` 已生成 |
| `npm run capabilities:gen` | 通过（876 skills，html-ppt 含 `launch_mode: visual`） |
| `npm --workspace ui exec vitest run src/shared/launchRouting.test.ts src/shared/capabilityTryBridge.test.ts` | 9/9 通过 |
| `npm run smoke:capability-try-prompts` | 通过（412/412，html-ppt 提示词已去禁用后缀） |
| `npm run check:saas-fork` | Launch 相关条目通过；`GatewayWsClient.ts` 缺 marker 为既有项（非本次引入） |

## Tier 2 — Launch 专项 Smoke

| 项 | 结果 | 说明 |
|----|------|------|
| L1 Hub 隔离 | 通过 | 4 个 skip slug（open-design / anth-docx / 社媒矩阵 / 国内社媒发布）无 LaunchSheet |
| L2 html-ppt 开 Sheet | 通过 | 营销飞轮「创意内容」→ 搜索 html-ppt → Sheet 可见 |
| L3 取消关闭 | 通过 | 关闭后 `[data-testid=launch-sheet]` 不可见 |
| L8 流程模板 | 通过 | 流程模板 Tab try 不触发 LaunchSheet |

命令：`npm run smoke:launch`（编排 L1 + L2/L3/L8）

## 关键修复（本轮回）

1. **`launchRouting.ts`**：浏览器端 `process.env` 未定义导致 Launch 路由抛错 → 改用 `import.meta.env` + 安全 `process` 守卫。
2. **`resolveLaunchModeForSlug`**：Hub 缓存缺 `launch_mode` 时从 bundled catalog 回退。
3. **`capabilities.js`**：API 响应合并 `launch_mode` 等字段。
4. **`capabilityHubTaxonomy.mjs`**：`html-ppt` 归营销飞轮「创意内容」，Hub 可检索。
5. **embedded try 路径**：`MainContent` / `ChatInterfaceV2` / `CapabilityHub` 统一走 `requestCapabilityLaunch`。

## 二期 registry 扩展

`npm run launch:audit`「建议登记」表为空；新 skill 须人工 A/B/C 评审后逐条写入 `config/launch-registry.json`，勿批量 auto-seed。

## 截图

- `artifacts/launch-smoke/L1-hub-isolation.png`
- `artifacts/launch-smoke/L2-html-ppt-sheet.png`

## 未跑项（需完整 dev + Agent）

- Tier 3 E2E Agent happy path（产出 HTML deck）
- Tier 1 P1–P4 全量 Playwright（建议合并前按 `docs/smoke-playwright-report-*.md` 流程补跑）
