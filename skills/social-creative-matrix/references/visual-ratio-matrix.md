# 视觉比例矩阵

本技能固定产出 **四套** AI 配图，与 PilotDeck `generate_image` 的 `aspect_ratio` 参数对齐（DashScope 像素见引擎 `dashScopeImageSize`）。

## 四套标准产出

| ratio | `aspect_ratio` | 典型像素 | 文件名 | 优先平台 |
|-------|----------------|----------|--------|----------|
| 竖版全屏 | `9:16` | 928×1664 | `image-9x16.png` | 抖音、快手、视频号 |
| 竖版笔记 | `3:4` | 1104×1472 | `image-3x4.png` | 小红书 |
| 方图 | `1:1` | 1328×1328 | `image-1x1.png` | 新浪微博、知乎（单图动态） |
| 横版 | `16:9` | 1664×928 | `image-16x9.png` | 头条号、百家号（封面/横图倾向） |

## 平台默认配图映射

Agent 在 `manifest.json` 的 `recommendedMapping` 中写入：

| 平台（中文名） | 默认文件 | 备选 |
|----------------|----------|------|
| 小红书 | `image-3x4.png` | `image-9x16.png` |
| 抖音 | `image-9x16.png` | `image-3x4.png` |
| 快手 | `image-9x16.png` | — |
| 视频号 | `image-9x16.png` | — |
| 新浪微博 | `image-1x1.png` | `image-3x4.png` |
| 知乎 | `image-1x1.png` | 多图时可拆多张同 ratio |
| 头条号 | `image-16x9.png` | `image-1x1.png` |
| 百家号 | `image-16x9.png` | `image-1x1.png` |

## generate_image 调用约定

1. 阶段 2 锁定 `visual_prompt`（中英文均可，但四次调用**正文一致**，只改比例）。
2. 每次调用示例：

```json
{
  "prompt": "<visual_prompt 全文>",
  "aspect_ratio": "9:16",
  "output_path": "artifacts/social-matrix/<slug>/visuals/image-9x16.png"
}
```

3. 顺序建议：`3:4` → `9:16` → `1:1` → `16:9`（先小红书再竖版再方/横）。
4. 用户只要部分比例时：在 `manifest.json` 的 `skippedRatios` 记录省略项，并在对话说明。

## 与 HTML 轮播的关系

- 四套 PNG 是**单图动态**主配图。
- 若用户要 3–7 张系列卡片：另走 `od-social-carousel`，产物在 `optional/carousel.html`，不替代四套 PNG。

## 海外占位

首版不生成海外专用尺寸；Postiz 整合后可扩展 `4:5`、`2:3` 等，见未来 `postiz-handoff.md`。
