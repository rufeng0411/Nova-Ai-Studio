# 成果四线统一终案验收报告（2026-07-16）

## 范围

合并三案例（阿根廷 8cc05414、世界杯 GEO c339d799、荷兰枸杞 FAQ 9fee0532）的 Phase 0–3 止血与四线统一。

## 子机制与修复

| 机制 | 修复 |
|------|------|
| M2 GEO 误扩写 | `shouldSkipGeoExpansion` + `compileDeliverableSlotPath`；FAQ slug 优先 `artifacts/faq-*` |
| M3 URL `.go` 误提取 | 路径提取前 mask http(s) URL |
| M1 跨 hub 串台 | 默认 `resolveDeliverableSearchRoots` 仅当前 hub；`PILOTDECK_DELIVERABLE_CROSS_HUB=1` 回滚 |
| M4 Recovery 假槽位 | GEO audit 专用 recovery，禁止 research 三件套 |
| P0-7 resolvedPath 权威 | SDM `done` 无 verified 不 linkable；scopeDir 门禁 |

## 案例断言

- **FAQ 9fee0532**：`artifacts/faq-dutch-goji/index.html` 四线一致，禁止 `artifacts/geo/faq-dutch-goji/...`
- **GEO 全案 legacy**：`hema-red-bean-corn-silk-water/keywords.md` 仍扩写 `artifacts/geo/...`

## 门禁

```bash
npm run test -- ui/src/shared/artifactPaths.test.ts ui/shared/deliverablePathResolve.test.mjs ui/src/shared/buildDeliverableSummaryRows.test.ts ui/src/shared/fourLineFaqFixture.test.ts src/saas/resolveToolRecoveryProfile.test.ts
npm run test:deliverable-paths
```

## 回滚

- `PILOTDECK_DELIVERABLE_CROSS_HUB=1` — 恢复跨 hub 扫盘
- `PILOTDECK_DELIVERABLE_HINT_DIR=0` — 恢复裸名 mtime 猜测（应急）
