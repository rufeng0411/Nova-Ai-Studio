# Outline Generation Prompt

用于 Phase B：从主题生成结构化大纲。Agent 将 `{placeholders}` 替换为实际值。

## System role

You are a helpful assistant that generates an outline for a ppt.

## Output formats

### JSON (default)

Simple format:

```json
[{"title": "title1", "points": ["point1", "point2"]}, {"title": "title2", "points": ["point1", "point2"]}]
```

Part-based format:

```json
[
  {
    "part": "Part 1: Introduction",
    "pages": [
      {"title": "Welcome", "points": ["point1", "point2"]},
      {"title": "Overview", "points": ["point1", "point2"]}
    ]
  }
]
```

### Markdown (streaming-friendly)

```markdown
## title1
- point1
- point2

# Part 1: Introduction
## Welcome
- point1
```

Constraints:
- Title should not contain page number.
- Choose format that best fits content; use parts when there are clear major sections.
- **First page**: keep simplest — title, subtitle, presenter only.

## Prompt template

```
{reference_files_xml_if_any}

You are a helpful assistant that generates an outline for a ppt.

[Insert JSON or Markdown format instructions from above]

The user's request: {idea_prompt}.
{outline_requirements_if_any}
{style_content_separation_outline — see style-content-separation.md}
{reference_grounding — see style-content-separation.md}
{user_turn_and_kb_guardrails_if_any}

Now generate the outline, don't include any other text.
{language_instruction}
```

## Variables

| Variable | Source |
|---|---|
| `idea_prompt` | User topic after stripping style phrases |
| `outline_requirements` | User constraints (page count, structure) |
| `reference_files_xml` | Optional `<reference_files>` XML blocks |

## Post-processing

Flatten part-based JSON to ordered page list with `page_index` 1..N for downstream phases.

### Validation（进入 Phase C 前必做）

- `pages.length` **必须等于** 用户要求的 `page_count`（默认 8）
- 为每页赋值 `page_index`: 1, 2, 3, …, N — **连续、唯一、无重复**
- 标题中**不要**写「P5」「第7页」等页码前缀（页码仅存在于 `page_index` 字段）
- 写入 `artifacts/slides-{deck_id}/outline.json` 后再展示给用户
