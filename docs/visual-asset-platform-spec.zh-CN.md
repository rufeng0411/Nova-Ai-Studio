# Visual Asset Platform（VAP）规格

<!-- PD-SAAS-FORK: Visual Asset Platform orchestrator/manifest/flags specification -->

## 定位

全对话通用配图底层：按**性能优先阶梯** Discover → Prepare → Bind → Validate。Agent 以 `visual-asset-manifest.json` 为准写交付物。

## 性能优先阶梯（T0–T10）

| 序 | 手段 | 实现 |
|----|------|------|
| T0 | 直链 / candidateId 本地化 | `fetch_media_asset`（`PILOTDECK_VAP_DIRECT_IMAGE_URL`） |
| T1 | 静态 HTML 抽图 | `discoveryPipeline` + `publicHttpUrlPolicy` |
| T2 | 品牌根域 | filtered `official-source-roots` |
| T3 | Bocha 找页面 | `searchDiscovery`（有 Key） |
| T4 | JS 渲染抽图 | AnyCrawl 侧车 `crawlerSidecar` |
| T5 | 隐身 | Scrapling / stealth（`PILOTDECK_VAP_STEALTH_SIDECAR`） |
| T6 | 权威/门户模板 | authority/portal JSON |
| T7 | 图片搜索 | Bing Images（补缺、早停） |
| T8 | Playwright **live** 截图 | `pageCaptureFallback`（`PILOTDECK_VAP_LIVE_CAPTURE`） |
| T9 | Vision 定位 URL | `visionImageLocate`（描述≠交付） |
| T10 | 诚实降级 | official ≠ 假绿 SVG |

官网 URL 存在时：**禁止**先跑满搜索（`PILOTDECK_VAP_OFFICIAL_FIRST=1`）。

## 模块

| 模块 | 路径 |
|------|------|
| Orchestrator | `src/saas/media/visualAssetPlatform/orchestrator.ts` |
| Discovery | `…/discoveryPipeline.ts` |
| Outbound gate | `…/vapOutboundGate.ts` |
| Force ladder | `…/forceLadder.ts` |
| Crawler sidecar | `…/crawlerSidecar/` |
| Vision locate | `…/visionImageLocate.ts` |
| Session downloads | `…/sessionDownloadPaths.ts` |

## Flags（节选）

| Flag | 默认（dev / pack） |
|------|-------------------|
| `PILOTDECK_VISUAL_ASSET_PLATFORM` | shadow / **shadow** |
| `PILOTDECK_VAP_OFFICIAL_FIRST` | 1 |
| `PILOTDECK_VAP_DISCOVER_PARALLEL` | 1 |
| `PILOTDECK_VAP_DIRECT_IMAGE_URL` | 1 |
| `PILOTDECK_VAP_FORCE_LADDER` | 1 |
| `PILOTDECK_VAP_OUTBOUND_MAX` | 4 |
| `PILOTDECK_VAP_QUERY_PACK` | generic |
| `PILOTDECK_VAP_CRAWLER_SIDECAR` | off（启 compose 后 anycrawl） |
| `PILOTDECK_VAP_LIVE_CAPTURE` | 1 |
| `PILOTDECK_VAP_VISION_LOCATE` | shadow / off |
| `PILOTDECK_VAP_ORCHESTRATOR_BUDGET_MS` | 有官网 URL 时逻辑提升至 60s |

三处同步：`devLauncherCore` / `pack.mjs` / `apply-cloud-perf-env.sh`。

回滚：`PILOTDECK_VISUAL_ASSET_PLATFORM=off`。

## 侧车

见 [`docs/vap-crawler-sidecar-runbook.zh-CN.md`](./vap-crawler-sidecar-runbook.zh-CN.md)。

## 验收

```bash
npm run test:vap:hardening:strict   # 停步：unit → F01–F12 → 0802
npm run test:vap:failure-cases -- --gate
npm run test:vap:0802-replay -- --gate
npm run test:vap:acceptance
npm run test:vap:live-matrix:gate   # Bridge 空闲
```

失败案例权威：`tests/fixtures/vap-failure-cases-20260802.ts`。
