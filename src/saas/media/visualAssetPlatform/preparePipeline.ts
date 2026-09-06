// PD-SAAS-FORK VAP: conditional prepare (resize/crop/matting) using sharp.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { runMattingProvider } from "./mattingProviders.js";
import type { VisualAssetEntry, VisualAssetManifest, ProcessingTier } from "./types.js";

type RecipeStep =
  | { op: "resize"; maxLongEdge?: number }
  | { op: "fit"; aspect?: string; mode?: "cover" | "contain"; minShortEdge?: number }
  | { op: "matting"; provider?: string; fallback?: string }
  | { op: "export"; format?: string; quality?: number; suffix?: string };

type Recipe = {
  id: string;
  processingTier: ProcessingTier;
  steps: RecipeStep[];
  requiresSubjectMatch?: string;
};

let cachedRecipes: Recipe[] | null = null;

async function loadRecipes(): Promise<Recipe[]> {
  if (cachedRecipes) return cachedRecipes;
  try {
    const candidate = path.resolve(
      process.cwd(),
      "config/visual-asset-recipes.json",
    );
    const raw = await readFile(candidate, "utf8");
    const parsed = JSON.parse(raw) as { recipes?: Recipe[] };
    cachedRecipes = parsed.recipes ?? [];
    return cachedRecipes;
  } catch {
    cachedRecipes = [];
  }
  return cachedRecipes;
}

function parseAspect(aspect: string | undefined): { w: number; h: number } {
  const match = String(aspect ?? "16:9").match(/(\d+)\s*[:/]\s*(\d+)/u);
  if (!match) return { w: 16, h: 9 };
  return {
    w: Number.parseInt(match[1]!, 10) || 16,
    h: Number.parseInt(match[2]!, 10) || 9,
  };
}

async function applyRecipe(
  buffer: Buffer,
  recipe: Recipe,
): Promise<{ buffer: Buffer; ext: string }> {
  let pipeline = sharp(buffer);
  let format = "png";
  let quality = 90;
  let didMatting = false;

  for (const step of recipe.steps) {
    if (step.op === "matting") {
      const current = await pipeline.png().toBuffer();
      const provider = step.provider === "rembg"
        ? "rembg"
        : step.provider === "cloud_segment"
          ? "cloud_segment"
          : "auto";
      const matted = await runMattingProvider(current, provider);
      pipeline = sharp(matted.buffer).ensureAlpha();
      didMatting = true;
      format = "png";
      continue;
    }
    if (step.op === "resize") {
      const maxLong = step.maxLongEdge ?? 1200;
      pipeline = pipeline.resize({
        width: maxLong,
        height: maxLong,
        fit: "inside",
        withoutEnlargement: true,
      });
      continue;
    }
    if (step.op === "fit") {
      const { w, h } = parseAspect(step.aspect);
      const shortEdge = step.minShortEdge ?? 1080;
      const targetW = w >= h ? Math.round(shortEdge * (w / h)) : shortEdge;
      const targetH = w >= h ? shortEdge : Math.round(shortEdge * (h / w));
      const mode = step.mode === "cover" ? "cover" : "contain";
      if (mode === "contain") {
        pipeline = pipeline.resize({
          width: targetW,
          height: targetH,
          fit: "contain",
          background: didMatting
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : { r: 245, g: 245, b: 247, alpha: 1 },
        });
      } else {
        pipeline = pipeline.resize({
          width: targetW,
          height: targetH,
          fit: "cover",
          position: "centre",
        });
      }
      continue;
    }
    if (step.op === "export") {
      format = (step.format ?? "png").toLowerCase();
      quality = step.quality ?? 90;
    }
  }

  if (format === "jpg" || format === "jpeg") {
    return {
      buffer: await pipeline.jpeg({ quality }).toBuffer(),
      ext: ".jpg",
    };
  }
  if (format === "webp") {
    return {
      buffer: await pipeline.webp({ quality }).toBuffer(),
      ext: ".webp",
    };
  }
  return {
    buffer: await pipeline.png().toBuffer(),
    ext: ".png",
  };
}

export async function prepareVisualAssetEntry(input: {
  workspaceRoot: string;
  taskArtifactDir: string;
  entry: VisualAssetEntry;
  recipeId?: string;
  force?: boolean;
}): Promise<VisualAssetEntry> {
  const entry = input.entry;
  if (
    !input.force
    && entry.recommendedTier === "none"
  ) {
    return {
      ...entry,
      preparedPath: entry.rawPath,
      processingStatus: "skipped",
    };
  }
  if (
    !input.force
    && entry.preparedPath
    && entry.processingStatus === "ok"
  ) {
    return entry;
  }

  const recipes = await loadRecipes();
  const recipeId = input.recipeId
    ?? entry.suggestedRecipes?.[0]
    ?? (entry.recommendedTier === "resize_only"
      ? "report_inline"
      : entry.recommendedTier === "crop_fit"
        ? "landing_hero_wide"
        : entry.recommendedTier === "matting_compose"
          ? "slide_hero_16x9"
          : "passthrough");
  const recipe = recipes.find((item) => item.id === recipeId)
    ?? {
      id: "passthrough",
      processingTier: "none" as const,
      steps: [],
    };

  if (recipe.processingTier === "none" || recipe.steps.length === 0) {
    return {
      ...entry,
      preparedPath: entry.rawPath,
      processingStatus: "skipped",
      provenance: {
        ...entry.provenance,
        recipeId: recipe.id,
      },
    };
  }

  try {
    const absRaw = path.join(input.workspaceRoot, entry.rawPath);
    const buffer = await readFile(absRaw);
    const prepared = await applyRecipe(buffer, recipe);
    const baseName = path.basename(entry.rawPath, path.extname(entry.rawPath));
    const relDir = path
      .join(input.taskArtifactDir, "assets", "prepared")
      .replace(/\\/gu, "/");
    const absDir = path.join(input.workspaceRoot, relDir);
    await mkdir(absDir, { recursive: true });
    const outName = `${baseName}-${recipe.id}${prepared.ext}`;
    const relPath = `${relDir}/${outName}`.replace(/\\/gu, "/");
    await writeFile(path.join(absDir, outName), prepared.buffer);
    return {
      ...entry,
      preparedPath: relPath,
      processingStatus: "ok",
      provenance: {
        ...entry.provenance,
        recipeId: recipe.id,
      },
    };
  } catch (error) {
    return {
      ...entry,
      processingStatus: "failed",
      provenance: {
        ...entry.provenance,
        recipeId,
        notes: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function preparePendingAssets(input: {
  workspaceRoot: string;
  manifest: VisualAssetManifest;
}): Promise<VisualAssetManifest> {
  const assets = [];
  for (const entry of input.manifest.assets) {
    if (
      entry.recommendedTier === "none"
      || entry.processingStatus === "ok"
      || entry.processingStatus === "skipped"
    ) {
      assets.push(
        entry.recommendedTier === "none"
          ? {
              ...entry,
              preparedPath: entry.rawPath,
              processingStatus: "skipped" as const,
            }
          : entry,
      );
      continue;
    }
    assets.push(
      await prepareVisualAssetEntry({
        workspaceRoot: input.workspaceRoot,
        taskArtifactDir: input.manifest.taskArtifactDir,
        entry,
      }),
    );
  }
  return { ...input.manifest, assets };
}
