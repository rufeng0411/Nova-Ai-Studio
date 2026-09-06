# VAP 搜图配图全 A 加固验收报告（2026-08-02）

## 还原点

- `restore-point/pre-vap-perf-effect-20260802154302`

## 严格门禁

| 级 | 命令 | 结果 |
|----|------|------|
| L0 | vitest VAP hardening unit（15） | **PASS** |
| L1 | `test:vap:failure-cases -- --gate` F01–F12 | **12/12 PASS** |
| L1 | `test:vap:0802-replay -- --gate` | **PASS**（浆板+KM3） |
| L0+ | `vitest src/saas/media/visualAssetPlatform` | **47 PASS** |
| 总编排 | `npm run test:vap:hardening:strict` | **PASS** → `artifacts/vap-hardening-strict/strict-report.json` |

L2 live-matrix / L3 Gateway 实机：本批未强制（需 Bridge 空闲与侧车可选）；侧车默认 `off`，降级路径已由 F09 覆盖。

## F01–F12

全部 PASS（见 `artifacts/vap-hardening-strict/failure-cases-report.json`）。

## 灰度 / 回滚

| 项 | 值 |
|----|-----|
| pack / apply-cloud | `PILOTDECK_VISUAL_ASSET_PLATFORM=shadow` |
| 回滚 | `PILOTDECK_VISUAL_ASSET_PLATFORM=off`；侧车 `PILOTDECK_VAP_CRAWLER_SIDECAR=off` |

## 关键交付

- Official-first Discover + VAP 专用出站闸
- generic 搜索包；直链 `fetch_media_asset`
- 同 eTLD+1 redirect；DoH 并行
- force ladder / 预算；有资产禁 placeholder SVG
- live capture；AnyCrawl 侧车适配器；Vision URL 定位
- 严格验收脚本与 fixture

## 结论

**GO(shadow)** — 核心严格验收通过；enforce 与 L3 实机另批。
