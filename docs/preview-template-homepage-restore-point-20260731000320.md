# 预览模板+新首页 — 代码还原点

> Preflight 缩略图/详情栅格预览与营销站新首页迭代。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-preview-template-homepage-20260731000320` |
| **Star 别名** | `star/preview-template-homepage`（★ **预览模板+新首页**） |
| **提交** | `31ad76c0` |
| **时间** | 2026-07-31 00:03:20 +0800 |
| **说明** | **预览模板+新首页** — Preflight 预览资产与营销首页迭代 |

```bash
git show restore-point/post-preview-template-homepage-20260731000320 --no-patch --format="%H %s %ci"
git show star/preview-template-homepage --no-patch
```

## 本还原点主要变更

### Preflight 预览模板

- `preflightPreviewResolve` / thumbs + detail WebP（OD / PPT canvas·modes·styles）
- `preflightOdHeroPreview` / `preflightPreviewRaster` 生成链路
- catalog 索引与 Adapter 预览解析加固

### 营销新首页

- `deploy/marketing/` 与 `artifacts/saas-design/product-site/` 首页/docs/GEO
- Vite 营销代理 `viteMarketingProxyPlugin.mjs`
- 品牌守卫 `nova-brand.manifest.json`、README / i18n 同步

### 其他

- `SaasProtectedRoute` 营销跳转与 auth 页微调
- `AGENTS.md` 记忆同步

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeplink.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`

## 如何还原

```bash
git reset --hard restore-point/post-preview-template-homepage-20260731000320
# 或 Star 别名
git reset --hard star/preview-template-homepage
```

## 星标里程碑（未移动）

- ★ 预览模板（接线批）：`star/preview-template` @ `03a45def`
- ★ Grok 4.5：`star/grok-45-experiment` @ `2eaa31fc`
- ★ Bento：`star/bento` @ `b5832404`
- ★ 智谱：`star/zhipu-demo-stable` @ `2873c348`
