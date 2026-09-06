// PD-SAAS-FORK (ROG Phase 6 F2): drop missing paths already satisfied by verified disk facts.
import { basenameLower, normalizeRepairPath } from "../../../ui/shared/repairEligiblePath.mjs";
import { deliverableBasenamesMatch } from "./normalizeDeliverableBasename.js";

export type ReconcileMissingPathsInput = {
  missing: string[];
  verified: string[];
  turnArtifactDir?: string;
  pathHints?: string[];
};

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

export function isMissingReanchorEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_MISSING_REANCHOR", true);
}

function verifiedBasenames(verified: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of verified) {
    const base = basenameLower(p);
    if (base) out.add(base);
    const normalized = normalizeRepairPath(p).toLowerCase();
    if (normalized) out.add(normalized);
  }
  return out;
}

function missingSatisfiedByVerified(missing: string, verified: string[]): boolean {
  const normalizedMissing = normalizeRepairPath(missing).toLowerCase();
  if (!normalizedMissing) return true;

  const missingBase = basenameLower(missing);
  for (const v of verified) {
    const normalizedVerified = normalizeRepairPath(v).toLowerCase();
    if (!normalizedVerified) continue;
    if (normalizedVerified === normalizedMissing) return true;
    if (missingBase && basenameLower(v) === missingBase) return true;
    if (missingBase && deliverableBasenamesMatch(missingBase, basenameLower(v), { tier0Profile: true })) {
      return true;
    }
    if (normalizedMissing.includes("/") && normalizedVerified.endsWith(`/${normalizedMissing}`)) {
      return true;
    }
    if (!normalizedMissing.includes("/") && normalizedVerified.endsWith(`/${normalizedMissing}`)) {
      return true;
    }
  }
  return false;
}

function reanchorWithHint(missing: string, turnArtifactDir?: string, pathHints?: string[]): string {
  const normalized = normalizeRepairPath(missing);
  if (!normalized || /(?:^|\/)artifacts\//i.test(normalized)) return normalized;

  const hints = [
    ...(turnArtifactDir ? [turnArtifactDir.replace(/\\/g, "/")] : []),
    ...(pathHints ?? []).map((h) => h.replace(/\\/g, "/")),
  ].filter(Boolean);

  for (const hint of hints) {
    const dir = hint.includes("/") ? hint.replace(/\/[^/]+$/, "") : hint;
    if (dir) return `${dir.replace(/\/+$/, "")}/${normalized.replace(/^\/+/, "")}`;
  }
  return normalized;
}

export function isCampaignPngDegradeEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_CAMPAIGN_PNG_DEGRADE", true);
}

/** Drop campaign PNG missing when verified HTML sibling satisfies the visual slot. */
export function stripCampaignPngMissingWhenHtmlVerified(input: {
  missing: string[];
  verified: string[];
}): string[] {
  if (!isCampaignPngDegradeEnabled()) return input.missing;

  const verifiedNorm = input.verified.map((v) => normalizeRepairPath(v).replace(/\\/g, "/").toLowerCase());

  return input.missing.filter((raw) => {
    const norm = normalizeRepairPath(raw).replace(/\\/g, "/").toLowerCase();
    if (!/\.png$/i.test(norm)) return true;

    const hasPosterHtml = verifiedNorm.some((v) =>
      /\.html?$/i.test(v) && /(?:poster|kv|visual|main-visual|hero|主视觉)/i.test(v));
    const hasSocialHtml = verifiedNorm.some((v) =>
      /\.html?$/i.test(v) && /(?:social|05-social|platform-visual)/i.test(v));

    if (/(?:poster|kv|visual|main-visual|hero|主视觉)/i.test(norm) && hasPosterHtml) {
      return false;
    }
    if (/(?:social|05-social|platform-visual)/i.test(norm) && hasSocialHtml) {
      return false;
    }
    return true;
  });
}

/** Remove missing entries already covered by verified paths (basename or suffix match). */
export function reconcileMissingPaths(input: ReconcileMissingPathsInput): string[] {
  if (!isMissingReanchorEnabled()) return [...input.missing];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input.missing) {
    const reanchored = reanchorWithHint(raw, input.turnArtifactDir, input.pathHints);
    if (missingSatisfiedByVerified(reanchored, input.verified)
      || missingSatisfiedByVerified(raw, input.verified)) {
      continue;
    }
    const key = reanchored.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reanchored !== raw ? reanchored : raw);
  }
  return out;
}

export function stripPptxVerifiedSlidePngMissing(input: {
  missing: string[];
  verified: string[];
  capabilitySlug?: string;
  userGoal?: string;
}): string[] {
  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  const goal = String(input.userGoal ?? "");
  const isPptMaster = slug === "ppt-master"
    || /(?:原生可编辑\s*PPT|ppt-master)/i.test(goal);
  if (!isPptMaster) return input.missing;

  const hasPptx = input.verified.some((p) => /\.pptx$/i.test(p));
  if (!hasPptx) return input.missing;

  return input.missing.filter((p) => {
    const base = basenameLower(p);
    if (/^slide-\d+/i.test(base) && /\.png$/i.test(base)) return false;
    if (/\/slides-[^/]+\/slide-/i.test(p.replace(/\\/g, "/"))) return false;
    return true;
  });
}

export function isBrokenGhostFilterEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_BROKEN_GHOST_FILTER", true);
}

/** Drop broken paths that never existed on disk (phantom repair targets). */
export async function filterGhostBrokenPaths(input: {
  cwd: string;
  broken: string[];
}): Promise<string[]> {
  if (!isBrokenGhostFilterEnabled()) return [...input.broken];

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const kept: string[] = [];

  for (const raw of input.broken) {
    const rel = normalizeRepairPath(raw);
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(input.cwd, rel);
    try {
      const stat = await fs.stat(abs);
      if (stat.size > 0) kept.push(raw);
    } catch {
      // phantom — omit from broken
    }
  }
  return kept;
}
