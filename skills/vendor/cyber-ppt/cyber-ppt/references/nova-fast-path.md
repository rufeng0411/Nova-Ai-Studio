# Nova 快路径（Hub 试一下 / 已给主题+页数）

> 完整 MBB 三阶段流程见主 SKILL；**Nova 默认走本快路径**，禁止 ask_user 确认门。  
> **视觉底线（全 PPT 技能通用）**：必读 [`nova-ppt-visual-minimum.md`](nova-ppt-visual-minimum.md)——**禁止白板、无风格、无布局 pptx**。

## 适用

- 用户已给 **主题 + 页数**（如「10 页 MBB 风 PPTX」）
- Hub「试一下」预填
- 无「先给我看大纲/先选风格」字样

## 交付（仅 3 个文件，缺一则 incomplete）

| 文件 | 说明 |
|------|------|
| `presentation.pptx` 或 `《{主题}》咨询汇报.pptx` | **有明确视觉系统 + 页级布局**的可编辑 pptx（python-pptx / export_document） |
| `slide_manifest.json` | 页清单 + **style / layout / scr_stage**（先于 pptx 写入） |
| `visual_qa_gate.json` | 轻量 QA（含 `visual_minimum_pass`），勿做 ImageGen 全页蓝图 |

## 执行顺序（单线程，禁止 Task/subagent）

1. **web_search 2–4 次**（产品/竞品/数据，够用即停）
2. **`write_file slide_manifest.json`**（SCR + 逐页 `layout` + design tokens + `content_blocks`）——**manifest 是版式蓝图，不是事后补录**
3. **`write_file slide_manifest.json`**（SCR + 逐页 `layout` + design tokens + `content_blocks`）——**manifest 是版式蓝图，不是事后补录**
4. **生成 pptx（必须用画布 clamp 脚本，禁止手写越界坐标）**  
   - **推荐**：将 skill 内 `scripts/nova_pptx_layout.py` + `scripts/nova_build_from_manifest.py` **read 后 write 到 task 目录**，再执行：  
     `bash python nova_build_from_manifest.py slide_manifest.json presentation.pptx`  
   - 脚本固定 **16:9 = 13.333×7.5 in**，所有形状经 `clamp_box_in` / `frac_rect` 限制在画布内；构建后自动校验无 `SHAPE_OUTSIDE_SLIDE`  
   - 若自写 `build_pptx.py`：**必须** `import nova_pptx_layout`，禁止裸 `Inches(14)` 或 x+w>13.333 / y+h>7.5；表格/多列 KPI 用 `grid_cells` + `frac_rect`  
   - Windows：**禁止** inline `python -c "..."`；脚本落 task 目录再执行
5. **`write_file visual_qa_gate.json`**（`deliverable_allowed: true` 须含 `canvas_bounds_pass: true` + 视觉底线项全 pass）
6. 正文报 `artifacts/task-*/` 路径；**禁止** Task/subagent、`/tmp/`、task 外路径

可选：`outline.md` 可写盘，**不占 SDM 槽**。

## 禁止

- `ask_user_question` 跨阶段确认
- Task/subagent 委派（主线程 write_file）
- 无 pptx 仅以 HTML/Markdown/脚本充数
- **ImageGen 全页蓝图 / 8 风格样张**挡交付（快路径不用 png 蓝图）
- **白板 pptx**：白底 + 默认标题占位 + 纯 bullet 列表、无配色/无页型/无装饰组件
- **越界变形**：任何文本框/形状/表格超出 **13.333×7.5 in** 画布（PowerPoint 会裁切或拉伸变形）
- 10 页任务生成 10+ 张独立 PNG 当终态（PNG 仅过程预览，不占 repair 槽）

## Golden Path 样例：雷蛇 Pro Click V2（实机成功案）

**会话**：Hub「Cyber 咨询PPT」试一下 · 10 页 MBB · SCR · 约 5 分钟 `passed` · 目录 `artifacts/task-20260727-1d53113d/`

### 为什么成功

| 因素 | 做法 |
|------|------|
| 没走重流程 | **0 次 generate_image**；跳过 8 风格 + ImageGen 蓝图 |
| 先结构后渲染 | manifest 定 10 页 SCR + 每页 `layout` |
| 程序化 MBB 风 | python-pptx + 固定 design tokens，非默认模板 |
| 单目录闭环 | 三文件 + qa_gate 全在 STDA；无 subagent |

### manifest 要点（`slide_manifest.json`）

```json
{
  "deck": {
    "framework": "SCR (Situation-Complication-Resolution)",
    "style": "MBB Consulting — Dark Tech",
    "total_slides": 10,
    "aspect_ratio": "16:9"
  },
  "design_tokens": {
    "background": "#0A0A0A",
    "card": "#15151E",
    "accent_primary": "#44D62C",
    "accent_info": ["#00BEF0", "#FFB300", "#E04F5F"],
    "title_font": "Arial Black",
    "body_font": "Calibri"
  }
}
```

每页须含：`index`, `type`, `title`, `scr_stage`, **`layout`**, `content_blocks`；关键页带 **SO WHAT**。

### 推荐 10 页 SCR 页型（产品路演）

| 页 | scr_stage | layout 示例 |
|----|-----------|-------------|
| 1 | opening | `full_bleed_title` |
| 2 | opening | `grid_2x2_kpi` 执行摘要 |
| 3 | S | `two_column_chart` 市场格局 |
| 4–5 | C | `pain_point_grid` / `competitive_matrix` |
| 6–9 | R | `value_proposition_pyramid` / `spec_table` / `gtm_timeline` / 商业预测 |
| 10 | closing | `next_steps_cta` |

### build_pptx 最低实现

- **画布**：`prs.slide_width = 13.333 in`，`prs.slide_height = 7.5 in`（与 `nova_pptx_layout.SLIDE_W_IN/H_IN` 一致）
- **坐标**：优先 `frac_rect(fx,fy,fw,fh)` 映射到安全区（左右各 0.55 in、上下各 0.45 in 边距）；每个形状调用 `clamp_box_in`
- **页型组件**：KPI 网格用 `grid_cells(2,2)`；禁止固定 `Inches(12)` 宽文本框贴边
- 每页：**非白底** + 顶栏/页码装饰 + 标题区 + **至少 1 种布局组件**（KPI 卡、表格、矩阵、时间线等）
- 品牌/主题色写入 manifest 的 `design_tokens`，脚本与 manifest **一致**
- 落盘后运行 `validate_no_overflow_pptx(path)` 或 `nova_build_from_manifest.py` 内置校验；**有越界则返工**

### visual_qa_gate 必检（除 Cyber 原 QA 外）

- `visual_minimum_pass`: 每页非默认白底、有 accent 色、有 layout 组件
- `canvas_bounds_pass`: true（无形状超出 13.333×7.5 in；可用 `nova_build_from_manifest.py` 或 `validate_no_overflow_pptx` 验证）
- `manifest_pptx_layout_match`: manifest 声明的 layout 在 pptx 中有对应结构

## 用户明确要求「先看大纲/选风格」时

仅在对话正文展示大纲一次，等用户下一条消息；仍禁止 ask_user 工具。选定风格须写入 manifest `design_tokens`，不得口头说「MBB 风」却交付白板。
