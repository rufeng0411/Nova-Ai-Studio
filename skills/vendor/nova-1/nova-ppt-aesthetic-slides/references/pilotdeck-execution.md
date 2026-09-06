# PilotDeck / Nova Ai-Studio 执行说明

本 Skill 在 PilotDeck 中产出页图 PNG + manifest。**Creative 模式**用 `generate_image`；**Official 模式**（官网/官图 goal）用 manifest + `prepare_visual_asset`，禁止用 HTML/SVG/CSS 冒充幻灯片。

## 工作目录

1. 选定 `deck_id`（英文短 slug + **任务唯一后缀**，如 `ai-business-growth-20260616-1430` 或 `ming-architecture-a3f2b1`）。
   - **禁止**复用同一会话/同项目内已有 `artifacts/slides-*` 目录名；每次新任务必须新建目录。
2. 所有产物写入 **`artifacts/slides-{deck_id}/`**，例如：
   - `artifacts/slides-ming-architecture/outline.json`
   - `artifacts/slides-ming-architecture/slide-manifest.json`
   - `artifacts/slides-ming-architecture/slide-01.png` … `slide-{N:02d}.png`

**页数 N 与用户约定一致**（默认 8）。只允许 `slide-01` … `slide-08`，**禁止**出现 `slide-09` 或跳号。

## Phase D：Creative vs Official

### Creative（默认）

每一页配图：

```json
{
  "prompt": "<按 prompts/image-generation.md 组装的完整中文/英文 prompt>",
  "aspect_ratio": "16:9",
  "output_path": "artifacts/slides-{deck_id}/slide-{page_index:02d}.png"
}
```

### Official（官网/官图/权威图 goal 或 official_only 合同）

1. 先 `resolve_session_visual_assets`（phase_a）或读取系统注入的 `<visual-asset-manifest>`。
2. 按页角色（封面/外观/内饰/参数）从 manifest 选 `preparedPath/rawPath`。
3. 必要时 `prepare_visual_asset` 裁剪到 16:9，再 `write_file`/`render_local_html_to_image` 输出到 `slide-{page_index:02d}.png`。
4. **禁止** `generate_image` 冒充产品官图；ladderExhausted 且无官图时才可标记 `placeholder=true` 并披露。

规则（两模式共用）：

- **必须**传入 `output_path`；不得依赖默认 `artifacts/media/image-*.png`。
- 调用成功后，**仅**在工具返回的 `relativePath` 与 `output_path` 一致时，才在对话中展示该文件。
- 单页失败最多重试 3 次；仍失败则在 manifest 标 `status: failed` + `error`，不要伪造路径。

## 禁止的替代方案（常见失败）

| 禁止 | 原因 |
|------|------|
| `write_file` 写 HTML/SVG 全屏幻灯片 | 本 Skill 交付 **PNG 页图 + manifest**，不是网页 Deck |
| 调用 `open-design` / `od-deck-magazine` / `frontend-slides` | 另一套工作流，会破坏风格锁定与 manifest |
| `render_html_video` | 非本 Skill 产物 |
| 未写 Phase C 直接 `generate_image` | 违反 quality-gates Blocker |
| 对话里写 `slide-09.png` 但未实际生成 8 页以外的文件 | 导致预览 File not found |
| Phase C 输出「修复——」「简洁右留空」等 meta 循环句 | 污染生图 prompt，须重写该页描述 |

## 交付前自检

1. `outline.json` 中 `pages.length === page_count`，`page_index` 为 1..N 连续唯一。
2. 磁盘上存在 `slide-01.png` … `slide-{N:02d}.png`（或 manifest 标明 failed）。
3. `slide-manifest.json` 符合 `schemas/slide-manifest.json`。
4. 对话成果路径与 `artifacts/slides-{deck_id}/` 下真实文件一致。

## Phase F：可编辑 PPT（MinerU）

1. 用户打开任意 `slide-NN.png` 预览。
2. 点击琥珀色 **「导出 PPT」**（非「图片 PPT」）→ MinerU 定位图中文字区域，系统**从背景图去掉文字**并生成**可编辑文字层**（改字不会与底图叠字）。
3. 画幅读取 `slide-manifest.json` 的 `aspect_ratio`（须与 Phase D `generate_image` 一致）。
4. 平台须在 **设置 → 文档工具** 配置 MinerU Token（或通义 Key 作降级）。

## 国风 / 古建筑类主题

用户要求「国风」「手绘」「古代建筑」「博物馆」时：

- `preset_id`: **`guofeng-heritage`**
- 读取 `presets/guofeng-heritage.md` 全文注入 `template_style`
- 大纲与页描述讲**建筑科学/知识点**；水墨、宣纸、线稿仅在 `template_style`，不写进 bullet 正文
