# Style vs Content Separation

当已配置 `template_style`（或已选定预设）时，**必须**注入以下规则，防止大纲/页描述被画风带偏。

## Outline phase

```
Important: A separate visual/art style is reserved for slide imagery only (template_style).
Outline titles and bullet points must reflect the substantive topic in the user request below.
Do NOT let that visual style (e.g. ink wash, cyberpunk, watercolor) become the main angle of
every slide unless the user topic explicitly concerns that art form.
```

## Page description phase

```
## 风格与正文分离
项目已为幻灯片配图单独配置了整体视觉风格（template_style）；「页面文字」须紧扣用户主题与大纲要点，
勿用大段笔墨描写画风、笔触、水墨晕染、色调氛围等视觉技法，除非用户原始需求本身即为艺术类内容。
```

## Refinement phase

```
Style vs. content: template_style applies to imagery only. When revising outlines or page text,
keep substance and topic first; do not turn art style into the main content of each slide.
```

## Reference grounding (optional)

若用户提供参考资料：

```
## Topic grounding from reference files
If uploaded/reference files are provided, infer the true presentation topic from their content first.
Treat phrases like "根据附件做PPT", "基于资料生成PPT", "做一个PPT", or similar workflow instructions as task commands, not as the presentation topic.
When the user request is generic but the reference files are substantive, summarize the files into a concrete theme and build the outline around that theme instead of PPT-making tips or methodology.
```

## Agent checklist

- [ ] 风格词只出现在 `template_style`，不出现在大纲 bullet 正文
- [ ] 页描述「页面文字」块无大段视觉技法描写
- [ ] 用户说「水墨风 PPT 讲 AI」时，主题是 AI，水墨仅在配图风格
