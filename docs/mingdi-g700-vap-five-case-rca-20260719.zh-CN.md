# 鸣镝 G700 五案配图 RCA + Visual Asset Platform（2026-07-19）

## 结论

五案失败主因不是「模型不会写 HTML」，而是 **官方配图链未主动跑通**：官网 DNS 误杀、`official_only` 未编译、「2 次失败→SVG 继续」与质量计数漏报叠加，导致 Campaign/HTML **假绿**、Nova 幻灯 `official_media_violation`。

本批落地 **Visual Asset Platform（VAP）**：自动搜图 → 分析 processingTier → 按需 prepare → SDM 槽位绑定 → verified 回写；总回滚 `PILOTDECK_VISUAL_ASSET_PLATFORM=off`。

## 根因对照

| # | 根因 | 修复 |
|---|------|------|
| R1 | DNS publicOnly 误杀公网站 | `createOfficialMediaDnsResolver`（系统 DNS + DoH）接入 `fetch_page_images` / Discovery |
| R2 | 「来自官网」未匹配「官方」 | `officialMediaRequirement` 扩展官网/URL 模式 |
| R3 | 无多源编排 | `discoveryPipeline` L1 官网 → L2 懂车帝/汽车之家 |
| R4 | Recovery 引导 SVG 继续 | official_only 分支改写；legacy degrade bypass |
| R5 | placeholderCount=0 假绿 | `looksLikeVisualPlaceholder` 计 SVG/占位路径 |
| R6 | source-roots 空 | 灌入 zongheng/chery/autohome/dongchedi |

## Flags

| Flag | 默认（dev） | 生产 pack | 说明 |
|------|-------------|-----------|------|
| `PILOTDECK_VISUAL_ASSET_PLATFORM` | shadow | off | 总开关 |
| `PILOTDECK_DISCOVER_VISUAL_ASSETS` | 1 | 1 | Discovery |
| `PILOTDECK_VISUAL_ASSET_PREP` | 1 | 1 | Prepare |
| `PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS` | 1 | 1 | Turn 内自动 resolve |

## 验收

- 单元：`npx vitest run src/saas/constraints/officialMediaRequirement.test.ts src/saas/media/visualAssetPlatform`
- Replay：`npm run test:vap:five-case-replay -- --gate`
- 官方素材链：`npm run test:official-media:acceptance` + `npm run check:official-source-roots`
- Live（P1）：`npm run test:mingdi-g700:live`（须先修 CLI displayName，已做最小修复）

## 生产

**仍为 NO_PRODUCTION_GO**，直至 P1 live 五案 `localizedOfficialImages>=1` 且无假绿。发版前保持 VAP=off 或 shadow 观察。
