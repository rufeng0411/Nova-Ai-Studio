# Bento Deck 集成说明

**状态：Go**（2026-07-29）

## Phase 0 结论

| 检查项 | 结果 |
|--------|------|
| Bento 壳 vendor | `ui/public/vendor/bento/Bento_Slides.bento.html`（~659KB，MIT） |
| iframe 预览 | SaaS `/preview/` 同源加载，CSP 沿用 `PREVIEW_CSP`（`unsafe-inline` script） |
| 保存桥接 | `BentoDeckAdapter` postMessage `bento-request-doc` → splice `#bento-doc` → PUT |
| 写策略 | 独立 `bentoWritePolicy.js`，8MB 上限（`BENTO_DECK_MAX_BYTES`） |
| htmlStudio 隔离 | `*.bento.html` 排除 HTML Studio 2MB/script 限制 |

## 路由优先级

1. `*.bento.html` → `carrierScope: bento_deck`（先于 `slide_deck_html`）
2. `resolveEditAdapter` → `bentoDeck` 优先于 `htmlStudio`
3. 成果点击 → `bentoStudioMode: 'edit'` 右栏直开

## 四种幻灯形态选型（用户向）

| 需求 | 能力 |
|------|------|
| **默认可编辑 + 动效** | nova-bento-slides → `deck.bento.html` |
| Office 原生 .pptx | ppt-master / anth-pptx |
| 网页放映 / Reveal | html-ppt |
| 美学 PNG + OCR 导出 | nova-ppt-aesthetic-slides |

## Flag

- `VITE_BENTO_DECK_PREVIEW=1` 启用（dev:saas 默认建议开启）
- `VITE_BENTO_DECK_PREVIEW=0` 回滚至 web 预览

## 运维

- nginx `client_max_body_size` ≥ 8m（与写策略对齐）
- 升级 Bento 壳：`npm run vendor:bento`
