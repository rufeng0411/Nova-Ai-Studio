<!-- NOVA-EXEC-BEGIN -->
## Nova 执行约束（必读）

- 用 `read_skill hf-slideshow` 加载本技能；禁止依赖 slash 命令或 `npx hyperframes skills update`。
- HyperFrames 工程目录必须写在当前会话 **taskArtifactDir/hf-project/**（禁止仓库根或工作区根 init）。
- 本技能为幻灯/HTML 工程：交付 deck HTML 或 slide 清单；**不要求** promo.mp4。
- 禁止 ask_user_question 偏好问卷挡交付；TTS 默认跳过或使用 Kokoro；缺 HeyGen/ElevenLabs 不阻断 mp4。
- HyperFrames Studio URL 仅过程链接，**不得**作为终态交付；禁止仅交 md/分镜充数。
- 官网/产品图须先 VAP/fetch 本地化进 task 目录；composition HTML **禁止渲染期外链**。
<!-- NOVA-EXEC-END -->
# hf-slideshow

Vendored HyperFrames workflow (stub until upstream vendor refresh).
