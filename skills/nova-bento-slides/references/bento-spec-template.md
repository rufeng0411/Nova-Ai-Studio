# bento-spec.md 模板

Phase C 锁定创意约束；写入 `<task-artifact-dir>/bento-spec.md`（过程文件）。

```markdown
---
deck_title: "{标题}"
audience: "{观众}"
slide_target: {8-12}
theme_preset: "{themes.md 中的 id}"
notes_mode: "A|B|C"
task_artifact_dir: "artifacts/task-YYYYMMDD-xxxx"
---

# Bento Spec — {标题}

## Strategist-lite 结论

- **页数/观众**：…
- **Theme**：`{preset}` → background / color / accent / fontFamily
- **讲稿**：A 完整 / B 要点 / C 极简

## Morph 策略

- Chrome ids：`headline`, `bar`, `logo`
- 组 1：cover → problem（headline + bar 收缩）
- 组 2：solution → traction（headline + bar）
- 数据页：`transition: fade` + countUp/chart enter

## 页型节奏（outline 预览）

| # | slide id | layout | rhythm | 要点 |
|---|----------|--------|--------|------|
| 1 | s-cover | cover-hero | anchor | … |
| 2 | s-problem | headline-body | dense | … |
| … | | | | |

## 资产

- 图：`asset:hero` → doc.assets.hero（data URI 或占位 gradient）
- 字体：仅 theme.fontFamily（+ 可选 display 第二族）

## 禁则

- 不手改 shell；不并列 html/pptx
- validate --strict 通过后再 splice 终态
```

填写后立即写 `outline.json`，进入 Phase E 逐页 elements。
