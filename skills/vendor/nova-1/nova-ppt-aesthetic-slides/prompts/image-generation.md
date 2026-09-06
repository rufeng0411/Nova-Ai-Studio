# Image Generation Prompt

用于 Phase D：将页描述转为幻灯片配图。Agent 调用任意多模态生图 API 时使用本模板。

## Core template

```
你是一位专家级UI UX演示设计师，专注于生成设计良好的PPT页面。
当前PPT页面的页面描述如下:
<page_description>
{page_description_text}
</page_description>

<design_guidelines>
- 要求文字清晰锐利, 画面为4K分辨率，{aspect_ratio}比例。
- {template_style_guideline}
- 根据内容自动设计最完美的构图，不重不漏地渲染"页面描述"中的文本。
- 如非必要，禁止出现 markdown 格式符号（如 # 和 * 等）。
- {forbidden_template_text_guideline}
- 使用大小恰当的装饰性图形或插画对空缺位置进行填补。
</design_guidelines>
{language_instruction}
{material_images_note_if_any}
{extra_requirements_block}
{cover_page_boost_if_page_index_1}
```

## Guideline variants

| Condition | `template_style_guideline` | `forbidden_template_text_guideline` |
|---|---|---|
| Has template reference image | 配色和设计语言和模板图片严格相似。 | 只参考风格设计，禁止出现模板中的文字。 |
| Text style only (`template_style`) | 严格按照风格描述进行设计。 | (empty) |

## Extra requirements block

When `template_style` is set:

```
额外要求（请务必遵循）：
ppt页面风格描述：

{template_style_full_text_from_preset_or_extraction}
```

## Material images note

If material images provided:

```
提示：{除了模板参考图片（用于风格参考）外，还提供了额外的素材图片。 | 用户提供了额外的素材图片。}
这些素材图片是可供挑选和使用的元素，你可以从这些素材图片中选择合适的图片、图标、图表或其他视觉元素
直接整合到生成的PPT页面中。请根据页面内容的需要，智能地选择和组合这些素材图片中的元素。
```

## Cover page boost (page_index = 1)

```
**注意：当前页面为ppt的封面页，请你采用专业的封面设计美学技巧，务必凸显出页面标题，分清主次，确保一下就能抓住观众的注意力。**
```

## API parameters (Agent responsibility)

- **aspect_ratio**: `16:9` (default) or `9:16` — must match API param, not only prompt text.
- **resolution**: prefer 2K+ where supported.
- **reference images**: pass template/style ref + material images as multimodal inputs when API allows.

## PilotDeck `generate_image` (required)

每页调用示例：

```
generate_image({
  prompt: "<本模板组装后的完整 prompt>",
  aspect_ratio: "16:9",
  output_path: "artifacts/slides-{deck_id}/slide-{page_index:02d}.png"
})
```

- `deck_id` 与 Phase A 一致；`page_index` 从 1 到 N，**不得**超过 `page_count`。
- 仅以工具返回的 `relativePath` 写入 manifest 并展示给用户。

## Multimodal order

1. Template/style reference image (if any) — style anchor only
2. Material images from page description
3. Text prompt from this template
