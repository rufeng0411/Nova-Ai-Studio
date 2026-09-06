# 创意场景先生图（Prefer generate_image）验收

Flag：`PILOTDECK_PREFER_GENERATE_IMAGE=off|shadow|enforce`（dev/pack/Gateway 默认 **shadow**）

单核意图：`src/saas/media/creativeGenerateImageIntent.ts`  
回滚：`PILOTDECK_PREFER_GENERATE_IMAGE=off` 后重启 Gateway/Launcher。

## 全 A 三原则

| 原则 | 条款 | 门禁 |
|------|------|------|
| 质量 | 创意案必有生图尝试；官图零冒充 | L2 A/B；`forbid_violation=0` |
| 速度 | 旁路创意 auto-VAP；生图封顶；禁问卷 | L2；不因缺装饰图 repair |
| 兼容 | official/OKR/矩阵不回归 | L0 + `smoke:od-skills` |

## L0–L4（KPI）

| 级 | 命令 | 标准 | 实数（回填） |
|----|------|------|----------------|
| L0 | `npx vitest run …`（intent/flags/resolver/applyGateway/degrade/orchestrator/recoveryHints） | 全绿 | **PASS 42/42**（2026-08-03） |
| L1 | `npm run smoke:od-skills`；`rg PILOTDECK_PREFER_GENERATE_IMAGE` 四处 | 命中且默认 shadow | **PASS** od-skills 31；pack/apply-cloud/devLauncher/applyGatewayMediaEnv 均 `shadow` |
| L2 | `npm run test:prefer-generate-image:gate`；四案实机 `node --import tsx scripts/run-prefer-generate-image-four-cases-live.mjs --gate`（`PREFER_STRICT_PNG=1`） | A/D：gen≥1 **且盘内非空 PNG + HTML 引用**；B forbid=0；C gen=0；false_incomplete=0 | **复测 ALL PASS（2026-08-03 晚，strict PNG）**：A `generate_image=2` + `hero.png`(843KB)/`main-visual.png`(962KB) + HTML 引用（146s）；B `forbid=0`/`gen=0`/`vap_or_fetch=2`（146s）；C `gen=0`+HTML（114s）；D `generate_image=2` + `hero.png`(593KB) + HTML 引用（167s）；`false_incomplete=0`。报告 `artifacts/prefer-generate-image/four-cases-live-report.json` |
| L3 | 同脚本 `--billing-case` | 硬失败文案，非无标注 CSS 假绿 | **PASS**（hint 含 authentication/billing，无 inline SVG） |
| L4 | telemetry / 本表 | 生产观察通过后方可写实数 | _未观察（shadow 发版后回填）_ |

## 发版

- Hotfix 可带 **shadow** 代码。
- **enforce** 仅 L2 绿后开启。
- 未跑 L2 不得宣称用户体感已修复。

## 报告

离线/live 报告：`artifacts/prefer-generate-image/live-gate-report.json`
