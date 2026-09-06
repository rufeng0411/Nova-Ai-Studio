// PD-SAAS-FORK: filter verified paths before contract binding (UDC R11 PR-2)
import { normalizeSdmPath, sdmBasename } from "./sdmSlotMatching.js";

const NON_USER_BASENAME_PATTERNS = [
  /^readme\.md$/i,
  /^deliverables-index/i,
  /^final-summary\.md$/i,
  /-final-deliverables\.md$/i,
  /^acceptance\.json$/i,
  /^visual-asset-manifest\.json$/i,
  /^index-preview\.png$/i,
  /-report_inline\.png$/i,
];

const NON_USER_PATH_SEGMENTS = [
  /\/assets\/(?:prepared|_capture|raw)\//i,
];

export function isNonUserVerifiedDeliverableBasename(basename: string): boolean {
  return NON_USER_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
}

export function filterVerifiedForContractBinding(
  verifiedPaths: string[],
  options?: { scopeDir?: string | null },
): string[] {
  const scopeNorm = options?.scopeDir
    ? normalizeSdmPath(options.scopeDir).replace(/\/+$/, "").toLowerCase()
    : null;

  const seenBasenames = new Map<string, string>();
  const out: string[] = [];

  for (const raw of verifiedPaths) {
    const path = normalizeSdmPath(raw);
    if (!path) continue;
    const base = sdmBasename(path);
    if (isNonUserVerifiedDeliverableBasename(base)) continue;
    if (NON_USER_PATH_SEGMENTS.some((pattern) => pattern.test(path))) continue;

    if (scopeNorm) {
      const dir = path.replace(/\/[^/]+$/, "").toLowerCase();
      if (dir !== scopeNorm && !dir.startsWith(`${scopeNorm}/`)) continue;
    }

    const baseKey = base.toLowerCase();
    const prev = seenBasenames.get(baseKey);
    if (prev) {
      const prevDepth = prev.split("/").length;
      const nextDepth = path.split("/").length;
      if (nextDepth > prevDepth) continue;
      if (nextDepth < prevDepth) {
        seenBasenames.set(baseKey, path);
        continue;
      }
      if (scopeNorm) {
        const prevDir = prev.replace(/\/[^/]+$/, "").toLowerCase();
        const dir = path.replace(/\/[^/]+$/, "").toLowerCase();
        const nextInScope = dir === scopeNorm || dir.startsWith(`${scopeNorm}/`);
        const prevInScope = prevDir === scopeNorm || prevDir.startsWith(`${scopeNorm}/`);
        if (nextInScope && !prevInScope) {
          seenBasenames.set(baseKey, path);
        }
        continue;
      }
      continue;
    }
    seenBasenames.set(baseKey, path);
  }

  for (const path of seenBasenames.values()) {
    out.push(path);
  }
  return out;
}
