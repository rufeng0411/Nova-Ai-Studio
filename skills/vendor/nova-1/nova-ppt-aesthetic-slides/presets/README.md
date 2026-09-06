# Visual Presets Index

9 套锁色/锁材质预设。选定后将 **整段 Visual description** 作为 `template_style` 注入生图 `extra_requirements`。

## Preset catalog

| ID | 中文名 | 文件 |
|---|---|---|
| `guofeng-heritage` | 国风手绘 | [guofeng-heritage.md](guofeng-heritage.md) |
| `business-simple` | 简约商务 | [business-simple.md](business-simple.md) |
| `tech-modern` | 现代科技 | [tech-modern.md](tech-modern.md) |
| `academic-formal` | 严谨学术 | [academic-formal.md](academic-formal.md) |
| `creative-fun` | 活泼创意 | [creative-fun.md](creative-fun.md) |
| `minimalist-clean` | 极简清爽 | [minimalist-clean.md](minimalist-clean.md) |
| `luxury-premium` | 高端奢华 | [luxury-premium.md](luxury-premium.md) |
| `nature-fresh` | 自然清新 | [nature-fresh.md](nature-fresh.md) |
| `gradient-vibrant` | 渐变活力 | [gradient-vibrant.md](gradient-vibrant.md) |

## Selection decision tree

用户未指定风格时，按主题关键词选择（对齐 `inferStyleFromContent` 语义）：

| 关键词信号 | 推荐 preset |
|---|---|
| AI、科技、数字化、芯片、机器人 | `tech-modern` |
| 商业、企业、战略、融资、产品发布 | `business-simple` |
| 教育、培训、课堂、学生 | `minimalist-clean` 或 `creative-fun`（少儿向选 creative-fun） |
| 医疗、健康、临床、医院 | `minimalist-clean` |
| 文旅、文化、博物馆、品牌故事 | `nature-fresh` 或 `luxury-premium` |
| 国风、古代建筑、文化遗产、手绘科普 | **`guofeng-heritage`** |
| 学术、论文、研究、答辩 | `academic-formal` |
| 消费品牌、年轻化、路演 | `gradient-vibrant` 或 `creative-fun` |
| 无明确信号 | `business-simple`（默认） |

## Usage

1. 读取对应 `.md` 的 **Visual description (zh)** 全文。
2. 写入 manifest 的 `template_style` 与 `preset_id`。
3. 全 deck 复用同一 preset，禁止页间换风格。

## Custom style

- 用户上传 mood board → 走 `prompts/style-extraction.md`，**不**叠加 preset 全文。
- 用户句内风格词 → 剥离到 `template_style`，主题留在 `idea_prompt`。
