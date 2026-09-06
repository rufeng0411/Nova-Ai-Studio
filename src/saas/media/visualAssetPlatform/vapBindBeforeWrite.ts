// PD-SAAS-FORK VAP P0-C: gate premature visual deliverable writes until manifest ready.

import path from "node:path";

import { loadVisualAssetManifest } from "./manifestStore.js";
import { officialAssetsFromManifest } from "./deliverableVisualBindingAudit.js";
import { isAcquisitionLadderExhausted } from "./visualAcquisitionLadder.js";
import { looksLikeVisualPlaceholder } from "../officialMediaPlaceholder.js";
import { isVapBindBeforeWriteEnabled } from "../../resilience/stabilityFlags.js";

const VISUAL_DELIVERABLE_PATTERN =
  /(?:^|\/)(?:index\.html?|slide-\d+\.png|key-visual[^/]*\.(?:png|html?)|social-[^/]+\.(?:png|html?)|platform-[^/]+\.(?:png|svg))$/iu;

export type VapBindBeforeWriteDecision = {
  blocked: boolean;
  reason?: string;
  manifestPaths?: string[];
};

const PLACEHOLDER_PATH =
  /(?:^|\/)placeholder[^/]*\.(?:svg|png|jpg|jpeg)$/iu;

/** F03: block new placeholder writes when manifest already has assets. */
export function shouldBlockPlaceholderWhenAssetsExist(input: {
  filePath: string;
  content?: unknown;
  assetCount: number;
}): boolean {
  if (input.assetCount <= 0) return false;
  const normalized = String(input.filePath ?? "").replace(/\\/gu, "/");
  if (PLACEHOLDER_PATH.test(normalized)) return true;
  const content = typeof input.content === "string" ? input.content : "";
  if (
    content.length > 0
    && looksLikeVisualPlaceholder({ path: normalized, textPreview: content })
    && /img-placeholder|placeholder-/iu.test(content)
  ) {
    return true;
  }
  return false;
}

export function isVisualDeliverableWriteTarget(filePath: string): boolean {
  const normalized = String(filePath ?? "").replace(/\\/gu, "/");
  return VISUAL_DELIVERABLE_PATTERN.test(normalized);
}

export async function evaluateVapBindBeforeWrite(input: {
  workspaceRoot: string;
  taskArtifactDir?: string;
  sessionId?: string;
  goalVersion?: number;
  filePath: string;
  content?: unknown;
  officialMediaRequired?: boolean;
}): Promise<VapBindBeforeWriteDecision> {
  if (!input.taskArtifactDir) {
    return { blocked: false };
  }

  let manifest;
  try {
    manifest = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: input.taskArtifactDir,
      sessionId: input.sessionId ?? "bind-gate",
      goalVersion: input.goalVersion,
    });
  } catch {
    manifest = undefined;
  }

  const officialAssets = manifest ? officialAssetsFromManifest(manifest) : [];
  const allAssets = manifest?.assets ?? [];
  const ladderExhausted = manifest
    ? isAcquisitionLadderExhausted(
        manifest.acquisitionAttempts ?? [],
        manifest.assets.length,
        1,
      )
    : false;
  const manifestPaths = (officialAssets.length > 0 ? officialAssets : allAssets)
    .map((asset) => asset.preparedPath ?? asset.rawPath)
    .filter(Boolean);

  if (
    shouldBlockPlaceholderWhenAssetsExist({
      filePath: input.filePath,
      content: input.content,
      assetCount: allAssets.length,
    })
  ) {
    return {
      blocked: true,
      reason:
        "Manifest already has localized visual assets — do not write placeholder SVG; bind downloads/prepared paths instead.",
      manifestPaths,
    };
  }

  if (
    !isVapBindBeforeWriteEnabled()
    || !input.officialMediaRequired
    || !isVisualDeliverableWriteTarget(input.filePath)
  ) {
    return { blocked: false, manifestPaths };
  }

  if (officialAssets.length > 0 || allAssets.length > 0) {
    return { blocked: false, manifestPaths };
  }

  const content = typeof input.content === "string" ? input.content : "";
  const placeholderWrite = looksLikeVisualPlaceholder({
    path: input.filePath,
    textPreview: content,
  });

  if (ladderExhausted && !placeholderWrite) {
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: ladderExhausted
      ? "Official visual deliverable writes must disclose acquisition gaps instead of silent placeholders."
      : "Wait for resolve_session_visual_assets to populate the visual-asset-manifest before writing index.html/slide PNG/key-visual files.",
    manifestPaths,
  };
}

export function formatBindBeforeWriteBlockedMessage(
  decision: VapBindBeforeWriteDecision,
): string {
  const lines = [
    decision.reason
      ?? "Visual deliverable write blocked until official assets are bound in the manifest.",
  ];
  if (decision.manifestPaths?.length) {
    lines.push("Available manifest paths:");
    for (const manifestPath of decision.manifestPaths.slice(0, 8)) {
      lines.push(`- ${manifestPath}`);
    }
  } else {
    lines.push("Next: resolve_session_visual_assets (phase_a).");
  }
  return lines.join("\n");
}
