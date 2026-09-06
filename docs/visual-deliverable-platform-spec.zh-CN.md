# Visual Deliverable 平台规范（Discover → Bind → Display）

## 范围

- **L0 平台**：HTML/相对图预览、taskDir 门禁、绑定审计
- **L1 官方配图**：manifest rewrite、Office export 读 manifest
- **L2 能力插件**：Nova Official compose、reference_edit、Campaign/HTML bind
- **L3 Canary**：G700 四案 + live matrix 8 案回归

## 验收命令

```bash
npm run test:visual-deliverable:gate
npm run test:g700:canary:gate
npm run test:visual-deliverable:full
npm run test:g700:canary:full
```

## Display（P0-0）

- `PILOTDECK_PREVIEW_REFERER_AUTH=1`：iframe 子资源从父 HTML Referer 继承 `?token=`
- 审计 gap：`visual_asset.unrenderable_in_preview`

## 回滚

| Flag | 关 |
|------|-----|
| `PILOTDECK_PREVIEW_REFERER_AUTH` | `0` |
| `PILOTDECK_VISUAL_BINDING_AUDIT` | `off` / `shadow` |
| `PILOTDECK_VAP_BIND_BEFORE_WRITE` | `0` |
| `PILOTDECK_OFFICIAL_MEDIA_V2` | `shadow` |
| `PILOTDECK_GOAL_QUALITY_CONTRACT` | `shadow` |

报告目录：`artifacts/visual-deliverable-verification/`、`artifacts/g700-canary-verification/`。
