# 文案平台矩阵（国内 8 平台 · imageText）

`publishType` 固定为 **`imageText`**。平台名在蚁小二 API 中必须使用**中文**（见 `skills/yixiaoer/docs/platform.md`）。

## 矩阵表

| 平台 | 标题 | 正文/描述 | 图片数 | 默认 ratio | 草稿/可见 | 发布前必读 |
|------|------|-----------|--------|------------|-----------|------------|
| 小红书 | ≤20 字（可选） | ≤1000 字，**必填** | 1–9（建议 1 张主图或系列） | 3:4 | `visibleType`: 0 公开 / 1 私密 | `image-text/xiaohongshu.md` |
| 抖音 | 可选 | ≤1000 字 | ≥1 | 9:16 | 平台草稿：`pubType` 0 | `image-text/douyin.md` |
| 快手 | — | ≤1000 字 | ≥1 | 9:16 | `visibleType` **必填** | `image-text/kuaishou.md` |
| 新浪微博 | — | ≤1000 字，**必填** | ≥1 | 1:1 | 见平台页 | `image-text/xinlangweibo.md` |
| 知乎 | 1–50 字 | **必填** | **1–9** | 1:1 | 话题 ≤5 | `image-text/zhihu.md` |
| 头条号 | — | ≤1000 字，**必填** | ≥1 | 16:9 | `pubType` **必填** | `image-text/toutiaohao.md` |
| 百家号 | **1–20 字，必填** | 1–1000 字 | ≥1 | 16:9 | `cover`+`declaration` 必填 | `image-text/baijiahao.md` |
| 视频号 | 可选 | ≤1000 字 | ≥1 | 9:16 | `pubType` 默认 1 | `image-text/weixinshipinhao.md` |

## 文案改编规则

对同一条「创意锚点」为每个选中平台生成一行，写入 `copy-matrix.md`：

1. **标题**：按上表上限截断；超限时在「备注」写完整版供人工改。
2. **正文**：口语化、带 1–3 个话题建议（小红书/抖音可用 `<topic>` 占位说明，发布时再查 `challenges`）。
3. **CTA**：每平台一句，符合语气（抖音短、知乎偏干货、微博偏话题）。
4. **Hashtag 参考**（非硬性，摘自 marketingskills `platform-limits`）：IG 不适用本表；国内可参考 3–5 个相关标签写在正文末尾。

## 各平台语气微调

| 平台 | 语气建议 |
|------|----------|
| 小红书 | 第一人称、干货清单、emoji 适量 |
| 抖音 | 短句、强钩子、前 2 行决定停留 |
| 快手 | 接地气、互动向 |
| 微博 | 话题感、可 @品牌 |
| 知乎 | 论证、数据或步骤，标题信息密度高 |
| 头条号 | 资讯体、中性 |
| 百家号 | 标题 SEO 感、声明合规 |
| 视频号 | 温和、适合微信生态 |

## 输出模板

使用 `assets/copy-matrix.template.md` 结构；`manifest.json` 的 `copy` 字段存结构化副本。
