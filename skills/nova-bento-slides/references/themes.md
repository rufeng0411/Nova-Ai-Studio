# Theme Presets（16）

全 deck 锁定 **1 preset**；`theme` 四键必填：`background`、`color`、`accent`、`fontFamily`。

| id | background | color | accent | fontFamily | tags |
|----|------------|-------|--------|------------|------|
| `graphite-peach` | `#101418` | `#F2F0EA` | `#FF9E8A` | `system-ui, sans-serif` | 默认, editorial, Nova |
| `paper-navy` | `#F6F4EF` | `#0D1B2E` | `#E8442E` | `Georgia, serif` | 浅色, 商务, 汇报 |
| `midnight-cyan` | `#0B0E1E` | `#E8ECF4` | `#22D3EE` | `system-ui, sans-serif` | 深色, 科技, SaaS |
| `ink-violet` | `#0F1724` | `#F2F0EA` | `#7A5CFF` | `system-ui, sans-serif` | 深色, 产品发布 |
| `warm-slate` | `#ECEAE4` | `#1E2A3A` | `#C25A43` | `system-ui, sans-serif` | 浅色, 温暖, 品牌 |
| `forest-mint` | `#0F1A14` | `#E6F4EE` | `#34D399` | `system-ui, sans-serif` | ESG, 健康, 增长 |
| `rose-gold` | `#1A1218` | `#FAF0F3` | `#F472B6` | `Georgia, serif` | 时尚, 消费, 路演 |
| `ocean-blue` | `#081820` | `#E0F2FE` | `#38BDF8` | `system-ui, sans-serif` | 金融, 数据, 可信 |
| `sunset-amber` | `#141010` | `#FFF7ED` | `#FB923C` | `system-ui, sans-serif` | 能源, 制造,  keynote |
| `mono-ink` | `#FFFFFF` | `#111111` | `#111111` | `system-ui, sans-serif` | 极简, 黑白, 学术 |
| `lavender-gray` | `#F3F0FA` | `#2D2640` | `#8B5CF6` | `system-ui, sans-serif` | 教育, 协作, 浅色 |
| `charcoal-lime` | `#121212` | `#F5F5F5` | `#A3E635` | `system-ui, sans-serif` | DevRel, 黑客, 对比强 |
| `sand-terracotta` | `#F5F0E8` | `#3D2C29` | `#C05621` | `Georgia, serif` | 文旅, 手工, 叙事 |
| `steel-indigo` | `#151922` | `#DDE4F0` | `#6366F1` | `system-ui, sans-serif` | 企业 IT, B2B |
| `ice-arctic` | `#F0F9FF` | `#0C4A6E` | `#0284C7` | `system-ui, sans-serif` | 医疗, 科研, 冷色 |
| `night-gold` | `#0A0A0A` | `#FAFAFA` | `#D4AF37` | `Georgia, serif` | 高端, 奢侈品, 深色 |

## 用法

```json
"theme": {
  "background": "#101418",
  "color": "#F2F0EA",
  "accent": "#FF9E8A",
  "fontFamily": "system-ui, sans-serif"
}
```

- 每页 `slide.background` 可微调（通常与 theme.background 同或 paper 变体）
- **strict**：全 doc 字体族 ≤2；优先 `theme.fontFamily` + 一个 display 备选（同族不同 weight 不算第二字体）
