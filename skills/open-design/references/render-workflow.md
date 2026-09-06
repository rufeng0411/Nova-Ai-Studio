# 渲染与交付流程

## 1. 产物生成

- 先根据方向/品牌绑定 `:root` token。
- 再填充结构与内容，生成 HTML 文件（如 `artifact.html`）。
- **官网大图任务**：禁止 AI 生图；用 `fetch_page_images` / `web_fetch` 取官方 CDN URL（详见 `official-product-images.md`）。

## 2. 预览校验

- 使用工作区 HTML 预览确认：
  - 首屏层级
  - 响应式断点是否破版
  - 关键 CTA 与文本可读性

## 3. 自检

- 执行 `anti-slop-checklist.md`。
- 执行 `critique.md` 五维自评。

## 4. 交付

- 交付路径 + 简短说明（风格、核心模块、可改点）。
- 若用户需要演示稿导出，复用 `frontend-slides` 的导出路径（Playwright PDF）。

## 5. 迭代

- 用户反馈优先落到：结构层级 > 可读性 > 风格细节。
- 每轮迭代只引入 1-2 个主要变化，保证可比较。

