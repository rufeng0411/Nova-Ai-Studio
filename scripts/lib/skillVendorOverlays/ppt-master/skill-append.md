<!-- NOVA-EXEC-BEGIN -->
## Nova Ai-Studio 集成

- 终态只交 **`<task-artifact-dir>/presentation.pptx`**。SVG / spec_lock 只作过程文件，不进成果清单、不进 SDM 槽。
- `SKILL_DIR` 固定为本仓 `skills/vendor/ppt-master` 的绝对路径；禁止向用户询问路径。
- Nova Web/SaaS **一律**禁止 spawn Flask `:5050`、禁止八确认 BLOCKING、禁止首 turn 页数/模板 `ask_user_question`。默认 8–10 页 16:9；若已有 `<launch-context capability="ppt-master">` 则用其中画幅/模式/风格，仍不开 Flask。
- 默认走 Generate PPTX ordinary（`workflows/generate-pptx.md`）。仅用户点名美化已有 pptx / 填模板 / 图转 PPT 且已选本卡时才改路由。
- 未点名本卡的商务 PPT 仍走 `anth-pptx`。图转 PPT 已有 Gorden 卡时不抢路由。
- **禁止** HTML/空壳 pptx 充数。保留上游 `attribution_guard.py` 完整性门禁，不要跳过。
<!-- NOVA-EXEC-END -->
