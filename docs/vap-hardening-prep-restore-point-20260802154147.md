# 准备加固vap — 代码还原点

> VAP 加固开工前基线：Showcase/营销站、蒸馏与四线假 incomplete 补强已入库。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-vap-hardening-prep-20260802154147` |
| **Star 别名** | `star/vap-hardening-prep`（★ **准备加固vap**） |
| **提交** | `95b66a43` |
| **时间** | 2026-08-02 15:41:47 +0800 |
| **说明** | **准备加固vap** — Showcase/营销基线与四线补强 |

```bash
git show restore-point/post-vap-hardening-prep-20260802154147 --no-patch --format="%H %s %ci"
git show star/vap-hardening-prep --no-patch
```

## 本还原点主要变更

### 营销 Showcase / 多语

- `deploy/marketing/showcase/` + `artifacts/saas-design/demos-showcase/`
- EN 页、about/copyright、FAQ/法务弹层、PWA/SEO
- 后台 `ShowcaseAdminPage` / `MarketingPagesAdminPage`、`007_showcase.sql`

### 蒸馏 / 四线

- viral-article style routing 与 skill references
- 0731 false-incomplete 门禁与 fixture（Nike/小米/PWA）
- repair circuit / PPT policy / SDM 微调

### 其他

- Hub 能力中心 UI、模型路由模板
- 侧栏账户与后台样式
- AGENTS.md 记忆同步

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeplink.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`

## 如何还原

```bash
git reset --hard restore-point/post-vap-hardening-prep-20260802154147
# 或 Star 别名
git reset --hard star/vap-hardening-prep
```

## 星标里程碑（未移动）

- ★ 蒸馏问题修复-1：`star/distill-fix-1` @ `169c92eb`
- ★ 预览模板+新首页：`star/preview-template-homepage` @ `31ad76c0`
- ★ 预览模板：`star/preview-template` @ `03a45def`
- ★ Grok 4.5：`star/grok-45-experiment` @ `2eaa31fc`
- ★ Bento：`star/bento` @ `b5832404`
- ★ 智谱：`star/zhipu-demo-stable` @ `2873c348`
