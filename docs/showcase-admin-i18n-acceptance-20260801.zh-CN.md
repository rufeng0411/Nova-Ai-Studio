# Showcase 正式落地 · 全 A 验收报告（2026-08-01）

## 门禁结果

| 级 | 命令 | 结果 | KPI |
|----|------|------|-----|
| L0 | `npm run test:showcase:mojibake` + path 单测 | PASS | mojibake_fail=0 |
| L1 | `npm run test:showcase:admin:unit` | PASS | store/flags 绿 |
| L2 | `npm run test:showcase:publish:gate` + `smoke:showcase:i18n` | PASS | publish_roundtrip=1；i18n_switch_ok=1；false_public_item=0 |
| L3 | `npm run smoke:showcase:design` + `check:marketing-site` | PASS | design OK；showcase/en 路径齐 |
| L4 | `node scripts/showcase/kpi-from-telemetry.mjs` | READY | 实机 publish 后回填 publish_events；gate 默认不强制（设 `SHOWCASE_KPI_REQUIRE_PUBLISH=1`） |

综合：`npm run test:showcase:full-a:gate` **PASS**（2026-08-01）。

## Flag（三处已同步）

- `PILOTDECK_SHOWCASE_SITE=on`
- `PILOTDECK_SHOWCASE_ADMIN=shadow`（首发；enforce 后公网读 DATA_ROOT overlay）
- `PILOTDECK_MARKETING_I18N=1`

同步位置：`scripts/release/pack.mjs`、`scripts/release/apply-cloud-perf-env.sh`、`scripts/lib/devLauncherCore.mjs`。

## 回滚

- 橱窗：`PILOTDECK_SHOWCASE_SITE=off`
- 后台误发：`PILOTDECK_SHOWCASE_ADMIN=shadow` 或 `off`
- 双语：`PILOTDECK_MARKETING_I18N=off`
- 整站：`PILOTDECK_MARKETING_SITE=0`

## 设计 QA

截图目录：`artifacts/showcase-design-qa/`（实机补齐 6 帧：主页 nav、Showcase 设计栏、栏目切换、全案、EN、窄屏）。

## 质量 / 速度 / 兼容

- 质量：全案壳无乱码；catalog 仅 published；无租户路径公网直链
- 速度：candidates 有超时预算；publish gate 本地秒级
- 兼容：八栏 slug 稳定；`/en/` 路径；种子静态可回退
