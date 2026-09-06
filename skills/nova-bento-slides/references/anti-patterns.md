# Anti-Patterns

## 格式 / 交付

| ❌ 反模式 | ✅ 做法 |
|----------|---------|
| 手改 560KB shell HTML | `splice-bento-shell.mjs` |
| 交付 index.html / 空 pptx | 仅 `deck.bento.html` |
| validate 失败仍 write_file | 修到 `--strict` 通过 |
| ask_user 问卷挡交付 | Strategist 默认 + spec 假设 |

## 视觉 / 动效

| ❌ 反模式 | ✅ 做法 |
|----------|---------|
| 纯 bullet 静态页 | chart / table / morph / motion |
| 每页随机 element id | id-registry 稳定 chrome |
| 封面静态全图 | ken-burns + scrim |
| 趋势数字排成 text 列表 | bar/line chart |
| 定价对比 20 个 text 框 | table |
| 同题连续页硬切 | morph 共享 headline/bar |
| 3+ 种 accent 色 | 单一 theme.accent |
| 4+ 字体族 | ≤2（strict 门禁） |

## 数据

| ❌ 反模式 | ✅ 做法 |
|----------|---------|
| chart series 用 `{name,value}` 在 bar | bar 用纯数字数组 |
| 函数 formatter | 模板 `{b}:{c}` |
| 10MB 视频 base64 | 外链 URL + poster |

## JSON / 文件

| ❌ 反模式 | ✅ 做法 |
|----------|---------|
| JSON 内裸 `<` | `\u003c` |
| 编辑时改 docId | 保留原 docId |
| 内容超出 x=1184 | 96px 边距内排版 |

## Nova 流程

| ❌ 反模式 | ✅ 做法 |
|----------|---------|
| 批量脚本生成「创意」slides | Phase E 手写 elements |
| 跳过 outline/spec | B→C→D→E 串行 |
| bento-spec 当成果交付 | 过程文件，成果仅 deck |

## 最常见 #1 失败

**正确但静态** — 格式合法却无 morph、无 chart、无 motion。交付前对照 agents-guide 自检表。
