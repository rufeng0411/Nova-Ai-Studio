# 部分案例上传 — 代码还原点

> Showcase 部分案例上架、文案/合规可读预览、缺图 Logo 位图与全案 PPT 16:9 contain 适配。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-partial-showcase-upload-20260804063414` |
| **Star 别名** | `star/partial-showcase-upload`（★ **部分案例上传**） |
| **提交** | `d0145ae8` |
| **时间** | 2026-08-04 06:34:14 +0800 |
| **说明** | **部分案例上传** — Showcase 案例上架与预览 UX |

```bash
git show restore-point/post-partial-showcase-upload-20260804063414 --no-patch --format="%H %s %ci"
git show star/partial-showcase-upload --no-patch
```

## 本还原点主要变更

### Showcase 上架与目录

- 文案 6 / 合规 6★ / 视频 2 / 研究分析 4 等案例媒体与 catalog
- `copy-reader` + `copy-packs`：Markdown 合并可读预览
- 文案 / 企业合规：标题列表（无预览图）；其他栏目缺图用 Logo 位图兜底
- 全案 PPT / 1920×1080 幻灯：`fitFrame` contain 16:9 自适应（`presentation.pptx` → `promo.html` 孪生预览）
- EN `/showcase` 共享 viewer/media 路径；SW/缓存版本 bump

### 同批相关

- Open Design 模板注册与 Batch B 技能
- Markdown 分享 / MdBrowser / 工作台氛围
- prefer-generate-image 与能力 catalog / Hub 同步

## 回退

```bash
git reset --hard restore-point/post-partial-showcase-upload-20260804063414
# 或
git reset --hard star/partial-showcase-upload
```

## 验收速记

- `/showcase/#copy` → 标题列表；点开可读预览有正文
- `/showcase/#compliance` → 标题列表（无缩略图）
- `/showcase/viewer-sc-fullcase-outline-video.html` → `presentation.pptx` / `promo.html` 完整 16:9 contain
- 缺真实 thumb 的全案卡 → Logo 位图，无裂图
