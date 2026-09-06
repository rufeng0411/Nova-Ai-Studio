// PD-SAAS-FORK: bootstrap STDA on user message accept (before model turn).
import { readFile } from "node:fs/promises";
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTranscriptWriter } from "../transcript/TranscriptWriter.js";
import type { AgentTranscriptEntry } from "../transcript/TranscriptEntry.js";
import type { CapabilityBindingContext } from "../../agent/protocol/input.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import {
  allocateSessionTaskDirectory,
  resolveLatestSessionTaskDirectoryFromEntries,
  resolveSessionTaskDirectoryForGoalVersion,
  shouldAllocateSessionTaskDirectory,
  type SessionTaskDirectory,
} from "../../saas/taskState/sessionTaskDirectory.js";
import {
  isSessionTaskDirectoryEnabled,
  isStdaAddPreserveRootEnabled,
} from "../../saas/resilience/stabilityFlags.js";
import { resolvePrimaryTaskArtifactDir } from "../../saas/taskState/resolvePrimaryTaskArtifactDir.js";
import type { CapabilityCompletionMode } from "../../saas/intent/capabilityCompletionMode.js";

const EXPLICIT_NEW_TASK_SIGNAL = /(?:新开任务|新文件夹|新建任务目录|新的任务目录)/i;

const PRESERVE_ROOT_DIFFS = new Set(["add", "remove", "replace"]);

function textFromUserMessages(messages: CanonicalMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (message.metadata?.synthetic) continue;
    const parts = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (parts) return parts;
  }
  return "";
}

async function loadTranscriptEntries(transcriptPath: string): Promise<AgentTranscriptEntry[]> {
  if (!transcriptPath) return [];
  try {
    const raw = await readFile(transcriptPath, "utf8");
    const entries: AgentTranscriptEntry[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as AgentTranscriptEntry);
      } catch {
        // skip bad lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function shouldForceNewTaskDirectory(input: {
  manifest?: SessionDeliverableManifest;
  previousDirectory?: SessionTaskDirectory;
  userText: string;
}): boolean {
  const diff = input.manifest?.supersedes?.diff;
  if (diff === "pivot") return true;
  if (input.manifest && !input.manifest.taskArtifactDir && input.previousDirectory) return true;
  if (EXPLICIT_NEW_TASK_SIGNAL.test(input.userText)) return true;
  return false;
}

function shouldPreserveRootOnMutation(manifest?: SessionDeliverableManifest): boolean {
  if (!isStdaAddPreserveRootEnabled()) return false;
  const diff = manifest?.supersedes?.diff;
  return Boolean(diff && PRESERVE_ROOT_DIFFS.has(diff));
}

export async function bootstrapSessionTaskDirectory(input: {
  sessionId: string;
  turnId: string;
  acceptedMessages: CanonicalMessage[];
  transcript: AgentTranscriptWriter;
  transcriptPath: string;
  cwd: string;
  capabilityContext?: CapabilityBindingContext;
  sessionDeliverableManifest?: SessionDeliverableManifest;
  /** PD-SAAS-FORK: P0-1 exact capability completion mode. */
  capabilityCompletionMode?: CapabilityCompletionMode;
}): Promise<{ directory?: SessionTaskDirectory; allocated: boolean }> {
  if (!isSessionTaskDirectoryEnabled()) return { allocated: false };
  if (input.capabilityCompletionMode === "consultation") return { allocated: false };
  if (typeof input.transcript.recordSessionTaskDirectory !== "function") return { allocated: false };

  const userText = textFromUserMessages(input.acceptedMessages);
  const entries = await loadTranscriptEntries(input.transcriptPath);
  const previousDirectory = resolveLatestSessionTaskDirectoryFromEntries(entries);

  if (
    !userText
    || (
      input.capabilityCompletionMode !== "report"
      && !shouldAllocateSessionTaskDirectory(userText)
    )
  ) {
    const primary = resolvePrimaryTaskArtifactDir({
      entries,
      manifest: input.sessionDeliverableManifest,
      latestDirectory: previousDirectory,
      messages: input.acceptedMessages,
    });
    return { directory: primary ?? previousDirectory, allocated: false };
  }

  const manifest = input.sessionDeliverableManifest;
  const goalVersion = manifest?.goalVersion ?? previousDirectory?.goalVersion ?? 1;

  const forceNew = shouldForceNewTaskDirectory({
    manifest,
    previousDirectory,
    userText,
  });

  const preserveRoot = !forceNew && shouldPreserveRootOnMutation(manifest);
  const primary = preserveRoot
    ? resolvePrimaryTaskArtifactDir({
      entries,
      manifest,
      latestDirectory: previousDirectory,
      messages: input.acceptedMessages,
    })
    : undefined;

  const existingForGoal = resolveSessionTaskDirectoryForGoalVersion(entries, goalVersion);
  if (existingForGoal && !forceNew && !preserveRoot) {
    return { directory: existingForGoal, allocated: false };
  }

  const directory = await allocateSessionTaskDirectory({
    sessionId: input.sessionId,
    turnId: input.turnId,
    goalVersion,
    userGoal: userText,
    capabilitySlug: input.capabilityContext?.slug ?? manifest?.capabilitySlug,
    profileId: manifest?.profileId,
    cwd: input.cwd,
    previousDirectory: previousDirectory ?? primary,
    forceNew,
    preserveRoot,
    preserveRootDir: primary?.taskArtifactDir,
  });

  if (!directory) {
    const fallback = resolvePrimaryTaskArtifactDir({
      entries,
      manifest,
      latestDirectory: previousDirectory,
      messages: input.acceptedMessages,
    });
    return { directory: fallback ?? previousDirectory, allocated: false };
  }

  const effectiveDirectory = preserveRoot && primary
    ? { ...directory, taskArtifactDir: primary.taskArtifactDir, taskDirKey: primary.taskDirKey }
    : directory;

  const changed = !previousDirectory
    || previousDirectory.taskArtifactDir !== effectiveDirectory.taskArtifactDir
    || previousDirectory.goalVersion !== effectiveDirectory.goalVersion;

  if (changed) {
    await input.transcript.recordSessionTaskDirectory(
      input.sessionId,
      input.turnId,
      effectiveDirectory,
    );
  }

  return { directory: effectiveDirectory, allocated: changed };
}
