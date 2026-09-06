// PD-SAAS-FORK VAP T9: vision locates downloadable https image URLs (never description-as-delivery).

export type VisionLocateInput = {
  pageUrl?: string;
  candidateUrls?: string[];
  screenshotRelPath?: string;
  /** Injected for tests — returns model text. */
  askVision?: (prompt: string) => Promise<string>;
};

export type VisionLocateResult = {
  imageUrls: string[];
  visionCalls: number;
  error?: string;
};

export function isVapVisionLocateEnabled(): boolean {
  const raw = (process.env.PILOTDECK_VAP_VISION_LOCATE ?? "off").trim().toLowerCase();
  return raw === "shadow" || raw === "enforce" || raw === "1" || raw === "true";
}

export function isVapVisionLocateEnforce(): boolean {
  return (process.env.PILOTDECK_VAP_VISION_LOCATE ?? "").trim().toLowerCase() === "enforce";
}

const HTTPS_URL_RE = /https:\/\/[^\s"'<>\\]+/giu;

export function parseImageUrlsFromVisionText(text: string): string[] {
  const matches = text.match(HTTPS_URL_RE) ?? [];
  const unique = new Set<string>();
  for (const raw of matches) {
    const url = raw.replace(/[\\),.]+$/u, "");
    if (!/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/iu.test(url) && !/\/image\//iu.test(url)) {
      continue;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") continue;
      if (
        parsed.hostname === "127.0.0.1"
        || parsed.hostname === "localhost"
        || parsed.hostname.endsWith(".local")
      ) {
        continue;
      }
      unique.add(url);
    } catch {
      // skip
    }
  }
  return [...unique].slice(0, 8);
}

/**
 * At most one vision call per turn (caller must enforce). Returns only https image URLs.
 */
export async function locateImageUrlsWithVision(
  input: VisionLocateInput,
): Promise<VisionLocateResult> {
  if (!isVapVisionLocateEnabled()) {
    return { imageUrls: [], visionCalls: 0, error: "vision_locate_off" };
  }
  if (!input.askVision) {
    return { imageUrls: [], visionCalls: 0, error: "vision_provider_unavailable" };
  }
  const prompt = [
    "List downloadable product/official image HTTPS URLs only as JSON:",
    '{"imageUrls":["https://..."]}',
    "No descriptions. No markdown.",
    input.pageUrl ? `Page: ${input.pageUrl}` : "",
    input.candidateUrls?.length
      ? `Candidates:\n${input.candidateUrls.slice(0, 12).join("\n")}`
      : "",
    input.screenshotRelPath ? `Screenshot: ${input.screenshotRelPath}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await input.askVision(prompt);
    const imageUrls = parseImageUrlsFromVisionText(text);
    return { imageUrls, visionCalls: 1 };
  } catch (error) {
    return {
      imageUrls: [],
      visionCalls: 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
