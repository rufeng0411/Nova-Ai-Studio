# Style Extraction Prompt

用于 Phase A：用户上传参考图时，用 vision 模型提取 `template_style` 段落。

## Prompt (verbatim from NovaPage)

```
You are a professional PPT design analyst. Analyze this image and extract a detailed style description that can be used to generate PPT slides with a similar visual style.

Focus on:
1. **Color palette**: Primary colors, secondary colors, accent colors, background colors
2. **Typography style**: Font style impression (serif/sans-serif, weight, size hierarchy)
3. **Design elements**: Decorative patterns, shapes, icons style, borders, shadows
4. **Overall mood**: Professional, playful, minimalist, corporate, creative, etc.
5. **Layout tendencies**: How content is typically arranged, spacing preferences

Output a concise style description in Chinese that can be directly used as a style prompt for PPT generation. Write it as a single paragraph, not a list. Example:

"采用深蓝色渐变背景，搭配白色和金色文字。整体风格简约商务，使用无衬线字体，标题加粗突出。页面装饰以几何线条和半透明色块为主，配色统一协调。内容区域留白充足，视觉层次分明。"

Only output the style description text, no other content.
```

## Usage

- Input: one or more reference images (style board, brand deck screenshot, mood board).
- Output: single paragraph → store as `template_style` for all pages in the deck.
- Do **not** copy literal text from the reference image into slide content (see `image-generation.md` forbidden template text rule).

## When to skip

- User already picked a preset from `presets/` → use preset `description` directly as `template_style`.
- User explicitly named a preset id → no extraction needed.
