// PD-SAAS-FORK: structured resume payload from JSONL for soft checkpoint continuation

import type { AgentTranscriptEntry } from "../transcript/TranscriptEntry.js";
import { resolveLatestSessionManifestFromEntries } from "../../saas/taskState/sessionDeliverableManifest.js";
import { resolveLatestSessionTaskDirectoryFromEntries } from "../../saas/taskState/sessionTaskDirectory.js";
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import { isPureGreetingUserText } from "../../saas/intent/resolveCurrentIntent.js";

export type IncompleteTurnSummary = {
  turnId: string;
  userGoal: string;
  completedToolNames: string[];
  artifactPaths: string[];
  verifiedPaths: string[];
  missingPaths: string[];
  brokenPaths: string[];
  lastCompletedStep: number;
  stuckStep?: string;
  recoveryOwner?: string;
  blockedOn?: "permission" | "infra" | "unknown";
  /** PD-SAAS-FORK (P0-2): ISO timestamp of the turn's last activity, for the cold-resume recency window. */
  lastActivityAt?: string;
  sessionGoalAnchor?: string;
  sdmIncompleteSlots?: string[];
  taskArtifactDir?: string;
};

export type TurnProgressPayload = {
  turnId: string;
  stepIndex: number;
  toolName?: string;
  artifactPaths?: string[];
  verifiedPaths?: string[];
  missingPaths?: string[];
  brokenPaths?: string[];
  summaryZh?: string;
  recoveryOwner?: string;
};

const WRITE_TOOL_NAMES = new Set(["write_file", "Write", "write"]);

const TURN_ACTIVITY_TYPES = new Set<AgentTranscriptEntry["type"]>([
  "accepted_input",
  "assistant_message",
  "tool_result_message",
  "turn_progress",
  "subagent_started",
  "subagent_completed",
  "durable_message",
  "turn_interrupted",
]);

function isBootstrapOnlyTurn(entries: AgentTranscriptEntry[], turnId: string): boolean {
  const turnEntries = entries.filter((entry) => entry.turnId === turnId);
  if (turnEntries.length !== 1) return false;
  const only = turnEntries[0];
  return only.type === "accepted_input" && only.synthetic === true;
}

/** Latest turn with transcript activity but no turn_result (ignores synthetic turn-1 when real turns exist). */
function resolveLatestIncompleteTurnId(entries: AgentTranscriptEntry[]): string | null {
  const turnIdsWithResult = new Set(
    entries.filter((entry) => entry.type === "turn_result").map((entry) => entry.turnId),
  );
  const activityByTurn = new Map<string, number>();
  for (const entry of entries) {
    if (turnIdsWithResult.has(entry.turnId)) continue;
    if (!TURN_ACTIVITY_TYPES.has(entry.type)) continue;
    const prev = activityByTurn.get(entry.turnId) ?? -1;
    activityByTurn.set(entry.turnId, Math.max(prev, entry.sequence));
  }
  if (activityByTurn.size === 0) return null;
  if (activityByTurn.size > 1 && activityByTurn.has("turn-1") && isBootstrapOnlyTurn(entries, "turn-1")) {
    activityByTurn.delete("turn-1");
  }
  if (activityByTurn.size === 0) return null;
  return [...activityByTurn.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function resolveStuckSubagentStep(
  turnEntries: AgentTranscriptEntry[],
): string | undefined {
  const completed = new Set<string>();
  for (const entry of turnEntries) {
    if (entry.type !== "subagent_completed") continue;
    const subagentId = (entry as { subagentId?: string }).subagentId;
    if (subagentId) completed.add(subagentId);
  }
  for (let i = turnEntries.length - 1; i >= 0; i -= 1) {
    const entry = turnEntries[i];
    if (entry.type !== "subagent_started") continue;
    const subagentId = (entry as { subagentId?: string }).subagentId;
    const subagentType = (entry as { subagentType?: string }).subagentType;
    if (subagentId && completed.has(subagentId)) continue;
    return subagentType ? `子任务进行中（${subagentType}）` : "子任务进行中";
  }
  return undefined;
}

function extractTextFromAcceptedInput(entry: AgentTranscriptEntry): string {
  if (entry.type !== "accepted_input") return "";
  for (const msg of entry.messages) {
    if (msg.role !== "user") continue;
    for (const block of msg.content) {
      if (block.type === "text" && block.text.trim()) {
        return block.text.trim();
      }
    }
  }
  return "";
}

function extractToolNameFromEntry(entry: AgentTranscriptEntry): string | null {
  if (entry.type !== "tool_result_message" && entry.type !== "assistant_message") {
    return null;
  }
  const msg = entry.message;
  if (msg.role === "assistant") {
    for (const block of msg.content) {
      if (block.type === "tool_call") return block.name;
    }
  }
  if (msg.role === "user") {
    for (const block of msg.content) {
      if (block.type === "tool_result") {
        const id = block.toolCallId;
        return id ?? "tool_result";
      }
    }
  }
  return null;
}

function extractArtifactPathsFromToolResult(entry: AgentTranscriptEntry): string[] {
  if (entry.type !== "tool_result_message") return [];
  const paths: string[] = [];
  for (const block of entry.message.content) {
    if (block.type !== "tool_result") continue;
    const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
    const matches = text.match(/(?:artifacts\/[^\s"'<>]+|[^\s"'<>]+\.(?:md|html|pdf|pptx|png|jpg|json))/gi);
    if (matches) paths.push(...matches);
  }
  return paths;
}

export function detectIncompleteTurn(entries: AgentTranscriptEntry[]): IncompleteTurnSummary | null {
  if (entries.length === 0) return null;

  const turnId = resolveLatestIncompleteTurnId(entries);
  if (!turnId) return null;

  let lastAccepted: AgentTranscriptEntry | null = null;
  let lastAcceptedIndex = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].type === "accepted_input") {
      lastAccepted = entries[i];
      lastAcceptedIndex = i;
      break;
    }
  }
  if (!lastAccepted) return null;

  const turnEntries = entries.filter((e) => e.turnId === turnId);
  if (turnEntries.length === 0) return null;

  const sdm = resolveLatestSessionManifestFromEntries(entries);
  const stda = resolveLatestSessionTaskDirectoryFromEntries(entries);
  let userGoal = extractOriginalUserGoal(entries, lastAcceptedIndex, lastAccepted);
  if (sdm?.sessionGoalAnchor && isContinuationOnlyUserText(userGoal)) {
    userGoal = sdm.sessionGoalAnchor;
  }
  if (!userGoal && sdm?.sessionGoalAnchor) {
    userGoal = sdm.sessionGoalAnchor;
  }
  if (
    isPureGreetingUserText(userGoal)
    && (sdm?.slots?.filter((slot) => slot.status !== "removed").length ?? 0) === 0
  ) {
    return null;
  }
  const sdmIncompleteSlots = sdm?.slots
    .filter((slot) => slot.status !== "removed" && slot.status !== "done")
    .map((slot) => slot.label) ?? [];
  const completedToolNames: string[] = [];
  const artifactPaths = new Set<string>();
  const verifiedPaths = new Set<string>();
  const missingPaths = new Set<string>();
  const brokenPaths = new Set<string>();
  let lastCompletedStep = 0;
  let stuckStep: string | undefined;
  let recoveryOwner: string | undefined;

  for (const entry of turnEntries) {
    if (entry.type === "turn_progress") {
      const p = entry as AgentTranscriptEntry & TurnProgressPayload & { type: "turn_progress" };
      lastCompletedStep = Math.max(lastCompletedStep, p.stepIndex ?? 0);
      if (p.toolName) completedToolNames.push(p.toolName);
      for (const path of p.artifactPaths ?? []) artifactPaths.add(path);
      for (const path of p.verifiedPaths ?? []) verifiedPaths.add(path);
      for (const path of p.missingPaths ?? []) missingPaths.add(path);
      for (const path of p.brokenPaths ?? []) brokenPaths.add(path);
      if (p.summaryZh) stuckStep = p.summaryZh;
      if (p.recoveryOwner) recoveryOwner = p.recoveryOwner;
      continue;
    }
    if (entry.type === "turn_acceptance_meta") {
      const meta = entry as AgentTranscriptEntry & TurnProgressPayload & {
        type: "turn_acceptance_meta";
        continuationOwner?: string;
      };
      for (const path of meta.verifiedPaths ?? []) verifiedPaths.add(path);
      for (const path of meta.missingPaths ?? []) missingPaths.add(path);
      for (const path of meta.brokenPaths ?? []) brokenPaths.add(path);
      if (meta.continuationOwner) recoveryOwner = meta.continuationOwner;
      continue;
    }
    const toolName = extractToolNameFromEntry(entry);
    if (toolName) {
      completedToolNames.push(toolName);
      lastCompletedStep += 1;
    }
    for (const path of extractArtifactPathsFromToolResult(entry)) {
      artifactPaths.add(path);
    }
  }

  const lastEntry = turnEntries[turnEntries.length - 1];
  let blockedOn: IncompleteTurnSummary["blockedOn"];
  if (lastEntry?.type === "turn_interrupted") {
    const reason = (lastEntry as { reason?: string }).reason ?? "";
    blockedOn = reason.includes("permission") ? "permission" : "infra";
  }
  if (!stuckStep) {
    stuckStep = resolveStuckSubagentStep(turnEntries);
  }

  // Include verified artifact paths from completed turns (e.g. research done, brief pending).
  for (const entry of entries) {
    if (entry.type !== "turn_acceptance_meta") continue;
    const meta = entry as AgentTranscriptEntry & { verifiedPaths?: string[] };
    for (const path of meta.verifiedPaths ?? []) verifiedPaths.add(path);
  }
  for (const entry of entries) {
    if (entry.type !== "tool_result_message") continue;
    for (const path of extractArtifactPathsFromToolResult(entry)) {
      if (path.includes("artifacts/task-")) artifactPaths.add(path);
    }
  }

  return {
    turnId,
    userGoal,
    completedToolNames,
    artifactPaths: [...artifactPaths],
    verifiedPaths: [...verifiedPaths],
    missingPaths: [...missingPaths],
    brokenPaths: [...brokenPaths],
    lastCompletedStep,
    stuckStep,
    recoveryOwner,
    blockedOn,
    lastActivityAt: lastEntry?.createdAt,
    sessionGoalAnchor: sdm?.sessionGoalAnchor,
    sdmIncompleteSlots: sdmIncompleteSlots.length > 0 ? sdmIncompleteSlots : undefined,
    taskArtifactDir: stda?.taskArtifactDir,
  };
}

export function buildTaskResumeXmlFromSummary(summary: IncompleteTurnSummary): string {
  const lines = [
    `<task-resume context="infra_interrupt">`,
    `  <last_turn_id>${summary.turnId}</last_turn_id>`,
  ];
  if (summary.userGoal) {
    lines.push(`  <user_goal>${summary.userGoal.slice(0, 2000)}</user_goal>`);
  }
  if (summary.artifactPaths.length) {
    lines.push(`  <artifacts>${summary.artifactPaths.join("\n")}</artifacts>`);
  }
  if (summary.completedToolNames.length) {
    lines.push(`  <completed_tools>${[...new Set(summary.completedToolNames)].join("\n")}</completed_tools>`);
  }
  if (summary.verifiedPaths.length) {
    lines.push(`  <verified_paths>${summary.verifiedPaths.join("\n")}</verified_paths>`);
  }
  if (summary.missingPaths.length) {
    lines.push(`  <missing_paths>${summary.missingPaths.join("\n")}</missing_paths>`);
  }
  if (summary.brokenPaths.length) {
    lines.push(`  <broken_paths>${summary.brokenPaths.join("\n")}</broken_paths>`);
  }
  if (summary.stuckStep) {
    lines.push(`  <stuck_step>${summary.stuckStep.slice(0, 1000)}</stuck_step>`);
  }
  if (summary.sdmIncompleteSlots?.length) {
    lines.push(`  <sdm_pending>${summary.sdmIncompleteSlots.join("\n")}</sdm_pending>`);
  }
  if (summary.sessionGoalAnchor) {
    lines.push(`  <session_goal_anchor>${summary.sessionGoalAnchor.slice(0, 2000)}</session_goal_anchor>`);
  }
  if (summary.taskArtifactDir) {
    lines.push(`  <task_artifact_dir>${summary.taskArtifactDir}</task_artifact_dir>`);
    lines.push(`  <instruction>续跑时勿更换任务目录，所有缺失交付物写入 ${summary.taskArtifactDir}/</instruction>`);
  }
  if (
    summary.taskArtifactDir
    && summary.sdmIncompleteSlots?.some((label) => /官网|website|index\.html/i.test(label))
  ) {
    lines.push(
      `  <instruction>官方网站缺失时：read_skill open-design relativePath=references/design-systems/…，再在 ${summary.taskArtifactDir}/index.html write_file 单文件 HTML 落地页（虚构 campaign 页，勿 fetch 真实官网）</instruction>`,
    );
  }
  if (summary.recoveryOwner) {
    lines.push(`  <recovery_owner>${summary.recoveryOwner}</recovery_owner>`);
  }
  lines.push(
    `  <instruction>从上次未完成步骤继续，勿重复已完成交付物</instruction>`,
    `</task-resume>`,
  );
  return lines.join("\n");
}

export function buildTaskResumeContextFromTranscript(entries: AgentTranscriptEntry[]): string | null {
  const summary = detectIncompleteTurn(entries);
  if (!summary) return null;
  return buildTaskResumeXmlFromSummary(summary);
}

function isSyntheticResumePrompt(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return true;
  if (isContinuationOnlyUserText(trimmed)) return true;
  if (trimmed.startsWith("<task-resume")) return true;
  if (/<task-resume[\s>]/i.test(trimmed)) return true;
  return false;
}

function extractOriginalUserGoal(
  entries: AgentTranscriptEntry[],
  lastAcceptedIndex: number,
  lastAccepted: AgentTranscriptEntry,
): string {
  const latest = extractTextFromAcceptedInput(lastAccepted);
  if (latest && !isSyntheticResumePrompt(latest)) {
    return latest;
  }
  for (let i = lastAcceptedIndex - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== "accepted_input") continue;
    const text = extractTextFromAcceptedInput(entry);
    if (text && !isSyntheticResumePrompt(text)) {
      return text;
    }
  }
  return isSyntheticResumePrompt(latest) ? "" : latest;
}
