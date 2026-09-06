# 预览模板 — 代码还原点

> Preflight Studio 右栏前置选模板接线（open-design / ppt-master）、Launch Registry 与营销站落地。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-preview-template-20260730233622` |
| **Star 别名** | `star/preview-template`（★ **预览模板**） |
| **提交** | `03a45def` |
| **时间** | 2026-07-30 23:36:22 +0800 |
| **说明** | **预览模板** — Preflight Studio 接线与营销站 |

```bash
git show restore-point/post-preview-template-20260730233622 --no-patch --format="%H %s %ci"
git show star/preview-template --no-patch
```

## 本还原点主要变更

### Preflight Studio（预览模板）

- `PreflightStudioAdapter` / `PreflightPreviewPanel` / 虚拟窗口与 Chip
- `src/saas/preflight/` 门控、flag、telemetry
- Launch Registry + `launch.profile.json`（open-design / ppt-master / html-ppt）
- `config/preflight-catalog-*.json` + `ui/public/vendor/preflight/` 预览资产
- 验收：`docs/preflight-studio-acceptance-20260730.zh-CN.md`（M1–M17 / Gateway 实机）

### 营销站

- `deploy/marketing/` + `artifacts/saas-design/product-site/`
- 后台线索 / 邀请码 / 分析页；`006_marketing_site.sql`
- 验收：`docs/marketing-site-acceptance-20260730.zh-CN.md`

### 其他

- SDM / checklist / clarification / 成果路径加固
- fork manifest、pack/云端 flag 注入

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeplink.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`

## 如何还原

```bash
git reset --hard restore-point/post-preview-template-20260730233622
# 或 Star 别名
git reset --hard star/preview-template
```

## 星标里程碑（未移动）

- ★ Grok 4.5：`star/grok-45-experiment` @ `2eaa31fc`
- ★ Bento：`star/bento` @ `b5832404`
- ★ 智谱：`star/zhipu-demo-stable` @ `2873c348`
