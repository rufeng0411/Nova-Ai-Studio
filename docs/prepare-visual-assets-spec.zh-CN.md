# prepare_visual_asset / processingTier 规格

## processingTier

| Tier | 场景 | 默认 recipe |
|------|------|-------------|
| none | logo/图表/已有 alpha | passthrough |
| resize_only | GEO 插图 | report_inline |
| crop_fit | hero/场景 | landing_hero_wide / slide_scene_cover |
| matting_compose | 产品主视觉/社媒 | slide_hero_16x9 等 |

## Recipes

`config/visual-asset-recipes.json`

## Matting

`mattingProviders.ts`：`auto` → rembg（`PILOTDECK_REMBG_URL`）→ bbox fail-open。

## 验收

`tests/tool/prepare-visual-asset.test.ts`
