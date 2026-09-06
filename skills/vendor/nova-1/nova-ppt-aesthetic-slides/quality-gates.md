# Quality Gates

交付前 Agent 与用户（可选）对照本清单。任一 **Blocker** 未通过则不得宣称 deck 完成。

---

## Blockers（必须全部通过）

### 1. Pipeline 完整性

- [ ] 存在 Phase B 大纲产物（`outline.json` 或等价结构）
- [ ] 每页均有 Phase C `page_description`（非空）
- [ ] 每页均有 Phase D 配图文件或 manifest 中 documented 的 `status: failed` + 原因
- [ ] **未**跳过页描述直接批量出图
- [ ] **未**使用 HTML/SVG/CSS、`open-design`、`od-deck-magazine` 替代本 Skill
- [ ] PilotDeck 中每页配图均来自 **`generate_image`** 且带显式 `output_path`

### 2. 页数与顺序

- [ ] `manifest.page_count` = 实际 PNG 数量（失败页除外需说明）
- [ ] `page_index` 从 1 连续递增，无重复/跳号
- [ ] 文件名或 manifest 中 `image_path` 与页序一致

### 3. 风格一致

- [ ] 全 deck 共用同一 `preset_id` 或同一 `template_style` 快照
- [ ] 锁色 hex（若 preset）在各页视觉中未明显漂移
- [ ] 未混用两套预设（除非用户明确要求分段 deck）

### 4. 风格/内容分离

- [ ] 大纲 `points` 不含大段视觉风格散文
- [ ] `page_description` 描述布局与内容，非重复 preset 全文
- [ ] `template_style` 仅出现在生图 extra_requirements，不污染大纲 JSON

### 5. 画幅

- [ ] manifest `aspect_ratio` 为 `16:9` 或 `9:16`
- [ ] 各 PNG 宽高比与 manifest 一致（允许 ±2% 裁切误差）

### 6. 封面（page_index = 1）

- [ ] 标题视觉权重明显高于内页
- [ ] 信息密度低于内页（极简规则）
- [ ] 使用了封面强化 prompt（见 image-generation.md）

---

## Warnings（建议修复，非强制）

### 文字可读性

- [ ] 幻灯片上文字清晰、对比度足够
- [ ] 无大面积乱码、无未渲染 markdown 符号（`#`、`*`、`|`）
- [ ] 页描述中无「修复——」类 meta 或同句重复堆砌
- [ ] 中英混排无严重重叠

### 路径与预览

- [ ] 对话中引用的文件路径与磁盘一致（`artifacts/slides-{deck_id}/slide-NN.png`）
- [ ] `NN` 不超过 `page_count`（8 页 deck 不得出现 `slide-09.png`）

### 模板参考图

- [ ] 若提供 template_image：画面风格相似但未复制图中文字
- [ ] 若提供 material_images：素材使用合理，非随机贴图

### 内容覆盖

- [ ] 页描述要点在大纲 `points` 中有对应，无重大遗漏
- [ ] 无整页空白或仅占位插画无信息

---

## Regression scenarios（来自描述 prompt 优化测试语义）

人工或 Agent 抽检以下场景是否仍满足分离与封面规则：

| 场景 | 期望 |
|---|---|
| 用户主题含「赛博朋克蓝色渐变」 | 风格进 `template_style`，大纲只讲业务要点 |
| 8 页企业培训 deck | 第 1 页描述最短，强调主标题 |
| `detail_level=concise` | 内页描述短句、少装饰性布局说明 |
| `detail_level=detailed` | 内页含分区与图表类型建议，仍无 preset 全文 |
| 竖屏 9:16 | API 与 manifest 均为 9:16，非 16:9 拉伸 |

---

## Sample-first gate（强烈推荐）

- [ ] 批量生成前已产出 ≥1 张样张并获用户确认（或 Agent 自检通过 preset hex 与构图）

---

## Acceptance themes（仓库内置验收）

固定主题见 [acceptance/README.md](acceptance/README.md)：

1. **2026 企业 AI 培训** — preset `tech-modern` 或 `business-simple`
2. **新消费品牌路演** — preset `gradient-vibrant` 或 `creative-fun`

每主题 ≥6 页 PNG + 完整 manifest 即视为 Skill 验收通过。
