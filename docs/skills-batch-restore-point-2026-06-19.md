# Skills/MCP 三批次落地还原点

> 在 2026-06-19 三批次（C1–C7 bump / Firecrawl+Playwright / 法律+UI+新 Pill）落地前创建，用于整批回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `pre-skills-batch-2026-06-19` |
| **提交** | `a4e07f97b19b767b163bfef0a6345986657f49cb` |
| **说明** | 三批次安装前基线：catalog≈877、流程模板 19 条、无 batch-2026-06 vendor 脚本 |

```bash
git show pre-skills-batch-2026-06-19 --no-patch --format="%H %s %ci"
```

## 本批次变更摘要（相对还原点）

| 维度 | 落地后 |
|------|--------|
| 能力目录 | **1223** 项（Hub 可见 **582**；去重 `anth-pdf` 双份） |
| 流程模板 | **31** 条（+`sales-battlecard-full`、`legal-risk-quick`） |
| 新 Pill | 飞轮 **销售赋能**、办公 **法务合规**、教育 **趣味学习** |
| 虚拟 MCP 卡 | `mcp-playwright`（Hub 开发 Tab） |
| Vendor 脚本 | `vendor:firecrawl`、`vendor:batch-2026-06` |
| `capabilities:gen` 顺序 | catalog → try-prompts → i18n（修复示例不同步） |

### 第二期（已完成）

- Firecrawl 10 项 bump（`skills/vendor/firecrawl/fc-*`）
- `web-just-scrape`（just-scrape）
- Playwright MCP 示例配置（`products/_example/config/mcp.json.example`）

### 第三期（已完成）

- 法律代表项 `legal-risk-assessment` / `legal-response` bump
- Lawvable 大包已在仓（`legal-lav-*`、`lpm-*`）
- `create-ui-ux-pro-max`、`create-ai-video-gen`、`edu-fun-caveman`
- `create-frontend-design` 已在 creation-ecosystem

### 第一期 C1–C7（待网络恢复）

GitHub 443/超时导致以下命令**本次未成功**，需重试：

```bash
npm run vendor:html-ppt          # C1
npm run vendor:video-coding      # C2 + C7 remotion
npm run vendor:marketing         # C3 + C4
npm run vendor:skills-ecosystem  # C5 + C6
npm run capabilities:gen
npm run templates:gen
```

## 如何还原

### 仅丢弃本批次未提交改动（保留还原标签）

```bash
git checkout pre-skills-batch-2026-06-19 -- .
git clean -fd skills/vendor/web-scrape skills/vendor/creation-ecosystem/create-ui-ux-pro-max skills/vendor/creation-ecosystem/create-ai-video-gen skills/vendor/education-ecosystem/edu-fun-caveman scripts/vendor-firecrawl.mjs scripts/vendor-batch-2026-06.mjs
```

### 硬回退到还原点（会丢失还原点之后所有本地提交）

```bash
git reset --hard pre-skills-batch-2026-06-19
```

还原后建议：

```bash
npm run capabilities:gen
npm run templates:gen
npm run smoke:capability-hub
npm run smoke:templates
npm run brand:check
```

## 验收命令（本批次已通过）

```bash
node scripts/bootstrap-pilotdeck-config.mjs   # 同步 repo skills → ~/.pilotdeck/skills
npm run capabilities:gen
npm run templates:gen
npm run smoke:capability-hub
npm run smoke:capability-try-prompts
npm run smoke:templates
npm run smoke:skills-batch                  # 目录 + read_skill 运行时
node scripts/integration-capabilities-smoke.mjs
npm --workspace ui exec vitest run src/shared/capabilityTryBridge.test.ts src/shared/capabilityTryPrompt.test.ts
# UI（需 npm run dev:saas，设 VITE_URL 为 banner 端口）：
npm run smoke:skills-batch-ui
```

报告目录：`artifacts/capabilities-smoke/`、`artifacts/launch-smoke/batch-hub-ui.json`

## 已知未决

- `brand:check`：`AuthShell.tsx` 缺 `NOVA_PRODUCT_NAME`（批次前已存在，非本批引入）
- 第一期 bump 依赖 GitHub 连通性
- 法律包 `legal-lav-*` 默认 Hub 隐藏，仅 `legal-risk-assessment` / `legal-response` 对用户可见

## 参考文档

- 批次勾选：`docs/skills-mcp-selected-batch-2026-06-17.md`
- 机器可读：`config/skills-selection-batch.json`
- Vendor 清单：`skills/vendor/batch-2026-06-manifest.json`
