// PD-SAAS-FORK: single authoritative task root per session (multi-turn add/remove).
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import { extractToolWrittenDeliverablePaths } from "../deliverables/campaignDeliverableCompleteness.js";
import {
  extractTaskDirKeyFromPath,
  isTaskArtifactDirPath,
  sessionTaskDirectoryFromEntry,
  type SessionTaskDirectory,
} from "./sessionTaskDirectoryCore.js";
import type { SessionDeliverableManifest } from "./sessionDeliverableManifest.js";

function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/\/+$/, "");
}

function taskRootFromResolvedPath(resolvedPath: string | undefined): string | undefined {
  if (!resolvedPath?.trim()) return undefined;
  const normalized = normalizeDir(resolvedPath);
  const match = normalized.match(/^(artifacts\/task-\d{8}-[a-f0-9]{8}(?:-\d+)?)/i);
  return match?.[1]?.toLowerCase();
}

function directoryFromTaskRoot(
  root: string,
  input: {
    manifest?: SessionDeliverableManifest;
    latestDirectory?: SessionTaskDirectory;
  },
): SessionTaskDirectory | undefined {
  const taskDirKey = extractTaskDirKeyFromPath(root);
  if (!taskDirKey) return undefined;
  return {
    taskArtifactDir: normalizeDir(root),
    taskDirKey,
    goalVersion: input.manifest?.goalVersion ?? input.latestDirectory?.goalVersion ?? 1,
    allocatedAt: input.latestDirectory?.allocatedAt ?? new Date().toISOString(),
    displayLabel: input.latestDirectory?.displayLabel,
    capabilitySlug: input.manifest?.capabilitySlug ?? input.latestDirectory?.capabilitySlug,
    profileId: input.manifest?.profileId ?? input.latestDirectory?.profileId,
  };
}

/** PD-SAAS-FORK Razer/FIFA RCA: infer task root from write_file paths (authoritative over polluted SDM). */
export function inferWriteTaskArtifactDirFromMessages(messages: CanonicalMessage[]): string | undefined {
  const writePaths = extractToolWrittenDeliverablePaths(messages);
  const scores = new Map<string, number>();
  writePaths.forEach((raw, index) => {
    const root = taskRootFromResolvedPath(raw);
    if (!root || !isTaskArtifactDirPath(root)) return;
    const base = raw.split("/").pop()?.toLowerCase() ?? "";
    let score = 5 + index * 0.01;
    if (base === "deck.bento.html" || base.endsWith(".bento.html")) score += 25;
    scores.set(root, (scores.get(root) ?? 0) + score);
  });
  let best: string | undefined;
  let bestScore = 0;
  for (const [root, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = root;
    }
  }
  return best;
}

function countWritesUnderRoot(messages: CanonicalMessage[] | undefined, root: string): number {
  if (!messages?.length) return 0;
  const normalizedRoot = normalizeDir(root).toLowerCase();
  return extractToolWrittenDeliverablePaths(messages).filter((raw) => {
    const normalized = normalizeDir(raw).toLowerCase();
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  }).length;
}

function countResolvedPathsUnderRoot(manifest: SessionDeliverableManifest | undefined, root: string): number {
  if (!manifest?.slots?.length) return 0;
  const normalizedRoot = normalizeDir(root);
  let count = 0;
  for (const slot of manifest.slots) {
    if (slot.status === "removed") continue;
    const path = slot.resolvedPath ?? slot.pathHint;
    if (!path) continue;
    const slotRoot = taskRootFromResolvedPath(path) ?? (path.startsWith(normalizedRoot) ? normalizedRoot : undefined);
    if (slotRoot === normalizedRoot) count += 1;
  }
  return count;
}

export function collectTaskRootsFromManifest(manifest: SessionDeliverableManifest | undefined): string[] {
  if (!manifest?.slots?.length) return [];
  const roots = new Set<string>();
  for (const slot of manifest.slots) {
    if (slot.status === "removed") continue;
    const path = slot.resolvedPath ?? slot.pathHint;
    const root = taskRootFromResolvedPath(path);
    if (root && isTaskArtifactDirPath(root)) roots.add(root);
  }
  if (manifest.taskArtifactDir && isTaskArtifactDirPath(manifest.taskArtifactDir)) {
    roots.add(normalizeDir(manifest.taskArtifactDir));
  }
  return [...roots];
}

export function collectSessionKnownTaskDirs(input: {
  entries?: AgentTranscriptEntry[];
  manifest?: SessionDeliverableManifest;
}): string[] {
  const dirs = new Set<string>(collectTaskRootsFromManifest(input.manifest));
  for (const entry of input.entries ?? []) {
    const dir = sessionTaskDirectoryFromEntry(entry);
    if (dir?.taskArtifactDir && isTaskArtifactDirPath(dir.taskArtifactDir)) {
      dirs.add(normalizeDir(dir.taskArtifactDir));
    }
  }
  return [...dirs];
}

/** Primary = write_file task root when it conflicts with SDM; else most resolved slots; tie-break earliest STDA. */
export function resolvePrimaryTaskArtifactDir(input: {
  entries?: AgentTranscriptEntry[];
  manifest?: SessionDeliverableManifest;
  latestDirectory?: SessionTaskDirectory;
  messages?: CanonicalMessage[];
}): SessionTaskDirectory | undefined {
  const writeRoot = input.messages ? inferWriteTaskArtifactDirFromMessages(input.messages) : undefined;
  if (writeRoot && countWritesUnderRoot(input.messages, writeRoot) > 0) {
    const manifestDir = input.manifest?.taskArtifactDir
      ? normalizeDir(input.manifest.taskArtifactDir)
      : "";
    if (!manifestDir || manifestDir !== writeRoot) {
      const fromWrite = directoryFromTaskRoot(writeRoot, input);
      if (fromWrite) return fromWrite;
    }
  }

  const manifestRoots = collectTaskRootsFromManifest(input.manifest);
  if (manifestRoots.length > 0) {
    const scored = manifestRoots.map((root) => ({
      root,
      score: countResolvedPathsUnderRoot(input.manifest, root),
    }));
    scored.sort((a, b) => b.score - a.score || a.root.localeCompare(b.root));
    const best = scored[0]!;
    if (best.score > 0) {
      const taskDirKey = extractTaskDirKeyFromPath(best.root);
      if (taskDirKey) {
        return {
          taskArtifactDir: best.root,
          taskDirKey,
          goalVersion: input.manifest?.goalVersion ?? input.latestDirectory?.goalVersion ?? 1,
          allocatedAt: input.latestDirectory?.allocatedAt ?? new Date().toISOString(),
          displayLabel: input.latestDirectory?.displayLabel,
          capabilitySlug: input.manifest?.capabilitySlug ?? input.latestDirectory?.capabilitySlug,
          profileId: input.manifest?.profileId ?? input.latestDirectory?.profileId,
        };
      }
    }
  }

  const stdaEntries: SessionTaskDirectory[] = [];
  for (const entry of input.entries ?? []) {
    const dir = sessionTaskDirectoryFromEntry(entry);
    if (dir) stdaEntries.push(dir);
  }
  if (stdaEntries.length > 0) {
    const earliest = stdaEntries[0]!;
    return earliest;
  }

  if (input.manifest?.taskArtifactDir && isTaskArtifactDirPath(input.manifest.taskArtifactDir)) {
    const taskDirKey = input.manifest.taskDirKey
      ?? extractTaskDirKeyFromPath(input.manifest.taskArtifactDir);
    if (taskDirKey) {
      return {
        taskArtifactDir: normalizeDir(input.manifest.taskArtifactDir),
        taskDirKey,
        goalVersion: input.manifest.goalVersion,
        allocatedAt: input.latestDirectory?.allocatedAt ?? new Date().toISOString(),
        profileId: input.manifest.profileId,
        capabilitySlug: input.manifest.capabilitySlug,
      };
    }
  }

  return input.latestDirectory;
}

export function resolveEffectiveTaskArtifactDir(input: {
  entries?: AgentTranscriptEntry[];
  manifest?: SessionDeliverableManifest;
  latestDirectory?: SessionTaskDirectory;
  messages?: CanonicalMessage[];
  preserveRootEnabled?: boolean;
}): string | undefined {
  if (input.preserveRootEnabled !== false) {
    const primary = resolvePrimaryTaskArtifactDir(input);
    if (primary?.taskArtifactDir) return primary.taskArtifactDir;
  }
  return input.latestDirectory?.taskArtifactDir ?? input.manifest?.taskArtifactDir;
}
