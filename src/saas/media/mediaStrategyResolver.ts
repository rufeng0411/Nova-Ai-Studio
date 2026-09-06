// PD-SAAS-FORK: Goal Loop P2 Step-J — media strategy resolver (feature-flagged).

import {
  VIDEO_HTML_EXCLUDE_PATTERN,
  isScriptDraftGoal,
  isVideoMp4FilmGoal,
} from "../deliverableCapabilityProfiles.js";
import {
  isHyperframesEngineEnabled,
  isHyperframesVideoSlug,
  goalExplicitlyWantsHyperframes,
} from "./hyperframesEngineFlags.js";
import { compileOfficialMediaRequirement } from "../constraints/officialMediaRequirement.js";
import { shouldRouteCreativeGenerateImage } from "./creativeGenerateImageIntent.js";
import {
  isImageApiReady,
  isSpeechApiReady,
  isTtsApiReady,
  isVideoApiReady,
  type MediaRuntimeEnv,
} from "./mediaRuntimeProbe.js";

export type MediaStrategy =
  | "official_fetch"
  | "export_document"
  | "generate_image"
  | "generate_video"
  | "generate_speech"
  | "transcribe_audio"
  | "render_html_video"
  | "hyperframes"
  | "default";

export function isMediaStrategyResolverEnabled(): boolean {
  return process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER === "1"
    || process.env.PILOTDECK_GOAL_LOOP_PHASE2 === "1";
}

function wantsRenderedVideo(goal: string): boolean {
  if (VIDEO_HTML_EXCLUDE_PATTERN.test(goal)) return false;
  if (isScriptDraftGoal(goal) && !isVideoMp4FilmGoal(goal)) return false;
  if (isVideoMp4FilmGoal(goal)) return true;
  return /(?:\bmp4\b|成片|预览视频|AI\s*视频|宣传视频|产品视频|文生视频|视频模型)/i.test(goal)
    && !/(?:脚本|口播|分镜|旁白|台词|讲稿)/i.test(goal);
}

function wantsRemotionOrHtmlVideo(goal: string): boolean {
  return /(?:Remotion|HyperFrames|render_html_video|HTML\s*录屏|HTML\s*代码做视频|可编辑工程|时间轴)/i.test(goal);
}

function wantsTts(goal: string): boolean {
  return /(?:配音|旁白|TTS|语音合成|读出来|朗读|generate_speech|口播音频|mp3)/i.test(goal)
    && !/(?:转写|听写|transcribe|会议纪要|语音识别)/i.test(goal);
}

function wantsTranscription(goal: string): boolean {
  return /(?:转写|听写|transcribe|会议纪要|语音识别|ASR|speech\s*to\s*text|transcribe_audio)/i.test(goal);
}

export function resolveMediaStrategy(
  userGoal: string,
  capabilitySlug?: string,
  env: MediaRuntimeEnv = process.env,
): MediaStrategy {
  const goal = String(userGoal ?? "");
  const slug = String(capabilitySlug ?? "").toLowerCase();

  if (
    isHyperframesEngineEnabled()
    && (isHyperframesVideoSlug(slug) || goalExplicitlyWantsHyperframes(goal))
  ) {
    return "hyperframes";
  }

  const officialRequirement = compileOfficialMediaRequirement(goal);
  if (
    officialRequirement.officialMediaPolicy !== "none"
    || /(?:官方(?:渠道)?(?:图片|配图|图像|素材|产品图)|官网(?:图片|配图|素材|产品图)|fetch_page_images)/i.test(goal)
  ) {
    return "official_fetch";
  }
  if (/(?:PPT|PPTX|PDF|报告|export_document|幻灯)/i.test(goal)) {
    return "export_document";
  }

  if (wantsTranscription(goal) && isSpeechApiReady(env)) {
    return "transcribe_audio";
  }
  if (wantsTts(goal) && isTtsApiReady(env)) {
    return "generate_speech";
  }

  if (wantsRenderedVideo(goal) || /tool-generate-video|od-video-gen|seedance|即梦|happyhorse/i.test(slug)) {
    if (isVideoApiReady(env) && !wantsRemotionOrHtmlVideo(goal)) {
      return "generate_video";
    }
    if (wantsRemotionOrHtmlVideo(goal)) {
      return "render_html_video";
    }
    if (!isVideoApiReady(env)) {
      return "default";
    }
  }

  if (/generate_image|生图|AI\s*绘图/i.test(goal) && !/官方图|官网图/.test(goal)) {
    return isImageApiReady(env) ? "generate_image" : "default";
  }

  // PD-SAAS-FORK: creative prefer-generate_image (flagged). Do NOT map landing/website slug → official_fetch.
  if (shouldRouteCreativeGenerateImage({ goal, slug, env })) {
    return "generate_image";
  }

  if (wantsRemotionOrHtmlVideo(goal)) {
    return "render_html_video";
  }

  return "default";
}
