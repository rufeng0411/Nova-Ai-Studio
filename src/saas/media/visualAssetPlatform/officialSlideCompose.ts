// PD-SAAS-FORK VAP P1-C: compose Nova official slides from manifest slot bindings.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { bindAssetsToSlots, type ImageSlotHint } from "./slotBinder.js";
import {
  ingestVisualAssetEntry,
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "./manifestStore.js";
import { isOfficialGradeVisualSource } from "./deliverableVisualBindingAudit.js";
import type { VisualAssetManifest } from "./types.js";

export type ComposeOfficialSlidesInput = {
  workspaceRoot: string;
  taskArtifactDir: string;
  sessionId: string;
  goalVersion?: number;
  slideDeckDir: string;
  imageSlots: ImageSlotHint[];
  aspectRatio?: string;
};

export type ComposeOfficialSlidesResult = {
  manifest: VisualAssetManifest;
  slidePaths: string[];
};

function parseAspect(aspect: string | undefined): { w: number; h: number } {
  const match = String(aspect ?? "16:9").match(/(\d+)\s*[:/]\s*(\d+)/u);
  if (!match) return { w: 16, h: 9 };
  return {
    w: Number.parseInt(match[1]!, 10) || 16,
    h: Number.parseInt(match[2]!, 10) || 9,
  };
}

async function composeSlideFromAsset(input: {
  workspaceRoot: string;
  sourceRelativePath: string;
  outputAbsPath: string;
  aspectRatio?: string;
}): Promise<void> {
  const sourceAbs = path.resolve(input.workspaceRoot, input.sourceRelativePath);
  const sourceBuffer = await readFile(sourceAbs);
  const { w, h } = parseAspect(input.aspectRatio);
  const shortEdge = 1080;
  const targetW = w >= h ? Math.round(shortEdge * (w / h)) : shortEdge;
  const targetH = w >= h ? shortEdge : Math.round(shortEdge * (h / w));
  const buffer = await sharp(sourceBuffer)
    .resize({
      width: targetW,
      height: targetH,
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  await mkdir(path.dirname(input.outputAbsPath), { recursive: true });
  await sharp(buffer).png().toFile(input.outputAbsPath);
}

export async function composeOfficialSlidesFromManifest(
  input: ComposeOfficialSlidesInput,
): Promise<ComposeOfficialSlidesResult> {
  let manifest = await loadVisualAssetManifest({
    workspaceRoot: input.workspaceRoot,
    taskArtifactDir: input.taskArtifactDir,
    sessionId: input.sessionId,
    goalVersion: input.goalVersion,
  });
  const bound = bindAssetsToSlots(manifest, input.imageSlots);
  manifest = bound.manifest;

  const deckRel = input.slideDeckDir.replace(/\\/gu, "/").replace(/^\/+/u, "");
  const slidePaths: string[] = [];
  const slideSlots = input.imageSlots.filter((slot) =>
    /slide|幻灯|配图/iu.test(`${slot.slotId} ${slot.label ?? ""} ${slot.pathHint ?? ""}`),
  );

  for (let index = 0; index < slideSlots.length; index += 1) {
    const slot = slideSlots[index]!;
    const assetId = bound.slotBindings[slot.slotId];
    const asset = manifest.assets.find((item) => item.assetId === assetId);
    if (!asset || !isOfficialGradeVisualSource(asset.source)) continue;
    const sourcePath = asset.preparedPath ?? asset.rawPath;
    if (!sourcePath) continue;
    const slideName = slot.pathHint?.match(/slide-\d+\.png/iu)?.[0]
      ?? `slide-${String(index + 1).padStart(2, "0")}.png`;
    const outputRel = path.posix.join(deckRel, slideName);
    const outputAbs = path.resolve(input.workspaceRoot, outputRel);
    await composeSlideFromAsset({
      workspaceRoot: input.workspaceRoot,
      sourceRelativePath: sourcePath,
      outputAbsPath: outputAbs,
      aspectRatio: input.aspectRatio,
    });
    slidePaths.push(outputRel);
    manifest = ingestVisualAssetEntry(manifest, {
      ...asset,
      rawPath: outputRel,
      preparedPath: outputRel,
      slotIds: [...new Set([...(asset.slotIds ?? []), slot.slotId])],
      provenance: {
        ...asset.provenance,
        notes: "official slide compose",
      },
      processingStatus: "ok",
    });
  }

  await saveVisualAssetManifest({
    workspaceRoot: input.workspaceRoot,
    manifest,
  });

  return { manifest, slidePaths };
}
