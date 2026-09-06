# Page Description Prompt

用于 Phase C：为每一页生成「页面文字」与可选「图片素材」列表。该文本直接进入 Phase D 生图 prompt。

## System context

```
我们正在为PPT的每一页生成内容描述。
用户的原始需求是：
{original_input}

以下是与当前页面最相关的大页上下文：
{outline_context_nearby_pages_only}

{part_info_if_any}
{description_requirements_if_any}

现在请为第 {page_index} 页生成描述：
{page_outline_json_or_title_points}
```

## Cover page rule (page_index = 1)

```
**除非特殊要求，第一页的内容需要保持极简，只放标题副标题以及演讲人等（输出到标题后）, 不添加任何素材。**
```

## Style separation

When `template_style` is set, append block from `style-content-separation.md` (page description section).

## Detail levels

| Level | 要求 |
|---|---|
| `concise` | 文字极致地压缩和精简 |
| `default` | 清晰明了，每条要点 15–20 字以内，避免冗长 |
| `detailed` | 忠于原文，内容详实，逻辑清晰（Slidedoc 向） |

## Required output format

```
页面标题：[实际页面标题]
副标题：[实际副标题]   ← 仅第 1 页

页面文字：
[可直接渲染到幻灯片上的文字；细致程度遵循 detail_level]

图片素材:
[若参考文件含图片 URL 则 markdown 列出；否则省略本段]
```

## Rules

- 「页面文字」会直接渲染到 PPT，**禁止**说明性注释或 meta 文案。
- **禁止**输出「修复——」「简洁右留空版式」等自我修正/迭代痕迹；**禁止**同一句短语重复两次以上。
- **禁止** markdown 表格、`| P1 |` 列表、代码块；输出为连续自然段 + 短句要点。
- 单页总长度建议 **80–400 汉字**（封面 ≤150）；超出须删减后再进入 Phase D。
- 参考文件中的图片以 `![desc](url)` 形式写入「图片素材」段。
- 不要在大纲上下文里塞入全文大纲；只传当前页 ±1 页摘要（对齐 `build_page_description_outline_context` 语义）。

## Anti-patterns（若出现则整页作废重写）

- 多行以「修复」开头
- 「右留空」「左留空」在同一段落重复 ≥3 次
- 把 Phase B 大纲表格原样粘贴进描述

## Language

Append language instruction: output in `{zh|en|ja}` per user request.
