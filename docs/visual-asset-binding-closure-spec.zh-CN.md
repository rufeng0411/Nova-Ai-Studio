# VAP 配图绑定闭环规范

## 产品原则

**磁盘上的官图不是成果；写进交付物且预览可访问才是成果。**

## 四段闭环

1. **Discover**：`resolve_session_visual_assets` / VAP orchestrator → `visual-asset-manifest.json`
2. **Bind**：Agent 写 HTML/slide 时引用 manifest `preparedPath/rawPath`
3. **Validate**：`deliverableVisualBindingAudit` 扫描交付物引用；`official_only` 下 `generate_image` 不计官图
4. **Correct**：用户「配图不对」→ `detectVisualCorrectionMutation` → repair + manifest 路径 recovery

## 模块

| 模块 | 路径 |
|------|------|
| Binding audit | `src/saas/media/visualAssetPlatform/deliverableVisualBindingAudit.ts` |
| Write gate | `src/saas/media/visualAssetPlatform/vapBindBeforeWrite.ts` |
| Official slide compose | `src/saas/media/visualAssetPlatform/officialSlideCompose.ts` |

## Flag

| Flag | dev | prod 节奏 |
|------|-----|-----------|
| `PILOTDECK_VISUAL_BINDING_AUDIT` | shadow | shadow → enforce |
| `PILOTDECK_VAP_BIND_BEFORE_WRITE` | 1 | shadow → enforce |
| `PILOTDECK_VISUAL_ASSET_PLATFORM` | shadow | off → shadow → enforce |

## 验收

```bash
npm run test:visual-asset-binding:acceptance
npm run test:visual-binding:live:gate
```

## 回滚

- `PILOTDECK_VISUAL_BINDING_AUDIT=off`
- `PILOTDECK_VAP_BIND_BEFORE_WRITE=0`
