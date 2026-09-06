// PD-SAAS-FORK: HyperFrames engine feature flags (0 | shadow | enforce)

export type HyperframesEngineMode = "off" | "shadow" | "enforce";

export function parseHyperframesEngineMode(
  raw: string | undefined = process.env.PILOTDECK_HYPERFRAMES_ENGINE,
): HyperframesEngineMode {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "enforce" || value === "1" || value === "true" || value === "on") {
    return "enforce";
  }
  if (value === "shadow") {
    return "shadow";
  }
  return "off";
}

export function isHyperframesEngineEnabled(mode: HyperframesEngineMode = parseHyperframesEngineMode()): boolean {
  return mode === "shadow" || mode === "enforce";
}

export function isHyperframesEngineEnforced(mode: HyperframesEngineMode = parseHyperframesEngineMode()): boolean {
  return mode === "enforce";
}

export function hyperframesMaxConcurrent(
  raw: string | undefined = process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT,
): number {
  const n = Number(raw ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function isHyperframesHubV2Enabled(
  raw: string | undefined = process.env.PILOTDECK_HYPERFRAMES_HUB_V2,
): boolean {
  const value = String(raw ?? "1").trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

/** Slugs that route to HyperFrames render pipeline (video output). */
export const HYPERFRAMES_VIDEO_SLUGS = new Set([
  "hf-hyperframes",
  "hf-hyperframes-core",
  "hf-hyperframes-animation",
  "hf-hyperframes-keyframes",
  "hf-hyperframes-creative",
  "hf-hyperframes-cli",
  "hf-hyperframes-registry",
  "hf-media-use",
  "hf-product-launch-video",
  "hf-faceless-explainer",
  "hf-pr-to-video",
  "hf-embedded-captions",
  "hf-talking-head-recut",
  "hf-motion-graphics",
  "hf-music-to-video",
  "hf-general-video",
  "hf-remotion-to-hyperframes",
  "hf-figma",
  "hf-website-to-video",
  "hf-hyperframes-media",
  "hf-gsap",
]);

export const HYPERFRAMES_SLIDESHOW_SLUGS = new Set(["hf-slideshow"]);

export function isHyperframesVideoSlug(slug: string | undefined): boolean {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized.startsWith("hf-")) return false;
  if (HYPERFRAMES_SLIDESHOW_SLUGS.has(normalized)) return false;
  return HYPERFRAMES_VIDEO_SLUGS.has(normalized) || normalized.startsWith("hf-");
}

export function goalExplicitlyWantsHyperframes(goal: string): boolean {
  return /(?:HyperFrames|HTML\s*代码做视频|render_hyperframes|hf-project)/i.test(goal);
}

export { isHfKeyOptionalDegradeEnabled } from "../resilience/stabilityFlags.js";
