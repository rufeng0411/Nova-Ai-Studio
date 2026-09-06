# Regression Notes（2026-06-08）

## 用户反馈症状（大明营造 8 页国风 PPT）

| 现象 | 根因 | 修复 |
|------|------|------|
| 走 HTML+SVG+CSS / Open Design | Skill 未禁止替代工作流，Agent 误用 `open-design` | SKILL Hard rules + quality-gates Blocker |
| Phase B 表出现重复 P5/P7 | 大纲未校验 `page_index` 唯一连续 | outline.md Validation + outline.json 落盘 |
| Phase C「修复——简洁右留空」重复句 | 页描述 prompt 缺 anti-meta 规则 | page-description.md Anti-patterns |
| 对话展示 `slide-09.png` 但 8 页任务 | 未绑定 `page_count`，路径臆造 | pilotdeck-execution：`slide-01`..`slide-08` only |
| 预览 File not found | 未用 `generate_image` 的 `output_path`，或路径不存在仍引用 | Phase D 强制 `artifacts/slides-{deck_id}/slide-NN.png` |
| 国风风格未锁定 | 缺专用 preset | 新增 `guofeng-heritage` |

## 验收

```bash
python skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/validate_manifest.py
# 期望: OK 2 themes validated
```

## 推荐复测提示词

```
用 Nova-美学幻灯技能，把「大明营造·中国古代建筑科学图解」做成 8 页 16:9 国风手绘 PNG。
先 outline.json，再每页 page_description，再逐页 generate_image 到 artifacts/slides-ming-architecture/slide-01.png … slide-08.png，最后 slide-manifest.json。不要 HTML。
```
