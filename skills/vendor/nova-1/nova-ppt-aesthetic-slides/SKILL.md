---
name: nova-ppt-aesthetic-slides
description: Use when the user needs visually polished presentation slides from a topic or outline via outline → page-description → generate_image (one PNG per slide, locked preset)—NOT HTML/SVG/CSS decks, NOT open-design or od-deck skills. In PilotDeck write slide-NN.png + slide-manifest.json under the assigned taskArtifactDir (STDA).
---

<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 交付 **`slide-01.png` … `slide-N.png` + `slide-manifest.json`** 至 **`<task-artifact-dir>/`**（勿写裸 `artifacts/slides-*` 或 `index.html`）。
- **禁止** ask_user_question 挡出图；**禁止** HTML/index.html 代替 PNG 包；**禁止**无 preset/无版式的单色底+一行字幻灯。
<!-- NOVA-EXEC-END -->

# Nova PPT Aesthetic Slides

## Overview

将「主题 → 结构化大纲 → 页级画面描述 → **逐页 `generate_image`**」固化为可移植工作流。交付物为 **`slide-01.png` … `slide-N.png` + `slide-manifest.json`**，不是 HTML 网页、不是可编辑 PPTX。

**不依赖** Nova 后端；在 PilotDeck 中用内置 **`generate_image`** 工具配图。

## Hard rules（违反即视为未按本 Skill 执行）

1. **先读** [playbook.md](playbook.md) 与 [references/pilotdeck-execution.md](references/pilotdeck-execution.md)，再动手。
2. **强制顺序**：Phase A → B → C → D → E。禁止跳过 B/C 直接出图。
3. **禁止**用 HTML / SVG / CSS / `open-design` / `od-deck-magazine` / `frontend-slides` 代替本流程。
4. **禁止**在对话中引用未写入工作区的路径（如写了 `slide-09.png` 但只做了 8 页）。
5. **Phase D 双模式**：
   - **Creative（默认）**：对每一页调用 `generate_image`，`output_path` = `artifacts/slides-{deck_id}/slide-{page_index:02d}.png`。
   - **Official**（用户 goal 含官网/官图/权威图，或系统注入 `official_only`）：Phase D-Official = `resolve_session_visual_assets(phase_a)` → `prepare_visual_asset` → 写入 `slide-NN.png`（引用 manifest 路径）；**禁止** `generate_image` 冒充产品官图。
6. Phase C 的 `page_description` 为**纯文本**：无 `#`、`*`、表格、无「修复——」类 meta 句、无重复短语堆砌。
7. 大纲 `page_index` **1..N 连续唯一**，页数与用户约定一致。

## When to Use

- 用户要**视觉统一**的幻灯片 PNG 序列（或自行合成放映文件）。
- 用户说「Nova PPT」「美学幻灯」「文生图 PPT」「国风 PPT」等。
- 16:9（默认）、9:16、4:3、1:1、3:4 画幅；写入 `slide-manifest.json` 的 `aspect_ratio`，导出 PPT 时自动对齐。

## When NOT to Use

- 矢量/HTML 演示 → 用 `frontend-slides` / `od-deck-magazine`（**不要**与本 Skill 混用）。
- 只要 Markdown 大纲、不要配图 → 仅 Phase B，停止。
- 可编辑 PPTX 文字层 → 本 Skill 产出 PNG 后，在预览栏点 **「导出 PPT」**（MinerU OCR）；勿用「图片 PPT」。

## Pipeline

| Phase | 输出 | 参考 |
|---|---|---|
| A 输入 | `idea_prompt`, `preset_id`, `template_style`, `deck_id` | [playbook.md](playbook.md) |
| B 大纲 | `artifacts/slides-{deck_id}/outline.json` | [prompts/outline.md](prompts/outline.md) |
| C 页描述 | 每页 `page_description`（写入 manifest 草稿） | [prompts/page-description.md](prompts/page-description.md) |
| D 配图 | Creative: **`generate_image`**；Official: manifest + **`prepare_visual_asset`** | [prompts/image-generation.md](prompts/image-generation.md), [references/pilotdeck-execution.md](references/pilotdeck-execution.md) |
| E 交付 | `slide-manifest.json` | [schemas/slide-manifest.json](schemas/slide-manifest.json) |
| F 可编辑 PPT | 用户预览 `slide-01.png` → 导出 PPT（MinerU，`aspect_ratio` 来自 manifest） | [references/pilotdeck-execution.md](references/pilotdeck-execution.md) |

## Visual Presets

9 套预设见 [presets/README.md](presets/README.md)。国风/古建筑 → **`guofeng-heritage`**。

## Quality Gates

交付前必读 [quality-gates.md](quality-gates.md)。未通过 Blocker 不得宣称完成。

## Agent checklist（每 deck）

- [ ] 已读 playbook + pilotdeck-execution
- [ ] `outline.json` 页数正确、无重复页码
- [ ] 每页有独立 `page_description`（已自检无 meta/重复句）
- [ ] 每张 PNG 路径在 `artifacts/slides-{deck_id}/`（Official 模式须绑定 manifest assetId）
- [ ] `slide-manifest.json` 与磁盘文件一致
- [ ] 对话中展示的路径 = 工具返回的 `relativePath`

## Related Skills

- `nova-research-*`：可先调研，摘要后作为 Phase A 的 `idea_prompt`；**不**自动调用 research pipeline。
