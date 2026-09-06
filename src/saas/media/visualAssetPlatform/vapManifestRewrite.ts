// PD-SAAS-FORK VAP P1-A: rewrite deliverable visual refs to manifest paths before write.

import { access } from "node:fs/promises";
import path from "node:path";

import { looksLikeVisualPlaceholder } from "../officialMediaPlaceholder.js";
import {
  extractVisualReferences,
  manifestPathCandidates,
  officialAssetsFromManifest,
  referencesManifestPath,
} from "./deliverableVisualBindingAudit.js";
import { loadVisualAssetManifest } from "./manifestStore.js";
import { isVisualDeliverableWriteTarget } from "./vapBindBeforeWrite.js";
import type { VisualAssetManifest } from "./types.js";

export type VapManifestRewriteResult = {
  content: string;
  rewritten: number;
};

function normalizeRef(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, "/")
    .split("#")[0]!
    .split("?")[0]!
    .toLowerCase();
}

function manifestPathToDeliverableRelative(
  manifestPath: string,
  deliverableFilePath: string,
  workspaceRoot: string,
): string {
  const absAsset = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.join(workspaceRoot, manifestPath.replace(/\//gu, path.sep));
  const deliverableDir = path.dirname(
    path.join(workspaceRoot, deliverableFilePath.replace(/\//gu, path.sep)),
  );
  return path.relative(deliverableDir, absAsset).split(path.sep).join("/");
}

function replaceVisualRef(content: string, oldRef: string, newRef: string): string {
  if (oldRef === newRef) return content;
  const escaped = oldRef.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const patterns = [
    new RegExp(`(\\bsrc\\s*=\\s*["'])${escaped}(["'])`, "giu"),
    new RegExp(`(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`, "giu"),
    new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}(\\))`, "giu"),
  ];
  let out = content;
  for (const pattern of patterns) {
    out = out.replace(pattern, `$1${newRef}$2`);
  }
  return out;
}

function orderedManifestRelativePaths(
  manifest: VisualAssetManifest,
  deliverableFilePath: string,
  workspaceRoot: string,
): string[] {
  return officialAssetsFromManifest(manifest)
    .flatMap(manifestPathCandidates)
    .map((manifestPath) =>
      manifestPathToDeliverableRelative(manifestPath, deliverableFilePath, workspaceRoot),
    )
    .filter(Boolean);
}

function findManifestRelativeForSourceUrl(
  sourceUrl: string,
  manifest: VisualAssetManifest,
  deliverableFilePath: string,
  workspaceRoot: string,
): string | undefined {
  const normalizedSource = normalizeRef(sourceUrl);
  if (!normalizedSource) return undefined;
  for (const asset of officialAssetsFromManifest(manifest)) {
    const candidateUrls = [
      asset.provenance.sourceUrl,
      asset.provenance.sourcePageUrl,
    ].filter(Boolean) as string[];
    for (const candidate of candidateUrls) {
      if (normalizeRef(candidate) === normalizedSource) {
        for (const manifestPath of manifestPathCandidates(asset)) {
          const relative = manifestPathToDeliverableRelative(
            manifestPath,
            deliverableFilePath,
            workspaceRoot,
          );
          if (relative) return relative;
        }
      }
    }
  }
  return undefined;
}

export function rewriteDeliverableVisualRefs(input: {
  content: string;
  filePath: string;
  workspaceRoot: string;
  manifest: VisualAssetManifest;
}): VapManifestRewriteResult {
  const manifestPaths = officialAssetsFromManifest(input.manifest).flatMap(manifestPathCandidates);
  const relativeManifestPaths = orderedManifestRelativePaths(
    input.manifest,
    input.filePath,
    input.workspaceRoot,
  );
  let content = input.content;
  let rewritten = 0;
  let manifestCursor = 0;

  for (const ref of extractVisualReferences(content)) {
    const normalized = normalizeRef(ref);
    if (!normalized || normalized.startsWith("data:")) {
      continue;
    }

    if (/^https?:/iu.test(normalized)) {
      const bySource = findManifestRelativeForSourceUrl(
        ref,
        input.manifest,
        input.filePath,
        input.workspaceRoot,
      );
      const nextManifestRelative = bySource
        ?? relativeManifestPaths[manifestCursor]
        ?? relativeManifestPaths[relativeManifestPaths.length - 1];
      if (!nextManifestRelative) continue;
      content = replaceVisualRef(content, ref, nextManifestRelative);
      rewritten += 1;
      if (!bySource && manifestCursor < relativeManifestPaths.length - 1) {
        manifestCursor += 1;
      }
      continue;
    }

    if (referencesManifestPath(ref, manifestPaths)) {
      continue;
    }

    const placeholderLike = looksLikeVisualPlaceholder({ path: ref, textPreview: ref });
    const nextManifestRelative = relativeManifestPaths[manifestCursor]
      ?? relativeManifestPaths[relativeManifestPaths.length - 1];
    if (!nextManifestRelative) continue;

    const shouldRewrite =
      placeholderLike
      || !referencesManifestPath(ref, manifestPaths);
    if (!shouldRewrite) continue;

    content = replaceVisualRef(content, ref, nextManifestRelative);
    rewritten += 1;
    if (manifestCursor < relativeManifestPaths.length - 1) {
      manifestCursor += 1;
    }
  }

  return { content, rewritten };
}

export async function validateVisualRefsExistOnDisk(input: {
  content: string;
  filePath: string;
  workspaceRoot: string;
}): Promise<{ ok: boolean; missing: string[] }> {
  const deliverableDir = path.dirname(
    path.join(input.workspaceRoot, input.filePath.replace(/\//gu, path.sep)),
  );
  const missing: string[] = [];

  for (const ref of extractVisualReferences(input.content)) {
    const normalized = normalizeRef(ref);
    if (!normalized || /^https?:/iu.test(normalized) || normalized.startsWith("data:")) {
      continue;
    }
    const candidates = [
      path.resolve(deliverableDir, ref.replace(/\//gu, path.sep)),
      path.join(input.workspaceRoot, ref.replace(/\//gu, path.sep)),
    ];
    let exists = false;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        exists = true;
        break;
      } catch {
        // try next candidate
      }
    }
    if (!exists) missing.push(ref);
  }

  return { ok: missing.length === 0, missing };
}

export type VapManifestRewriteBeforeWriteResult = {
  ok: boolean;
  content: string;
  rewritten?: number;
  message?: string;
};

export async function applyVapManifestRewriteBeforeWrite(input: {
  workspaceRoot: string;
  taskArtifactDir?: string;
  sessionId?: string;
  goalVersion?: number;
  filePath: string;
  content: unknown;
  officialMediaRequired?: boolean;
}): Promise<VapManifestRewriteBeforeWriteResult> {
  const content = typeof input.content === "string" ? input.content : "";
  if (
    !input.officialMediaRequired
    || !input.taskArtifactDir
    || !isVisualDeliverableWriteTarget(input.filePath)
    || !content.trim()
  ) {
    return { ok: true, content };
  }

  let manifest: VisualAssetManifest | undefined;
  try {
    manifest = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: input.taskArtifactDir,
      sessionId: input.sessionId ?? "manifest-rewrite",
      goalVersion: input.goalVersion,
    });
  } catch {
    manifest = undefined;
  }

  let rewrittenContent = content;
  let rewritten = 0;
  if (manifest && officialAssetsFromManifest(manifest).length > 0) {
    const rewriteResult = rewriteDeliverableVisualRefs({
      content,
      filePath: input.filePath,
      workspaceRoot: input.workspaceRoot,
      manifest,
    });
    rewrittenContent = rewriteResult.content;
    rewritten = rewriteResult.rewritten;
  }

  const diskCheck = await validateVisualRefsExistOnDisk({
    content: rewrittenContent,
    filePath: input.filePath,
    workspaceRoot: input.workspaceRoot,
  });
  if (!diskCheck.ok) {
    return {
      ok: false,
      content: rewrittenContent,
      rewritten,
      message:
        `Visual deliverable references missing on disk: ${diskCheck.missing.slice(0, 6).join(", ")}`,
    };
  }

  return { ok: true, content: rewrittenContent, rewritten };
}
