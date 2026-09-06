# PPT Aesthetic Slides — Agent Playbook

Agent 按 **Phase A → E** 顺序执行。每阶段完成后再进入下一阶段；失败时见文末「错误恢复」。

---

## Phase A — 输入规范化

### Collect

| 字段 | 必填 | 默认 |
|---|---|---|
| `idea_prompt` | 是 | — |
| `page_count` | 否 | 8 |
| `language` | 否 | 与用户消息一致（zh / en） |
| `aspect_ratio` | 否 | `16:9` |
| `detail_level` | 否 | `default` |
| `reference_documents` | 否 | [] |
| `template_image` | 否 | null |
| `material_images` | 否 | [] |

### Strip style from topic

对齐 Nova `stripDetectedStyleFromIdeaPrompt` 语义：

1. 若用户句内含明确视觉风格描述（配色、材质、渲染引擎、禁止项等），剥离到 `template_style`。
2. 剩余主题/要点写入 `idea_prompt`。
3. **禁止**在 `idea_prompt` 中保留大段风格散文（见 [style-content-separation.md](prompts/style-content-separation.md)）。

### Resolve `template_style`

优先级：

1. 用户显式 `template_style` 文本
2. 用户上传 `template_image` → Phase A 末尾调用 [style-extraction.md](prompts/style-extraction.md)（vision）
3. 无风格 → 按 [presets/README.md](presets/README.md) 决策树选 `preset_id`，读取对应 `.md` 的 Visual description (zh)

### Confirm with user (recommended)

- 页数、画幅、`preset_id` 或自定义风格摘要
- 是否先出 1 页样张

---

## Phase B — 大纲

1. 读取 [outline.md](prompts/outline.md)。
2. 注入风格分离 guardrail（同文件或 [style-content-separation.md](prompts/style-content-separation.md) 大纲段）。
3. 若有 `reference_documents`，作为附录上下文注入，**勿**把资料全文当幻灯片主题。
4. 调用 LLM，要求输出符合 [schemas/outline-page.json](schemas/outline-page.json) 的页列表。

### Output shape

```json
{
  "pages": [
    { "page_index": 1, "title": "...", "points": ["...", "..."] }
  ]
}
```

### Checks before Phase C

- [ ] 页数 = 用户要求（或已确认默认值）
- [ ] `page_index` 为 **1..N 连续唯一**（无重复 P5/P7、无跳号）
- [ ] 每页有 `title` + 至少 1 个 `point`
- [ ] 大纲正文无风格污染（无大段「赛博/水墨/渐变」描述）
- [ ] 已写入 `artifacts/slides-{deck_id}/outline.json`

---

## Phase C — 页描述

1. 读取 [page-description.md](prompts/page-description.md)。
2. **逐页**或**小批量**（≤3 页）调用 LLM；传入：
   - 当前页 outline
   - 前一页 / 后一页 **摘要**（非全文大纲）
   - `detail_level`
   - `language`
3. `page_index=1`：启用封面极简规则。
4. 输出为**纯文本** `page_description`：禁止 `#`、`*` 等 markdown 标题符号进入成图 prompt。

### Output per page

```json
{
  "page_index": 1,
  "page_description": "纯文本画面描述..."
}
```

### Checks before Phase D

- [ ] 每页均有独立 `page_description`
- [ ] 封面描述短于内页（信息点更少、标题更突出）
- [ ] 描述讲「画面布局与内容」，不讲全局画风（画风仅在 `template_style`）
- [ ] 无 markdown 符号（`#`、`*`、`|`）、无「修复——」类 meta、无同一句重复 ≥2 次
- [ ] 单页描述建议 **80–400 字**（封面更短）；过长须压缩后再配图

---

## Phase D — 配图（PilotDeck：`generate_image`）

**先读** [references/pilotdeck-execution.md](references/pilotdeck-execution.md)。

1. 读取 [image-generation.md](prompts/image-generation.md)。
2. 组装变量：
   - `page_description_text`
   - `aspect_ratio`（API 参数与 manifest 一致）
   - `template_style` → `extra_requirements` 块
   - `page_index=1` → 封面强化句
3. 若有 `template_image`：多模态输入 + 「只参考风格、禁止抄图中文字」。
4. 若有 `material_images`：注入素材挑选说明。
5. 在 PilotDeck 中**必须**调用工具 **`generate_image`**（勿用 `write_file` 写 HTML 冒充幻灯片）：
   - `aspect_ratio`: 与 manifest 一致（默认 `16:9`）
   - `output_path`: **`artifacts/slides-{deck_id}/slide-{page_index:02d}.png`**
   - `prompt`: 按 image-generation 模板组装
6. 以工具返回的 `relativePath` 为准更新 manifest；**禁止**在对话中引用未生成的路径（例如 8 页 deck 不得出现 `slide-09.png`）。
7. 每页生成后确认文件已落盘，再进入下一页或告知用户预览。

### Recommended batching

- 先 **page 1**（封面）或 **page 2** 作样张 → 用户确认
- 再顺序或有限并行（≤2 并发，避免风格漂移）生成其余页

### Per-page retry

- 单页失败：最多重试 3 次，同一 `template_style` 与 `page_description`
- 仍失败：记录 `error` 于 manifest，继续下一页或暂停询问用户

---

## Phase E — 交付

1. 写入 [slide-manifest.json](schemas/slide-manifest.json) 实例（见 schema）。
2. 交付物：
   - 全部 `slide-*.png`
   - `slide-manifest.json`
3. 可选：附 `python-pptx` 合并说明（非可编辑层）。

### Manifest minimum fields

- `deck_title`, `preset_id`, `template_style`, `aspect_ratio`, `language`, `page_count`
- `pages[]`: `page_index`, `title`, `page_description`, `image_path`, `status`

---

## 错误恢复

| 症状 | 动作 |
|---|---|
| 风格不对 / 配色漂移 | 回 Phase A：确认 `preset_id` 或 re-extract；重生成**全部**页图 |
| 单页文字糊/乱码 | 重跑 Phase C 该页描述（更短句、更大字号布局指令）→ Phase D 重绘 |
| 大纲页数不对 | 回 Phase B 修正，**作废**后续描述与配图 |
| 描述含 markdown 符号 | 清洗 `page_description` 后仅重跑 Phase D |
| 跳过描述直接出图 | **禁止**；补 Phase C 后再配图 |
| 用 HTML/Open Design 做 Deck | **禁止**；删错误产物，从 Phase B 按本 Skill 重来 |
| 预览 File not found | 检查是否未传 `output_path`、路径与 `page_count` 不一致；用工具返回路径重试 |
| Phase C 出现重复「修复——」句 | 作废该页描述，按 page-description 规则重写，勿带入生图 prompt |
| 用户中途改主题 | 新 deck 新 manifest；勿复用旧 `template_style` 除非用户确认 |

---

## Portable limits (transparent)

- 无 Nova 任务中心、无自动 4 次失败重试 worker
- 无 KB RAG 自动参考图（用户自行提供摘要/URL/图片）
- 无 MinerU 可编辑 PPTX
- 单页 inpaint 简化为「整页重生成」
