# 交付物规范

## 根目录

```
artifacts/social-matrix/<campaign-slug>/
```

`<campaign-slug>`：小写英文/数字/连字符，由主题生成，如 `spring-launch-2026`。

## 文件树

```
brief.md                 # 结构化 brief（阶段 1）
creative-anchor.md       # 价值主张 + visual_prompt + 禁用项（阶段 2）
copy-matrix.md           # 各平台文案表（阶段 3）
manifest.json            # 机器可读清单（阶段 6）
visuals/
  prompt.txt             # 与 generate_image 一致的 visual_prompt
  image-9x16.png
  image-1x1.png
  image-16x9.png
  image-3x4.png
optional/
  carousel.html          # 仅当走了 od-social-carousel
yixiaoer/
  upload-map.json        # 本地路径 → { key, width, height, size, format }
  publish-draft.json     # 可选：pack 脚本或 Agent 组装的 publish 骨架
```

## manifest.json Schema

见 `assets/manifest.template.json`。必填字段：

- `campaignId`：同 `<campaign-slug>`
- `createdAt`：ISO 8601
- `status`：`draft` | `ready` | `published`
- `platforms`：中文平台名数组
- `creativeAnchor`：`{ valueProp, visualPrompt, tone, cta }`
- `visuals`：`[{ ratio, file, width, height }]`
- `recommendedMapping`：`{ "小红书": "image-3x4.png", ... }`
- `copy`：`{ "<平台>": { title, body, hashtags, notes } }`
- `skippedRatios`：可选 string[]

## write_file 约定

- 所有路径相对于**项目工作区根**。
- 生成图片前 `mkdir` 逻辑由 `generate_image` 工具处理父目录。
- 交付时在对话中明确列出 `manifest.json` 与 `visuals/` 路径。

## 部分比例

用户只要部分尺寸时：

1. 只调用对应 `aspect_ratio` 的 `generate_image`。
2. `manifest.visuals` 只列已生成项。
3. `skippedRatios` 列出省略项及原因。
