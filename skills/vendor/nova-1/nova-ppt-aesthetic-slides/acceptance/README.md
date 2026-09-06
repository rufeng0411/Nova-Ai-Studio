# Acceptance Runs

内置两个固定验收主题，用于验证 Skill 流水线（Phase A–E）与质量门禁。

## Themes

| ID | 主题 | 推荐 preset | 页数 |
|---|---|---|---|
| `enterprise-ai-training-2026` | 2026 企业 AI 培训 | `tech-modern` | 8 |
| `new-consumer-brand-pitch` | 新消费品牌路演 | `gradient-vibrant` | 8 |

## Pass criteria

- ≥6 页 `status: completed` PNG
- 同 deck `preset_id` / `template_style` 一致
- 大纲与描述无风格污染（见 [quality-gates.md](../quality-gates.md)）
- 封面页信息密度低于内页

## Artifacts per theme

```
acceptance/
  enterprise-ai-training-2026/
    outline.json
    slide-manifest.json
  new-consumer-brand-pitch/
    outline.json
    slide-manifest.json
```

PNG 由 Agent 实机调用生图 API 生成，路径写入 manifest `pages[].image_path`。本目录提供 **Phase B+C 验收样例**（outline + 完整 page_description + manifest 骨架）。

## How to run

1. 读取 [../SKILL.md](../SKILL.md) 与 [../playbook.md](../playbook.md)。
2. 加载本目录下某主题的 `outline.json` 与 manifest 中的 `page_description`（或自行重跑 Phase B–C）。
3. 按 [../prompts/image-generation.md](../prompts/image-generation.md) 逐页出图。
4. 对照 [../quality-gates.md](../quality-gates.md) 自检。

## Validation script

```bash
python skills/ppt-aesthetic-slides/acceptance/validate_manifest.py
```

校验 JSON schema 与风格分离启发式（大纲 points 不含典型风格污染词）。
