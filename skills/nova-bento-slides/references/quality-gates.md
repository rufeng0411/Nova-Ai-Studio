# Quality Gates — Blockers / Warnings

对应 `validate-bento-doc.mjs` 与 Nova 交付规则。中文面向 Agent 自检。

## Blockers（必须修复，否则不得交付）

| 代码 | 条件 | 修复 |
|------|------|------|
| B01 | `format !== "bento/slides"` | 修正顶层 format |
| B02 | 缺 `size.width/height` | 设 1280×720 |
| B03 | theme 缺 background/color/accent/fontFamily | 补全四键 |
| B04 | `slides[]` 空 | 至少 1 页 |
| B05 | slide 缺 `id` | 每页唯一 id |
| B06 | slide id 重复 | 重命名 |
| B07 | element 缺 `id` | 补语义 id |
| B08 | 同页 element id 重复 | 重命名 |
| B09 | slide 缺 `notes` 或 strict 下 <20 字 | 写讲稿 |
| B10 | strict：morph 组 <2 | 加 2 组共享 id morph |
| B11 | strict：无 ambient motion | 封面 ken-burns / countUp / loop 任选 |
| B12 | strict：字体族 >2 | 收敛 fontFamily |
| B13 | 文件 >8MB | 压缩图/外链视频 |
| B14 | JSON 含未转义 `<`（html 块内） | `\u003c` |
| B15 | validate 非 0 仍 write_file | 先修再交付 |
| B16 | 并列 index.html / pptx 充数 | 仅 deck.bento.html |
| B17 | strict：`meta.repairedFrom=static-html` | 原生重做，禁止有损转换交付 |
| B18 | strict：≥8 页 deck 无任何 `image`/`chart`/`table` | 补配图或数据可视化 |
| B19 | strict：>50% 页面仅 ≤2 个 text 元素（白板页） | 按 layouts 补 shape/bar/图 |
| B20 | strict：封面无 ambient motion | 加 ken-burns / countUp |

## Warnings（建议修复）

| 代码 | 条件 | 建议 |
|------|------|------|
| W01 | 元素右缘 >1184 | 缩宽或左移 |
| W02 | 数字墙无 chart | 改 bar/line chart |
| W03 | 对比信息手写 text 框 | 改 table |
| W04 | 连续同题页无 morph | 共享 headline/bar |
| W05 | 封面静态无 motion | 加 ken-burns |
| W06 | notes 过短（非 strict 仅 1 字） | 扩写讲稿 |
| W07 | 超过 2 种 accent 色 | 统一 theme.accent |
| W08 | 大图未进 assets | 用 asset:key 自包含 |

## strict 通过示例命令

```bash
node skills/nova-bento-slides/scripts/validate-bento-doc.mjs --strict path/to/deck.bento.html
# ok: true, morphGroups>=2, hasAmbientMotion: true
```

## 内容质量（非脚本，Nova 强制）

- 禁止空壳页（仅「标题待定」）
- 禁止 ask_user 阻塞终态
- 过程文件不进成果区
