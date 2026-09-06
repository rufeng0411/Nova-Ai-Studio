# 官方产品大图（禁止 AI 生图）

当用户要求「使用官网实际大图 / 不要生成图片 / 官方素材」时，**必须**走本流程，**禁止**：

- `generate_image` / 任何 AI 绘图
- `web_search` 反复搜图（搜不到 CDN 直链，易超时终止）
- `bash` + `curl` + `grep`（Windows 下常失败，会触发 agent 连续无效工具调用后被 **terminated**）

## 推荐流程（按顺序）

1. **确定官网产品页 URL**（用户未给则用一个合理官方域名页面，如 `https://rog.asus.com/...`）
2. **`fetch_page_images`** 对产品页 URL 提取 CDN 大图直链（首选，免模型、跨平台）
3. 若官网无图：同品类媒体/博客页 → 大门户频道稿（`web_search` 找 URL 后再 `fetch_page_images`）
4. 若仍无图：用 **`web_fetch`** 拉取 HTML 并从 markdown 中提取图片 URL
5. 最后兜底（L4）：HTML 使用占位符，勿硬编假图 URL：

```html
<figure class="img-placeholder" data-source="pending">
  <div class="img-placeholder__frame" role="img" aria-label="图源待补"></div>
  <figcaption>图源待补：官网未提供可用图片，请稍后替换为正式素材。</figcaption>
</figure>
```

6. **`write_file`** 写单文件 HTML，所有 `<img src>` 使用上一步得到的 **https 外链**（或 L4 占位符块）
7. 页脚注明素材来源与官网链接
8. 交付时给出**完整绝对路径**（Windows 示例：`C:\Users\<你>\Documents\...\index.html`）

备用（仅当内置工具不可用时）：`node scripts/extract-page-image-urls.mjs "<产品页URL>" --json`

## 华硕 / ROG 常见 CDN 模式

- 高清产品图：`https://dlcdnwebimgs.asus.com/gain/<UUID>/w2000/h1470/fwebp`
- 页面模块图：`https://dlcdnwebimgs.asus.com/files/media/<uuid>/V1/img/*.jpg|png`

## ROG NUC (2025) RTX 5080 — 已验证可用（2026-06）

产品页：https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/

| 用途 | URL |
|------|-----|
| Hero 产品 | `https://dlcdnwebimgs.asus.com/gain/C9628BBF-3B65-44A9-A1B0-98B3AFC5CED4/w2000/h1470/fwebp` |
| Banner 背景 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/banner.jpg` |
| 游戏场景 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/kv2-m.jpg` |
| Blackwell | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/Blackwell.jpg` |
| DLSS 4 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/DLSS4.jpg` |
| 性能展示 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/performance-1.jpg` |
| 外观设计 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/design-spec.png` |
| 灯效产品 | `https://dlcdnwebimgs.asus.com/gain/E66A83B8-CE58-43D1-BE32-7A0380ADA109/w2000/h1470/fwebp` |
| 散热结构 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/Advanced-Thermal-Design.jpg` |
| 免工具拆装 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/toolless.jpg` |
| 侧面接口 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/connectivity-spec-side.png` |
| 前面板 | `https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/connectivity-spec-front.png` |
| 图集·侧视灯效 | `https://dlcdnwebimgs.asus.com/gain/378BDC73-54F3-4265-9FD3-90A29BCB4423/w2000/h1470/fwebp` |
| 图集·背面 | `https://dlcdnwebimgs.asus.com/gain/4A541ADF-FB00-451F-A4E9-5BA9C52DA49F/w2000/h1470/fwebp` |
| 图集·双机位 | `https://dlcdnwebimgs.asus.com/gain/151DFCC8-48DC-4386-83BB-F63721440B70/w2000/h1470/fwebp` |

## 规格要点（可写入页面，勿编造）

- Intel Core Ultra 9 275HX，最高 5.4 GHz
- NVIDIA GeForce RTX 5080 Laptop GPU
- 约 2.5L，282.4 × 187.7 × 56.5 mm
- DDR5-6400，Wi-Fi 7，最多 5 路 4K 显示

## 参考成品路径

- `artifacts/design/rog-nuc-5080-landing/index.html`（仓库内）
- `C:\Users\rufen\Documents\rog-nuc-5080-landing\index.html`（用户 Documents）
