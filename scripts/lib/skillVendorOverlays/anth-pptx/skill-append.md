<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 用 `read_skill anth-pptx` 加载本技能。
- 终态必交付真 **`.pptx`** 至 **`<task-artifact-dir>/`**：`《{主题}》演示文稿.pptx`（alias: `presentation.pptx`）。
- **禁止** HTML/脚本/空壳 pptx 充数；**禁止白板/无风格/无布局**（须配色+≥3种页型+manifest layout）；详见 `skills/vendor/cyber-ppt/cyber-ppt/references/nova-ppt-visual-minimum.md`。
- **禁止**首 turn ask_user_question 挡 write_file。
- 用户要 PNG 幻灯包时改 read_skill nova-ppt-aesthetic-slides，勿用本技能替代。
<!-- NOVA-EXEC-END -->
