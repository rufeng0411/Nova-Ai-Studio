// PD-SAAS-FORK: system-prompt append for media routing (Goal Loop Step-J).

import {
  isMediaStrategyResolverEnabled,
  resolveMediaStrategy,
  type MediaStrategy,
} from "./mediaStrategyResolver.js";
import {
  isImageApiReady,
  isSpeechApiReady,
  isTtsApiReady,
  isVideoApiReady,
  type MediaRuntimeEnv,
} from "./mediaRuntimeProbe.js";
import {
  isCreativePreferGenActive,
} from "./creativeGenerateImageIntent.js";
import { isPreferGenerateImageEnforce } from "./preferGenerateImageFlags.js";
import { shouldBypassLegacyVisualMediaDegrade } from "./visualMediaDegradePolicy.js";

const MEDIA_DEGRADE_FOOTER =
  "同一配图位生图/搜图/抓取最多 2 次，仍失败须 write_file SVG/CSS 占位图并继续交付 HTML/docx/PDF，禁止空转。";

const CREATIVE_GENERATE_IMAGE_INSTRUCTION =
  "媒体策略：创意主视觉（海报/封面/杂志/落地页 Hero）优先 generate_image 落盘 PNG，再 write_file HTML 引用；海报/Hero≈1 次、杂志≤3。禁止首轮 CSS/SVG 冒充主视觉；勿先搜官图（用户要官图除外）。鉴权/欠费须停并说明配置；瞬时失败最多 2 次后才可标注占位。";

const CREATIVE_GENERATE_IMAGE_ENFORCE_FOOTER =
  "enforce：先 PNG 再 HTML；禁止以无标注 CSS/SVG 作为主视觉完成态。";

const STRATEGY_INSTRUCTIONS: Record<Exclude<MediaStrategy, "default">, string> = {
  official_fetch:
    "媒体策略：用户要官网/官方产品图时，优先 resolve_session_visual_assets(phase_a) 读取 visual-asset-manifest，再按需 fetch_page_images→fetch_media_asset 本地化；写 HTML/slide 必须引用 manifest 路径，禁止 generate_image 臆造官方摄影图，禁止 placeholder.svg 冒充官图。",
  export_document:
    `媒体策略：用户要 PPT/PDF/报告导出时，优先 export_document / compose_images_to_document，勿空转生图。${MEDIA_DEGRADE_FOOTER}`,
  generate_image:
    `媒体策略：用户要 AI 配图且非官方图时，优先 generate_image；图片 API 未配置或多次失败时须降级 SVG/占位图。${MEDIA_DEGRADE_FOOTER}`,
  generate_video:
    "媒体策略：用户要可直接播放的 mp4 成片且视频 API 已配置时，首轮优先 generate_video；勿先用 render_html_video、Remotion 或 HyperFrames，除非用户明确要可编辑工程或 HTML 录屏。",
  generate_speech:
    "媒体策略：用户要配音/旁白/TTS 且语音 API 已配置时，优先 generate_speech；未配置时可降级 Wonda CLI（wonda generate tts）。",
  transcribe_audio:
    "媒体策略：用户要转写/听写/会议纪要且语音识别 API 已配置时，优先 transcribe_audio；未配置时可降级 Wonda transcribe。",
  render_html_video:
    "媒体策略：仅当无视频大模型 API 或用户明确要求 HTML/Remotion 可编辑工程时，才使用 render_html_video。",
  hyperframes:
    "媒体策略：HyperFrames 成片任务须 read_skill hf-* → taskArtifactDir/hf-project/ → render_hyperframes → promo.mp4；"
    + "禁止首轮 generate_video；shadow 模式可披露降级但须说明原因。",
};

export function buildMediaStrategyAppendPrompt(
  userGoal: string,
  capabilitySlug: string | undefined,
  env: MediaRuntimeEnv = process.env,
): string | undefined {
  if (!isMediaStrategyResolverEnabled()) return undefined;
  const goal = String(userGoal ?? "").trim();
  if (!goal) return undefined;

  const strategy = resolveMediaStrategy(goal, capabilitySlug, env);
  if (strategy === "default") return undefined;

  let instruction: string | undefined =
    strategy === "official_fetch"
    && shouldBypassLegacyVisualMediaDegrade(goal)
      ? "媒体策略：官方素材 FSM 独占降级决策。固定执行 fetch_page_images → fetch_media_asset → write_file → render_local_html_to_image/export_document；禁止 generate_image，禁止提前写占位图，预算耗尽后仅按系统注入的占位或缺口策略继续。"
      : STRATEGY_INSTRUCTIONS[strategy];

  // PD-SAAS-FORK: creative prefer-generate — stronger PNG-first copy; enforce forbids CSS-first footer.
  if (
    strategy === "generate_image"
    && isCreativePreferGenActive({ goal, slug: capabilitySlug, env })
  ) {
    instruction = isPreferGenerateImageEnforce(env)
      ? `${CREATIVE_GENERATE_IMAGE_INSTRUCTION}${CREATIVE_GENERATE_IMAGE_ENFORCE_FOOTER}`
      : CREATIVE_GENERATE_IMAGE_INSTRUCTION;
  }

  if (!instruction) return undefined;

  const readiness: string[] = [];
  if (isVideoApiReady(env)) readiness.push("video=ready");
  if (isImageApiReady(env)) readiness.push("image=ready");
  if (isTtsApiReady(env)) readiness.push("tts=ready");
  if (isSpeechApiReady(env)) readiness.push("speech=ready");

  return [
    "<media-strategy>",
    instruction,
    readiness.length > 0 ? `已探测：${readiness.join(", ")}` : "部分媒体 API 未配置，降级路径须在回复中说明。",
    "</media-strategy>",
  ].join("");
}
