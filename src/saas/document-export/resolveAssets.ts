// PD-SAAS-FORK: resolve image/media paths inside workspace for export
import { access } from "node:fs/promises";
import path from "node:path";
import type { DocumentIr } from "./types.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveIrAssetPaths(ir: DocumentIr, workspaceRoot: string): Promise<DocumentIr> {
  const blocks = await Promise.all(
    ir.blocks.map(async (block) => {
      if (block.type === "image") {
        const resolved = await resolveWorkspaceAsset(block.src, workspaceRoot);
        return { ...block, resolvedPath: resolved ?? block.src };
      }
      if (block.type === "videoLink" && block.posterPath) {
        const resolved = await resolveWorkspaceAsset(block.posterPath, workspaceRoot);
        return { ...block, posterPath: resolved ?? block.posterPath };
      }
      return block;
    }),
  );
  return { ...ir, blocks };
}

export async function resolveWorkspaceAsset(
  src: string,
  workspaceRoot: string,
): Promise<string | null> {
  const trimmed = src.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed.startsWith("http") || trimmed.startsWith("data:") ? trimmed : null;
  }
  const candidates = [
    path.resolve(workspaceRoot, trimmed),
    path.resolve(workspaceRoot, trimmed.replace(/^\//, "")),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}
