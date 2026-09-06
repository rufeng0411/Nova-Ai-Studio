// PD-SAAS-FORK VAP: task-local visual-asset-manifest.json store.

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  VISUAL_ASSET_MANIFEST_FILENAME,
  type VisualAssetEntry,
  type VisualAssetManifest,
  type VisualAssetSource,
  type ProcessingTier,
  type AssetRole,
  type ProcessingStatus,
} from "./types.js";
import {
  buildAcquisitionFailureMessage,
  buildAcquisitionStrategyBlock,
  isAcquisitionLadderExhausted,
} from "./visualAcquisitionLadder.js";

function emptyManifest(input: {
  sessionId: string;
  taskArtifactDir: string;
  goalVersion?: number;
  subject?: string;
  sourceUrls?: string[];
}): VisualAssetManifest {
  return {
    version: 1,
    sessionId: input.sessionId,
    taskArtifactDir: input.taskArtifactDir.replace(/\\/gu, "/"),
    goalVersion: input.goalVersion && input.goalVersion > 0
      ? input.goalVersion
      : 1,
    ...(input.subject ? { subject: input.subject } : {}),
    sourceUrls: input.sourceUrls ?? [],
    updatedAt: new Date().toISOString(),
    assets: [],
    slotBindings: {},
    phase: "idle",
    autoDiscoverTriggered: false,
    errors: [],
  };
}

export function resolveManifestAbsPath(
  workspaceRoot: string,
  taskArtifactDir: string,
): string {
  const rel = taskArtifactDir.replace(/\\/gu, "/").replace(/^\/+/u, "");
  return path.join(workspaceRoot, rel, "assets", VISUAL_ASSET_MANIFEST_FILENAME);
}

export async function loadVisualAssetManifest(input: {
  workspaceRoot: string;
  taskArtifactDir: string;
  sessionId: string;
  goalVersion?: number;
  subject?: string;
  sourceUrls?: string[];
}): Promise<VisualAssetManifest> {
  const abs = resolveManifestAbsPath(input.workspaceRoot, input.taskArtifactDir);
  try {
    const raw = await readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as VisualAssetManifest;
    if (parsed?.version === 1 && Array.isArray(parsed.assets)) {
      return parsed;
    }
  } catch {
    // create new
  }
  return emptyManifest(input);
}

export async function saveVisualAssetManifest(input: {
  workspaceRoot: string;
  manifest: VisualAssetManifest;
}): Promise<string> {
  const abs = resolveManifestAbsPath(
    input.workspaceRoot,
    input.manifest.taskArtifactDir,
  );
  await mkdir(path.dirname(abs), { recursive: true });
  const next: VisualAssetManifest = {
    ...input.manifest,
    updatedAt: new Date().toISOString(),
  };
  const tmp = `${abs}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tmp, abs);
  return abs.replace(/\\/gu, "/");
}

export function ingestVisualAssetEntry(
  manifest: VisualAssetManifest,
  entry: Omit<VisualAssetEntry, "assetId"> & { assetId?: string },
): VisualAssetManifest {
  const assetId = entry.assetId ?? `va_${randomUUID().slice(0, 12)}`;
  const nextEntry: VisualAssetEntry = {
    ...entry,
    assetId,
    preparedPath: entry.preparedPath
      ?? (entry.recommendedTier === "none" ? entry.rawPath : undefined),
  };
  const existingIdx = manifest.assets.findIndex(
    (asset) =>
      asset.assetId === assetId
      || (asset.rawPath && asset.rawPath === nextEntry.rawPath),
  );
  const assets = [...manifest.assets];
  if (existingIdx >= 0) {
    assets[existingIdx] = {
      ...assets[existingIdx]!,
      ...nextEntry,
      assetId: assets[existingIdx]!.assetId,
    };
  } else {
    assets.push(nextEntry);
  }
  return { ...manifest, assets };
}

export function createIngestedEntry(input: {
  source: VisualAssetSource;
  rawPath: string;
  recommendedTier?: ProcessingTier;
  role?: AssetRole;
  processingStatus?: ProcessingStatus;
  provenance?: VisualAssetEntry["provenance"];
  width?: number;
  height?: number;
}): Omit<VisualAssetEntry, "assetId"> {
  const tier = input.recommendedTier ?? "none";
  return {
    source: input.source,
    rawPath: input.rawPath.replace(/\\/gu, "/"),
    recommendedTier: tier,
    role: input.role ?? "unknown",
    needsMatting: tier === "matting_compose",
    provenance: input.provenance ?? {},
    processingStatus: input.processingStatus
      ?? (tier === "none" ? "skipped" : "pending"),
    ...(tier === "none" ? { preparedPath: input.rawPath.replace(/\\/gu, "/") } : {}),
    ...(input.width ? { width: input.width } : {}),
    ...(input.height ? { height: input.height } : {}),
  };
}

export function buildManifestHintForModel(
  manifest: VisualAssetManifest,
  language: "zh-CN" | "en" = "zh-CN",
): string {
  const attempts = manifest.acquisitionAttempts ?? [];
  const localizedCount = manifest.assets.length;

  if (localizedCount === 0) {
    const ladderExhausted = isAcquisitionLadderExhausted(
      attempts,
      localizedCount,
      1,
    );
    if (ladderExhausted) {
      return buildAcquisitionFailureMessage(attempts, language);
    }
    if (language === "zh-CN") {
      return [
        buildAcquisitionStrategyBlock("zh-CN"),
        "配图清单仍为空：请调用 resolve_session_visual_assets（phase_a），系统将自动按阶梯尝试官网→根域→权威站→门户→HTML 提取→视口截图；禁止首轮失败就用 generate_image/SVG 冒充官图。",
      ].join("\n");
    }
    return [
      buildAcquisitionStrategyBlock("en"),
      "Visual asset manifest is empty. Call resolve_session_visual_assets (phase_a) to run the full acquisition ladder before generate_image or placeholders.",
    ].join("\n");
  }
  const lines = manifest.assets.slice(0, 12).map((asset) => {
    const pathForUse = asset.preparedPath ?? asset.rawPath;
    const slots = asset.slotIds?.length
      ? ` slots=[${asset.slotIds.join(",")}]`
      : "";
    return `- ${asset.assetId}: ${pathForUse} (${asset.source}/${asset.role}/${asset.recommendedTier}${slots})`;
  });
  if (language === "zh-CN") {
    return [
      "配图已就绪（visual-asset-manifest）。下载图位于 artifacts/sessions/{sessionId}/downloads/；请直接引用 manifest 路径写交付物，禁止重复 fetch_page_images/web_search/generate_image 搜官方产品图：",
      ...lines,
      manifest.errors.length > 0
        ? `注意：${manifest.errors.slice(0, 3).join("；")}`
        : "",
    ].filter(Boolean).join("\n");
  }
  return [
    "Visual assets ready. Use these paths; do not re-fetch or generate official product images:",
    ...lines,
  ].join("\n");
}
