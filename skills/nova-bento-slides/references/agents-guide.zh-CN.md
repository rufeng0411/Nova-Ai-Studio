# Bento Slides Agent 指南（Nova 版）

> 格式 `bento/slides` v1。文档 JSON 是唯一真相源；未知字段会被忽略，不会报错。

## Nova 硬规则（优先于一切）

1. **终态唯一**：`<task-artifact-dir>/deck.bento.html` — 禁止并列 `index.html` / 空壳 `pptx`
2. **禁止手改壳**：560KB `Bento_Slides.bento.html` 仅经 `scripts/splice-bento-shell.mjs` 注入 JSON
3. **禁止 ask_user 挡交付**：缺信息用合理默认；Strategist-lite 三项可在 spec 中假设
4. **validate 门禁**：`validate-bento-doc.mjs --strict` 非 0 不得 write_file 终态
5. **过程文件**（非成果区）：`bento-spec.md`、`outline.json`
6. **Office / Reveal / 美学 PNG** 分流：见 SKILL.md 负面触发词

## 所见所得（WYSIWYG，硬规则）

右栏 Bento 编辑器里的视觉 **必须** 与生成时一致，禁止「预览好看、编辑变样」或「只有文字框」：

1. **配色**：`theme.background/color/accent/fontFamily` 须锁定 bento-spec；accent 用于 bar/kicker/强调字；禁止全 deck 仅黑白灰
2. **字体层级**：封面 headline 56–76px/900；章节 40–48px/700；正文 16–22px/400–500；全 deck ≤2 种 fontFamily
3. **配图**：产品/场景/封面图须 `type:"image"` + `doc.assets`（`resolve_session_visual_assets` / `fetch_page_images` 本地化）；禁止 `<img>` 外链不收录 assets
4. **版式**：按 [layouts.md](layouts.md) 配方坐标（`x≥96`，`x+w≤1184`）；内容页至少 shape+text 三层（底/栏/字）；数据用 chart/table
5. **动效**：封面 ken-burns；≥2 组 morph；数字墙 countUp 或 chart enter
6. **禁则**：禁止 write_file 静态 HTML 到 `*.bento.html`；禁止 repair-static-html 有损转换交付；validate --strict 不过不得交

## 文档结构

```json
{
  "format": "bento/slides", "version": 1, "title": "...",
  "size": { "width": 1280, "height": 720 },
  "theme": { "background", "color", "accent", "fontFamily" },
  "slides": [{ "id", "background", "transition", "notes", "elements": [] }]
}
```

- 写入 `.bento.html` 时 JSON 内 `<` 须转义为 `\u003c`
- 保留 `docId`；编辑时勿重生
- 画布 1280×720；左右 **96px** 边距（内容右缘 ≤ 1184）

## 元素类型速查

| 类型 | 用途 |
|------|------|
| `text` | 标题/正文；`html` 支持 `<b><i><br>` |
| `shape` | 矩形/椭圆/线/路径；accent bar、scrim、卡片底 |
| `image` | `src` 为 data URI 或 `asset:<key>`（写入 `doc.assets`） |
| `chart` | `preset: bar|line|pie`；series 数据为**纯数字** |
| `table` | 对比/定价/规格网格 |
| `media` | 短视频 embed 或外链（大文件勿 base64） |

## 动效映射（好 deck 的核心）

| 素材形态 | 用法 |
|----------|------|
| 趋势/占比数字 | **chart** |
| 行列对比 | **table** |
| 同一主题连续页 | **morph**（共享 `id` + `transition:"morph"`） |
| 封面/全幅图 | **ken-burns** + scrim + 文字 |
| 英雄数字 | `fx.countUp: true` |
| 流程/连线 | `line` + `dash-march` loop |
| 可点击详情 | `link` → `stateOf` 隐藏页 |

## morph 要点

- 相邻页 `transition: "morph"` 且**相同 element id** → 位置/尺寸/颜色平滑过渡
- 每 deck 至少 **2 组** morph（strict 门禁）
- 稳定 chrome（logo、headline、bar）跨页复用 id — 见 [id-registry.md](id-registry.md)

## fx 常用

```json
"fx": { "enter": "fade-up", "order": 0 }
"fx": { "ambient": "kenburns", "ken": { "dir": "drift", "scale": 1.08, "duration": 20 } }
"fx": { "countUp": true }
"fx": { "loop": { "type": "dash-march", "duration": 3 } }
```

## 自检（交付前）

- [ ] 数字是否该用 chart 而非纯文本？
- [ ] ≥2 组 morph？封面是否有 ambient motion？
- [ ] 每页 `notes` ≥20 字（strict）？
- [ ] 字体 ≤2 种？accent 单一？
- [ ] 右缘 ≤1184？无未转义 `<`？

## 工作流

1. Strategist-lite → 2. `bento-spec.md` → 3. `outline.json` → 4. 逐页 elements → 5. splice → 6. validate --strict

续跑：[../workflows/resume-bento.md](../workflows/resume-bento.md)
