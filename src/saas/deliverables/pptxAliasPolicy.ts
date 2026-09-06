// PD-SAAS-FORK (ROG Phase 7 G1): engine-side pptx alias / stub detection (mirrors UI policy).
import path from "node:path";

function basenameLower(p: string): string {
  return path.basename(String(p ?? "").replace(/\\/g, "/")).toLowerCase();
}

function dirnameNorm(p: string): string {
  return path.dirname(String(p ?? "").replace(/\\/g, "/")).replace(/\\/g, "/");
}

/** Generic presentation.pptx is a stub when a sibling .pptx exists in the same directory. */
export function isStubPresentationPptx(filePath: string, allPptxPaths: string[]): boolean {
  const base = basenameLower(filePath);
  if (base !== "presentation.pptx") return false;
  const dir = dirnameNorm(filePath);
  return allPptxPaths.some(
    (candidate) =>
      candidate !== filePath
      && basenameLower(candidate).endsWith(".pptx")
      && dirnameNorm(candidate) === dir,
  );
}

export function isRealPptxPath(filePath: string, allPptxPaths: string[]): boolean {
  if (!/\.pptx$/i.test(filePath)) return false;
  return !isStubPresentationPptx(filePath, allPptxPaths);
}
