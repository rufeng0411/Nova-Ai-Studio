// PD-SAAS-FORK VAP: auto-ingest successful generate_image outputs into VAP manifest.

import {
  applyAnalysisToEntry,
  analyzeVisualAsset,
} from "./analyzer.js";
import {
  createIngestedEntry,
  ingestVisualAssetEntry,
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "./manifestStore.js";
import { prepareVisualAssetEntry } from "./preparePipeline.js";
import {
  isVisualAssetPrepEnabled,
  visualAssetPlatformMode,
} from "../../resilience/stabilityFlags.js";

export async function ingestGeneratedImageIntoManifest(input: {
  workspaceRoot: string;
  sessionId: string;
  taskArtifactDir?: string;
  relativePath: string;
  subjectAnchor?: string;
  goalVersion?: number;
  officialMediaPolicy?: "none" | "official_preferred" | "official_only";
}): Promise<void> {
  if (visualAssetPlatformMode() === "off") return;
  if (input.officialMediaPolicy === "official_only") return;
  const taskDir = String(input.taskArtifactDir ?? "").trim();
  if (!taskDir) return;
  try {
    const analysis = analyzeVisualAsset({
      rawPath: input.relativePath,
      source: "generate_image",
      subject: input.subjectAnchor,
    });
    const base = createIngestedEntry({
      source: "generate_image",
      rawPath: input.relativePath,
      recommendedTier: analysis.recommendedTier,
      role: analysis.role,
      provenance: {
        notes: "auto-ingest from generate_image",
        fetchedAt: new Date().toISOString(),
      },
    });
    let entry = applyAnalysisToEntry(
      { ...base, assetId: `va_gen_${Date.now().toString(36)}` },
      analysis,
    );
    if (isVisualAssetPrepEnabled() && entry.recommendedTier !== "none") {
      entry = await prepareVisualAssetEntry({
        workspaceRoot: input.workspaceRoot,
        taskArtifactDir: taskDir,
        entry,
      });
    }
    let manifest = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: taskDir,
      sessionId: input.sessionId,
      goalVersion: input.goalVersion,
      subject: input.subjectAnchor,
    });
    manifest = ingestVisualAssetEntry(manifest, entry);
    await saveVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      manifest,
    });
  } catch {
    // Never fail generate_image because of VAP bookkeeping.
  }
}
