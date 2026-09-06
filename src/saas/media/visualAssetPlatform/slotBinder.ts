// PD-SAAS-FORK VAP: bind manifest assets to SDM image slots; emit verified paths.

import type { VisualAssetEntry, VisualAssetManifest } from "./types.js";

export type ImageSlotHint = {
  slotId: string;
  label?: string;
  pathHint?: string;
  kind?: string;
};

function slotPrefersMatting(slot: ImageSlotHint): boolean {
  const blob = `${slot.slotId} ${slot.label ?? ""} ${slot.pathHint ?? ""}`.toLowerCase();
  return /poster|key-visual|kv|social|slide|hero|parallax|product|主视觉|海报|配图/u
    .test(blob);
}

function scoreAssetForSlot(
  asset: VisualAssetEntry,
  slot: ImageSlotHint,
): number {
  let score = 0;
  const blob = `${slot.slotId} ${slot.label ?? ""} ${slot.pathHint ?? ""}`.toLowerCase();
  if (asset.source === "official_fetch") score += 40;
  if (asset.source === "authority_site") score += 25;
  if (asset.source === "generate_image") score -= 30;
  if (asset.source === "placeholder") score -= 100;
  if (asset.subjectMatch === "high") score += 20;
  if (asset.subjectMatch === "medium") score += 10;
  if (asset.subjectMatch === "low") score -= 10;
  if (slotPrefersMatting(slot) && asset.role === "product_hero") score += 25;
  if (/logo/u.test(blob) && asset.role === "logo") score += 40;
  if (/scene|lifestyle|banner/u.test(blob) && asset.role === "lifestyle_scene") {
    score += 20;
  }
  if (asset.processingStatus === "failed") score -= 15;
  if (asset.slotIds?.includes(slot.slotId)) score += 50;
  return score;
}

/**
 * Phase-B: assign unused assets to image slots and update slotBindings.
 * Returns verified-style relative paths for deliverable reconcile.
 */
export function bindAssetsToSlots(
  manifest: VisualAssetManifest,
  slots: ImageSlotHint[],
): {
  manifest: VisualAssetManifest;
  verifiedPaths: string[];
  slotBindings: Record<string, string>;
} {
  const imageSlots = slots.filter((slot) => {
    const kind = String(slot.kind ?? "").toLowerCase();
    const blob = `${slot.slotId} ${slot.label ?? ""} ${slot.pathHint ?? ""}`;
    return (
      kind === "image"
      || kind === "png"
      || /\.(?:png|jpe?g|webp|svg)$/iu.test(slot.pathHint ?? "")
      || /配图|海报|主视觉|slide|poster|visual|hero|social/iu.test(blob)
    );
  });

  const usedAssetIds = new Set<string>();
  const slotBindings: Record<string, string> = { ...manifest.slotBindings };
  const assets = manifest.assets.map((asset) => ({ ...asset }));

  for (const slot of imageSlots) {
    if (slotBindings[slot.slotId]) {
      const existing = assets.find(
        (asset) => asset.assetId === slotBindings[slot.slotId],
      );
      if (existing) usedAssetIds.add(existing.assetId);
      continue;
    }
    let bestIdx = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < assets.length; i += 1) {
      const asset = assets[i]!;
      if (usedAssetIds.has(asset.assetId)) continue;
      if (asset.source === "generate_image" && slotPrefersMatting(slot)) {
        // Prefer real product photos for product/poster slots.
        continue;
      }
      const score = scoreAssetForSlot(asset, slot);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) continue;
    const chosen = assets[bestIdx]!;
    usedAssetIds.add(chosen.assetId);
    const pathForUse = chosen.preparedPath ?? chosen.rawPath;
    slotBindings[slot.slotId] = chosen.assetId;
    assets[bestIdx] = {
      ...chosen,
      slotIds: [...new Set([...(chosen.slotIds ?? []), slot.slotId])],
    };
    // Keep pathHint-friendly basename mapping via slotBindings asset id;
    // verified paths use prepared/raw path.
    void pathForUse;
  }

  const verifiedPaths = Object.entries(slotBindings)
    .map(([, assetId]) => {
      const asset = assets.find((item) => item.assetId === assetId);
      return asset?.preparedPath ?? asset?.rawPath;
    })
    .filter((value): value is string => Boolean(value));

  // Also include unbound official assets so validate can see them.
  for (const asset of assets) {
    const pathForUse = asset.preparedPath ?? asset.rawPath;
    if (pathForUse && !verifiedPaths.includes(pathForUse)) {
      if (
        asset.source === "official_fetch"
        || asset.source === "authority_site"
      ) {
        verifiedPaths.push(pathForUse);
      }
    }
  }

  return {
    manifest: {
      ...manifest,
      assets,
      slotBindings,
      phase: "phase_b",
    },
    verifiedPaths,
    slotBindings,
  };
}

export function collectPlaceholderPaths(
  manifest: VisualAssetManifest,
): string[] {
  return manifest.assets
    .filter((asset) => asset.source === "placeholder")
    .map((asset) => asset.preparedPath ?? asset.rawPath)
    .filter(Boolean);
}
