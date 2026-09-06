# 鸣镝 G700 配图 RCA（2026-07-19）

详见 [`mingdi-g700-vap-five-case-rca-20260719.zh-CN.md`](./mingdi-g700-vap-five-case-rca-20260719.zh-CN.md) 与平台规格 [`visual-asset-platform-spec.zh-CN.md`](./visual-asset-platform-spec.zh-CN.md)。

## 根因摘要

R1 DNS 误杀 → DoH；R2 「来自官网」未编译 → officialMediaRequirement；R3 无多源编排 → DiscoveryPipeline；R4 SVG 继续 → Recovery/degrade official_only；R5 placeholderCount=0 → looksLikeVisualPlaceholder；R6 roots=[] → 灌入 zongheng/chery。

## 生产

结构门禁可绿；enforce 实机五案仍须 `dev:saas` 后宣称 GO。总回滚 `PILOTDECK_VISUAL_ASSET_PLATFORM=off`。
