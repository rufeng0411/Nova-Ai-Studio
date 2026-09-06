// PD-SAAS-FORK: STDA — system-assigned unique task artifact directory per goalVersion.
import { access } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSessionTaskDirectoryTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import { isSessionTaskDirectoryEnabled } from "../resilience/stabilityFlags.js";
import { userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import { hasExplicitFileCompletionIntent } from "../intent/capabilityCompletionMode.js";
import { extractMustDeliverBasenames } from "../deliverables/deliverableFilenamePolicy.js";
import {
  buildTaskArtifactDirFromKey,
  buildTaskArtifactDirPromptXml,
  buildTaskDirKey,
  parseDisplayLabelFromUserGoal,
  type SessionTaskDirectory,
  toSessionTaskDirectoryTranscriptEntry,
  TASK_ARTIFACT_DIR_REGEX,
  turnIdToId8,
  formatTaskDateYyyymmddUtc8,
  isTaskArtifactDirPath,
  isSemanticArtifactDirPath,
  extractTaskDirKeyFromPath,
  sessionTaskDirectoryFromEntry,
  resolveLatestSessionTaskDirectoryFromEntries,
  resolveSessionTaskDirectoryForGoalVersion,
} from "./sessionTaskDirectoryCore.js";

export type { SessionTaskDirectory, AgentSessionTaskDirectoryTranscriptEntry };
export {
  TASK_ARTIFACT_DIR_REGEX,
  turnIdToId8,
  formatTaskDateYyyymmddUtc8,
  buildTaskDirKey,
  buildTaskArtifactDirFromKey,
  isTaskArtifactDirPath,
  isSemanticArtifactDirPath,
  extractTaskDirKeyFromPath,
  sessionTaskDirectoryFromEntry,
  resolveLatestSessionTaskDirectoryFromEntries,
  resolveSessionTaskDirectoryForGoalVersion,
  parseDisplayLabelFromUserGoal,
  buildTaskArtifactDirPromptXml,
  toSessionTaskDirectoryTranscriptEntry,
};

async function taskDirExistsOnDisk(cwd: string, taskArtifactDir: string): Promise<boolean> {
  try {
    await access(join(cwd, taskArtifactDir.replace(/\\/g, "/")));
    return true;
  } catch {
    return false;
  }
}

export async function ensureUniqueTaskArtifactDir(input: {
  cwd: string;
  turnId: string;
  now?: Date;
}): Promise<{ taskArtifactDir: string; taskDirKey: string }> {
  const baseKey = buildTaskDirKey(input.turnId, input.now);
  let suffix = 1;
  while (suffix <= 99) {
    const taskArtifactDir = buildTaskArtifactDirFromKey(baseKey, suffix > 1 ? suffix : undefined);
    // eslint-disable-next-line no-await-in-loop
    const exists = await taskDirExistsOnDisk(input.cwd, taskArtifactDir);
    if (!exists) {
      const taskDirKey = suffix > 1 ? `${baseKey}-${suffix}` : baseKey;
      return { taskArtifactDir, taskDirKey };
    }
    suffix += 1;
  }
  const taskDirKey = `${baseKey}-${suffix}`;
  return { taskArtifactDir: buildTaskArtifactDirFromKey(baseKey, suffix), taskDirKey };
}

export type AllocateSessionTaskDirectoryInput = {
  sessionId: string;
  turnId: string;
  goalVersion: number;
  userGoal?: string;
  displayLabel?: string;
  capabilitySlug?: string;
  profileId?: string;
  cwd: string;
  previousDirectory?: SessionTaskDirectory;
  forceNew?: boolean;
  /** PD-SAAS-FORK: rebind goalVersion on same path (add/remove/replace). */
  preserveRoot?: boolean;
  /** When preserveRoot, write into this path instead of previousDirectory.taskArtifactDir. */
  preserveRootDir?: string;
  now?: () => Date;
};

export async function allocateSessionTaskDirectory(
  input: AllocateSessionTaskDirectoryInput,
): Promise<SessionTaskDirectory | null> {
  if (!isSessionTaskDirectoryEnabled()) return null;

  if (
    !input.forceNew
    && input.previousDirectory
    && input.previousDirectory.goalVersion === input.goalVersion
  ) {
    return input.previousDirectory;
  }

  const now = input.now?.() ?? new Date();

  if (input.preserveRoot && input.previousDirectory) {
    const taskArtifactDir = input.preserveRootDir?.trim()
      || input.previousDirectory.taskArtifactDir;
    const taskDirKey = extractTaskDirKeyFromPath(taskArtifactDir)
      ?? input.previousDirectory.taskDirKey;
    return {
      ...input.previousDirectory,
      taskArtifactDir,
      taskDirKey,
      goalVersion: input.goalVersion,
      allocatedAt: now.toISOString(),
      displayLabel: input.displayLabel ?? input.previousDirectory.displayLabel
        ?? parseDisplayLabelFromUserGoal(input.userGoal ?? ""),
      capabilitySlug: input.capabilitySlug ?? input.previousDirectory.capabilitySlug,
      profileId: input.profileId ?? input.previousDirectory.profileId,
      requiredBasenames: (() => {
        const next = extractMustDeliverBasenames(input.userGoal ?? "");
        return next.length > 0 ? next : input.previousDirectory.requiredBasenames;
      })(),
    };
  }
  const unique = await ensureUniqueTaskArtifactDir({
    cwd: input.cwd,
    turnId: input.turnId,
    now,
  });

  return {
    taskArtifactDir: unique.taskArtifactDir,
    taskDirKey: unique.taskDirKey,
    goalVersion: input.goalVersion,
    allocatedAt: now.toISOString(),
    displayLabel: input.displayLabel ?? parseDisplayLabelFromUserGoal(input.userGoal ?? ""),
    capabilitySlug: input.capabilitySlug,
    profileId: input.profileId,
    requiredBasenames: (() => {
      const next = extractMustDeliverBasenames(input.userGoal ?? "");
      return next.length > 0 ? next : undefined;
    })(),
  };
}

export function shouldAllocateSessionTaskDirectory(userGoal: string): boolean {
  if (!isSessionTaskDirectoryEnabled()) return false;
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  // PD-SAAS-FORK Fix-7: Hub「须交付 *.md」try-prompt must allocate STDA even when
  // userGoalImpliesDeliverable regex misses (e.g. ala-fact-checker output.md).
  return userGoalImpliesDeliverable(goal) || hasExplicitFileCompletionIntent(goal);
}
