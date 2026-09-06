// PD-SAAS-FORK VAP P1-C: inject manifest official images into Document IR exports.

import type { DocumentIr } from "./types.js";
import { loadVisualAssetManifest } from "../media/visualAssetPlatform/manifestStore.js";
import { officialAssetsFromManifest } from "../media/visualAssetPlatform/deliverableVisualBindingAudit.js";

export async function enrichDocumentIrFromVisualManifest(input: {
  ir: DocumentIr;
  workspaceRoot: string;
  taskArtifactDir?: string;
  sessionId?: string;
  goalVersion?: number;
}): Promise<DocumentIr> {
  const taskDir = String(input.taskArtifactDir ?? "").trim();
  if (
    !taskDir
    || !/^(?:artifacts\/[^/]+|tests\/fixtures\/visual-deliverable-core\/[^/]+)/iu.test(taskDir)
  ) {
    return input.ir;
  }
  let manifest;
  try {
    manifest = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: taskDir,
      sessionId: input.sessionId ?? "export",
      goalVersion: input.goalVersion,
    });
  } catch {
    return input.ir;
  }
  const official = officialAssetsFromManifest(manifest);
  if (official.length === 0) return input.ir;

  const imageBlocks = official.slice(0, 12).map((asset) => {
    const rel = (asset.preparedPath ?? asset.rawPath).replace(/\\/gu, "/");
    return {
      type: "image" as const,
      src: rel,
      alt: asset.role ?? "official",
    };
  });

  return {
    ...input.ir,
    blocks: [...input.ir.blocks, ...imageBlocks],
  };
}

export function inferTaskArtifactDirFromSourcePath(sourcePath: string): string | undefined {
  const normalized = String(sourcePath ?? "").replace(/\\/gu, "/");
  const match = normalized.match(/^(artifacts\/task-[^/]+)/iu);
  if (match?.[1]) return match[1];
  const slugMatch = normalized.match(/^(artifacts\/[^/]+)/iu);
  if (slugMatch?.[1] && !/^artifacts\/sessions$/iu.test(slugMatch[1])) {
    return slugMatch[1];
  }
  const fixtureMatch = normalized.match(/^(tests\/fixtures\/visual-deliverable-core\/[^/]+)/iu);
  return fixtureMatch?.[1];
}

export function countDocumentIrImageBlocks(ir: DocumentIr): number {
  return ir.blocks.filter((block) => block.type === "image" || block.type === "chartImage").length;
}

export async function enrichComposeImagePathsFromManifest(input: {
  workspaceRoot: string;
  taskArtifactDir?: string;
  sessionId?: string;
  goalVersion?: number;
  imagePaths: string[];
}): Promise<string[]> {
  const taskDir = String(input.taskArtifactDir ?? "").trim();
  if (!taskDir) return input.imagePaths;

  let manifest;
  try {
    manifest = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: taskDir,
      sessionId: input.sessionId ?? "compose",
      goalVersion: input.goalVersion,
    });
  } catch {
    return input.imagePaths;
  }

  const official = officialAssetsFromManifest(manifest);
  if (official.length === 0) return input.imagePaths;

  const manifestPaths = official.flatMap((asset) =>
    [asset.preparedPath, asset.rawPath].filter(Boolean) as string[],
  );
  const alreadyBound = input.imagePaths.some((imagePath) =>
    manifestPaths.some((manifestPath) =>
      imagePath.replace(/\\/gu, "/").endsWith(manifestPath.replace(/\\/gu, "/")),
    ),
  );
  if (alreadyBound) return input.imagePaths;

  const merged = [...input.imagePaths];
  for (const manifestPath of manifestPaths) {
    if (!merged.includes(manifestPath)) merged.push(manifestPath);
  }
  return merged;
}
