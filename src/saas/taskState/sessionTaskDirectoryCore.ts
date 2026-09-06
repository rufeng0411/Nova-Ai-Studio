// PD-SAAS-FORK: STDA pure helpers — safe for UI/browser bundles (no node:fs).
import type { AgentTranscriptEntry, AgentSessionTaskDirectoryTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import {
  buildDeliverableNamingPromptLinesZh,
} from "../deliverables/deliverableFilenamePolicy.js";

export type SessionTaskDirectory = {
  taskArtifactDir: string;
  taskDirKey: string;
  goalVersion: number;
  allocatedAt: string;
  displayLabel?: string;
  capabilitySlug?: string;
  profileId?: string;
  requiredBasenames?: string[];
};

export type { AgentSessionTaskDirectoryTranscriptEntry };

/** Matches artifacts/task-{YYYYMMDD}-{id8} or conflict suffix -2, -3, … */
export const TASK_ARTIFACT_DIR_REGEX =
  /^artifacts\/task-\d{8}-[a-f0-9]{8}(-\d+)?(\/|$)/i;

const SEMANTIC_ARTIFACT_DIR_REGEX =
  /^artifacts\/(?:geo|slides|campaign|research|acquisition|social-matrix|matrix|content|sales|legal|promo|podcast|debate|xhs|data-story|ad-storyboard|viral-script|short-drama|saas-demo|design|media)(?:\/|$)/i;

export function turnIdToId8(turnId: string): string {
  const stripped = String(turnId ?? "").replace(/^turn[_-]?/i, "");
  const hex = stripped.replace(/-/g, "").toLowerCase().replace(/[^a-f0-9]/g, "");
  if (hex.length >= 8) return hex.slice(-8);
  return hex.padStart(8, "0");
}

/** Calendar day in UTC+8 at allocation time. */
export function formatTaskDateYyyymmddUtc8(now: Date = new Date()): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const utc8 = new Date(now.getTime() + offsetMs);
  const y = utc8.getUTCFullYear();
  const m = String(utc8.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc8.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildTaskDirKey(turnId: string, now?: Date): string {
  return `${formatTaskDateYyyymmddUtc8(now)}-${turnIdToId8(turnId)}`;
}

export function buildTaskArtifactDirFromKey(taskDirKey: string, conflictSuffix?: number): string {
  const suffix = conflictSuffix && conflictSuffix > 1 ? `-${conflictSuffix}` : "";
  return `artifacts/task-${taskDirKey}${suffix}`;
}

export function isTaskArtifactDirPath(dir: string | null | undefined): boolean {
  if (!dir || typeof dir !== "string") return false;
  const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  return TASK_ARTIFACT_DIR_REGEX.test(`${normalized}/`);
}

export function isSemanticArtifactDirPath(dir: string | null | undefined): boolean {
  if (!dir || typeof dir !== "string") return false;
  const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  if (isTaskArtifactDirPath(normalized)) return false;
  return SEMANTIC_ARTIFACT_DIR_REGEX.test(`${normalized}/`)
    || /^artifacts\/slides-/i.test(normalized)
    || /^artifacts\/[^/]+-\d{8}-\d{4}$/i.test(normalized.split("/").pop() ?? "");
}

export function extractTaskDirKeyFromPath(taskArtifactDir: string): string | undefined {
  const normalized = taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const match = normalized.match(/^artifacts\/task-(\d{8}-[a-f0-9]{8}(?:-\d+)?)$/i);
  return match?.[1]?.toLowerCase();
}

export function sessionTaskDirectoryFromEntry(
  entry: AgentTranscriptEntry,
): SessionTaskDirectory | undefined {
  if (entry.type !== "session_task_directory") return undefined;
  const typed = entry as AgentSessionTaskDirectoryTranscriptEntry;
  return {
    taskArtifactDir: typed.taskArtifactDir,
    taskDirKey: typed.taskDirKey,
    goalVersion: typed.goalVersion,
    allocatedAt: typed.allocatedAt,
    displayLabel: typed.displayLabel,
    capabilitySlug: typed.capabilitySlug,
    profileId: typed.profileId,
    requiredBasenames: typed.requiredBasenames,
  };
}

export function resolveLatestSessionTaskDirectoryFromEntries(
  entries: AgentTranscriptEntry[],
): SessionTaskDirectory | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const dir = sessionTaskDirectoryFromEntry(entries[i]!);
    if (dir) return dir;
  }
  return undefined;
}

export function resolveSessionTaskDirectoryForGoalVersion(
  entries: AgentTranscriptEntry[],
  goalVersion: number,
): SessionTaskDirectory | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const dir = sessionTaskDirectoryFromEntry(entries[i]!);
    if (dir?.goalVersion === goalVersion) return dir;
  }
  return undefined;
}

export function parseDisplayLabelFromUserGoal(userGoal: string): string | undefined {
  const trimmed = String(userGoal ?? "").trim();
  if (!trimmed || trimmed.length > 80) return undefined;
  let firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  firstLine = firstLine.replace(/[，,。]?\s*(?:须交付|直接开始做|不要|别做|禁止空转)[\s\S]*$/u, "").trim();
  if (firstLine.length < 4) return undefined;
  return firstLine.slice(0, 80);
}

export function buildTaskArtifactDirPromptXml(directory: SessionTaskDirectory): string {
  const namingLines = buildDeliverableNamingPromptLinesZh({
    displayLabel: directory.displayLabel,
    profileId: directory.profileId,
    capabilitySlug: directory.capabilitySlug,
    lockedBasenames: directory.requiredBasenames,
  });
  return [
    `<task-artifact-dir path="${directory.taskArtifactDir}">`,
    "All deliverables for this task MUST be written only under this directory.",
    "Do not create artifacts/geo/, artifacts/slides-*, or any other semantic artifact folders.",
    "Use basename-only filenames inside this task root.",
    namingLines.length > 0
      ? namingLines.join("\n")
      : "Use basename-only filenames (e.g. keywords.md, slide-01.png) inside this task root.",
    `When using glob or list_dir, always pass path="${directory.taskArtifactDir}" — never scan artifacts/**/* without a path.`,
    directory.displayLabel ? `display-label="${directory.displayLabel.replace(/"/g, "'")}"` : "",
    "</task-artifact-dir>",
  ].filter(Boolean).join("\n");
}

export function toSessionTaskDirectoryTranscriptEntry(
  sessionId: string,
  turnId: string,
  directory: SessionTaskDirectory,
  base: { sequence: number; createdAt: string; entryId?: string },
): AgentSessionTaskDirectoryTranscriptEntry {
  return {
    type: "session_task_directory",
    sessionId,
    turnId,
    sequence: base.sequence,
    createdAt: base.createdAt,
    entryId: base.entryId,
    taskArtifactDir: directory.taskArtifactDir,
    taskDirKey: directory.taskDirKey,
    goalVersion: directory.goalVersion,
    allocatedAt: directory.allocatedAt,
    displayLabel: directory.displayLabel,
    capabilitySlug: directory.capabilitySlug,
    profileId: directory.profileId,
    requiredBasenames: directory.requiredBasenames,
  };
}
