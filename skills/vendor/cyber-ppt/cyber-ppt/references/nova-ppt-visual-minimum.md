# Nova PPT 视觉底线（全 PPT 技能强制）

> **任何**产出 `.pptx`、HTML 放映稿或 PNG 幻灯包的技能均须遵守。违反 = 流程失败，**不得**标 `deliverable_allowed: true`。

## 绝对禁止（白板 / 无风格 / 无布局）

以下任一即 **visual_minimum_fail**，须返工，禁止宣称完成：

1. **白板 pptx**：每页（或绝大多数页）仍是 PowerPoint 默认白底 + 左对齐标题占位 + 纯 bullet 列表，无配色体系、无页型差异
2. **无风格**：未在 manifest/大纲中声明 `style` / `design_tokens` / 主题 preset，且成品视觉像「空白模板一键生成」
3. **无布局**：各页结构相同（全是标题+ bullet）；无 KPI 卡、表格、矩阵、时间线、分栏、封面满幅等 **页级 layout 差异**
4. **空壳 pptx**：文件存在但几乎无形状/表格/背景设置，或仅 1–2 页有内容其余空白
5. **HTML 幻灯**：无 `assets/base.css` / 主题 token、无 layout 类，纯 `<h1><ul>` 堆字

## 交付前最低清单（可编辑 pptx）

| # | 检查项 | 通过标准 |
|---|--------|----------|
| V1 | 配色 | 至少 **背景色 + 1 主强调色 + 1 正文色**（写进 manifest 或 qa_gate） |
| V2 | 页型 | **≥3 种**不同 layout（如封面 / KPI 网格 / 对比表 / 时间线） |
| V3 | 密度 | 咨询/路演类：关键页有 **数据块、SO WHAT 或结论条**；教育类：有章节页与图示区 |
| V4 | 一致性 | 全 deck 同一视觉系统（字体层级、accent、边距），非每页随机 |
| V5 | 可追溯 | `slide_manifest.json`（或等价清单）中 **每页有 `layout` 字段**，且与 pptx 结构对应 |
| V6 | 画布 | 全部形状在 **13.333×7.5 in（16:9）** 内；`canvas_bounds_pass: true`，禁止越界裁切/拉伸 |

## 按技能类型的终态要求

| 技能族 | 终态 | 视觉底线 |
|--------|------|----------|
| cyber-ppt / anth-pptx / ppt-master | `.pptx` | 上表 V1–V5 + [`nova-fast-path.md`](nova-fast-path.md) Golden Path |
| html-ppt | `index.html` | 须用 skill 内 **theme + layout** 模板，禁止无 CSS 裸 HTML |
| nova-ppt-aesthetic-slides | PNG + manifest | 须 **preset** + 逐页 `generate_image`，禁止单色底+一行字 |
| ppt-gorden-* | 图片型 pptx + PNG | 每页 **高信息密度图片**，非空白 slide 截图 |

## qa_gate / manifest 建议字段

```json
{
  "visual_minimum_pass": true,
  "design_tokens": {
    "background": "#0A0A0A",
    "accent_primary": "#44D62C"
  },
  "layout_variants_used": ["full_bleed_title", "grid_2x2_kpi", "competitive_matrix"],
  "canvas_bounds_pass": true,
  "blank_slide_count": 0,
  "deliverable_allowed": true
}
```

`blank_slide_count` 须为 **0**（允许刻意「章节过渡页」，但须有背景+装饰，不算白板）。

## 与「禁 ImageGen 蓝图」的关系

- **禁**：用 AI 生整页图当唯一版式来源、8 风格探索挡交付  
- **不禁**：python-pptx **程序化** Dark Tech / 商务 / 品牌色（雷蛇案成功路径）  
- **原则**：可以不做 ImageGen，**绝不可以**不做 layout 与 visual system
