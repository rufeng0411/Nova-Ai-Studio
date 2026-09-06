// PD-SAAS-FORK: multi-file deliverable gates from capability profiles
import fs from "node:fs/promises";
import path from "node:path";
import {
  isBrandGeoFullCaseGoal,
  isStoryboardPackGoal,
  resolveProfile,
  type DeliverableProfile,
} from "../deliverableCapabilityProfiles.js";
import { isCampaignFullCaseGoal } from "./campaignDeliverableCompleteness.js";

export type RequiredDeliverableCheck = {
  basename: string;
  path?: string;
  exists: boolean;
  sizeBytes: number;
};

export function shouldEnforceProfileRequiredFiles(
  userGoal: string,
  profile: DeliverableProfile,
): boolean {
  if (!profile.requiredArtifacts?.length && !profile.requiredBasenames?.length && !profile.requiredBasenameGroups?.length) return false;
  if (profile.id === "storyboard") {
    return isStoryboardPackGoal(userGoal);
  }
  if (profile.id === "geo") {
    return isBrandGeoFullCaseGoal(userGoal);
  }
  // Composite workflows have their own completeness checks. Do not let broad
  // words such as "主视觉" route them into the visual-canvas required files.
  if (isCampaignFullCaseGoal(userGoal) || isBrandGeoFullCaseGoal(userGoal)) {
    return false;
  }
  return true;
}

async function walkFiles(root: string, maxDepth = 6): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs, depth + 1);
      } else {
        out.push(abs);
      }
    }
  }
  await visit(root, 0);
  return out;
}

async function collectFilesFromRoots(roots: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const root of roots) {
    for (const file of await walkFiles(root)) {
      out.add(file);
    }
  }
  return [...out];
}

function normalizeRelPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function inferExplicitArtifactDirs(userGoal: string): string[] {
  const text = String(userGoal ?? "");
  const dirs = new Set<string>();
  const artifactPathPattern = /artifacts\/[^\s`"'，。；;、)）\]]+/gi;
  for (const match of text.matchAll(artifactPathPattern)) {
    const raw = normalizeRelPath(match[0]);
    const ext = path.extname(raw);
    const dir = ext ? path.posix.dirname(raw) : raw;
    if (dir && dir !== "." && dir.startsWith("artifacts/")) {
      dirs.add(dir);
    }
  }
  return [...dirs].sort((a, b) => b.length - a.length);
}

function chooseBestMatch(input: {
  files: string[];
  cwd: string;
  basename: string;
  artifactDirHints: string[];
}): string | undefined {
  const normalizedBase = input.basename.toLowerCase();
  const matches = input.files.filter((abs) => path.basename(abs).toLowerCase() === normalizedBase);
  if (matches.length === 0) return undefined;

  for (const hint of input.artifactDirHints) {
    const normalizedHint = normalizeRelPath(hint);
    const match = matches.find((abs) => {
      const rel = normalizeRelPath(path.relative(input.cwd, abs));
      return rel === normalizedHint || rel.startsWith(`${normalizedHint}/`);
    });
    if (match) return match;
  }

  if (input.artifactDirHints.length > 0) return undefined;
  return matches[0];
}

function buildRequiredGroups(profile: DeliverableProfile): string[][] {
  if (profile.requiredBasenameGroups?.length) return profile.requiredBasenameGroups;
  return (profile.requiredArtifacts ?? profile.requiredBasenames ?? []).map((basename) => [basename]);
}

function choosePlatformDraftMatches(input: {
  files: string[];
  cwd: string;
  basenames: string[];
  artifactDirHints: string[];
  count: number;
}): string[] {
  const matches: string[] = [];
  const seenRel = new Set<string>();
  for (const basename of input.basenames) {
    const match = chooseBestMatch({
      files: input.files,
      cwd: input.cwd,
      basename,
      artifactDirHints: input.artifactDirHints,
    });
    if (!match) continue;
    const rel = normalizeRelPath(path.relative(input.cwd, match));
    if (seenRel.has(rel)) continue;
    seenRel.add(rel);
    matches.push(match);
    if (matches.length >= input.count) break;
  }
  return matches;
}

function buildScanRoots(input: {
  cwd: string;
  profile: DeliverableProfile;
  artifactDirHints: string[];
}): string[] {
  const roots = new Set<string>();
  roots.add(path.join(input.cwd, "artifacts"));
  if (input.profile.id !== "video_template") return [...roots];

  for (const hint of input.artifactDirHints) {
    const normalized = normalizeRelPath(hint);
    if (!normalized || normalized === "." || normalized.startsWith("../") || path.isAbsolute(normalized)) continue;
    roots.add(path.join(input.cwd, normalized));
  }
  return [...roots];
}

export async function checkProfileRequiredDeliverables(input: {
  cwd: string;
  userGoal: string;
  capabilitySlug?: string;
  majorCategory?: string;
  artifactDirHints?: string[];
}): Promise<RequiredDeliverableCheck[]> {
  const profile = resolveProfile(input.capabilitySlug, input.majorCategory, input.userGoal);
  if (!shouldEnforceProfileRequiredFiles(input.userGoal, profile)) {
    return [];
  }
  const checks: RequiredDeliverableCheck[] = [];
  const artifactDirHints = [
    ...(input.artifactDirHints ?? []),
    ...inferExplicitArtifactDirs(input.userGoal),
  ];
  const requiredGroups = buildRequiredGroups(profile);
  if (requiredGroups.length === 0) return [];

  const files = await collectFilesFromRoots(buildScanRoots({
    cwd: input.cwd,
    profile,
    artifactDirHints,
  }));

  for (const basenames of requiredGroups) {
    let match: string | undefined;
    let matchedBasename = basenames[0] ?? "";
    for (const basename of basenames) {
      match = chooseBestMatch({
        files,
        cwd: input.cwd,
        basename,
        artifactDirHints,
      });
      if (match) {
        matchedBasename = basename;
        break;
      }
    }
    if (!match) {
      checks.push({ basename: basenames.join(" / "), exists: false, sizeBytes: 0 });
      continue;
    }
    const rel = path.relative(input.cwd, match).replace(/\\/g, "/");
    try {
      const stat = await fs.stat(match);
      checks.push({
        basename: matchedBasename,
        path: rel,
        exists: stat.size > 0,
        sizeBytes: stat.size,
      });
    } catch {
      checks.push({ basename: matchedBasename, path: rel, exists: false, sizeBytes: 0 });
    }
  }
  if (profile.requiredPlatformDrafts) {
    const matches = choosePlatformDraftMatches({
      files,
      cwd: input.cwd,
      basenames: profile.requiredPlatformDrafts.basenames,
      artifactDirHints,
      count: profile.requiredPlatformDrafts.count,
    });
    for (const match of matches) {
      const rel = path.relative(input.cwd, match).replace(/\\/g, "/");
      try {
        const stat = await fs.stat(match);
        checks.push({
          basename: path.basename(match),
          path: rel,
          exists: stat.size > 0,
          sizeBytes: stat.size,
        });
      } catch {
        checks.push({ basename: path.basename(match), path: rel, exists: false, sizeBytes: 0 });
      }
    }
    if (matches.length < profile.requiredPlatformDrafts.count) {
      checks.push({
        basename: `platform-drafts>=${profile.requiredPlatformDrafts.count}`,
        exists: false,
        sizeBytes: 0,
      });
    }
  }
  return checks;
}
