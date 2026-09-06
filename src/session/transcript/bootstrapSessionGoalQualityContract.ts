import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CanonicalMessage } from "../../model/index.js";
import type { CapabilityBindingContext } from "../../agent/protocol/input.js";
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import {
  isCapabilityCompletionTaskResumeInput,
  type CapabilityCompletionMode,
} from "../../saas/intent/capabilityCompletionMode.js";
import {
  boundSessionGoalQualityContract,
  compileSessionGoalQualityContract,
  computeGoalQualityContractHash,
  GOAL_QUALITY_CONTRACT_HASH_VERSION,
  GOAL_QUALITY_CONTRACT_VERSION,
  type GoalQualityPolicyInput,
  type SessionGoalQualityContract,
} from "../../saas/constraints/goalQualityContract.js";
import {
  resolveLatestSessionManifestFromEntries,
  type SessionDeliverableManifest,
} from "../../saas/taskState/sessionDeliverableManifest.js";
import {
  bootstrapSessionDeliverableManifest,
  textFromUserMessages,
} from "./bootstrapSessionDeliverableManifest.js";
import type {
  AgentSessionGoalQualityContractTranscriptEntry,
  AgentTranscriptEntry,
} from "./TranscriptEntry.js";
import type { AgentTranscriptWriter } from "./TranscriptWriter.js";

/**
 * PD-SAAS-FORK P0-2: fail-closed SDM + quality-contract bootstrap barrier.
 * The accepted input has already been durably appended before this runs.
 */
export type BootstrapSessionGoalQualityContractInput = {
  sessionId: string;
  turnId: string;
  acceptedMessages: CanonicalMessage[];
  transcript: AgentTranscriptWriter;
  transcriptPath: string;
  capabilityContext?: CapabilityBindingContext;
  capabilityCompletionMode?: CapabilityCompletionMode;
  launchContext?: string | Record<string, unknown> | null;
  exactCapabilityPolicy?: GoalQualityPolicyInput | null;
  profileFallback?: GoalQualityPolicyInput | null;
  readEntries?: () => Promise<AgentTranscriptEntry[]>;
};

export type BootstrapSessionGoalQualityContractResult = {
  manifest?: SessionDeliverableManifest;
  previousManifest?: SessionDeliverableManifest;
  completionMode?: CapabilityCompletionMode;
  manifestVersionChanged: boolean;
  qualityContract: AgentSessionGoalQualityContractTranscriptEntry;
  qualityContractHash: string;
  qualityVersionChanged: boolean;
};

const PROJECT_MEMORY_MARKUP =
  /<(?:project-memory|session-memory|memory-retrieve)\b[^>]*>[\s\S]*?<\/(?:project-memory|session-memory|memory-retrieve)>/giu;
const RECOVERY_ONLY_TEXT =
  /^(?:正在)?(?:从上次(?:步骤|进度|中断处)|自动)(?:继续|恢复)|^正在从上次步骤继续/iu;

function stripNonAuthoritativeGoalMarkup(text: string): string {
  return String(text ?? "")
    .replace(PROJECT_MEMORY_MARKUP, " ")
    .trim();
}

function isContinuationOrRecoveryText(text: string): boolean {
  const normalized = stripNonAuthoritativeGoalMarkup(text);
  return !normalized
    || isCapabilityCompletionTaskResumeInput(normalized)
    || isContinuationOnlyUserText(normalized)
    || RECOVERY_ONLY_TEXT.test(normalized);
}

function normalizeGoalForHash(text: string): string {
  return stripNonAuthoritativeGoalMarkup(text)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

export function computeQualityUserGoalHash(userGoal: string): string {
  const normalized = normalizeGoalForHash(userGoal);
  const digest = createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");
  return `qgoal1:${digest}`;
}

async function readTranscriptEntriesStrict(
  transcriptPath: string,
): Promise<AgentTranscriptEntry[]> {
  if (!transcriptPath) {
    throw new Error("quality bootstrap transcript path is missing");
  }
  let raw: string;
  try {
    raw = await readFile(transcriptPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: AgentTranscriptEntry[] = [];
  for (const [index, line] of raw.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as AgentTranscriptEntry);
    } catch (error) {
      throw new Error(
        `quality bootstrap transcript line ${index + 1} is invalid`,
        { cause: error },
      );
    }
  }
  return entries;
}

export function resolveLatestSessionGoalQualityContractFromEntries(
  entries: readonly AgentTranscriptEntry[],
): AgentSessionGoalQualityContractTranscriptEntry | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type === "session_goal_quality_contract") {
      return entry;
    }
  }
  return undefined;
}

function assertValidQualityEntry(
  entry: AgentSessionGoalQualityContractTranscriptEntry,
): void {
  if (
    entry.qualityContractVersion !== GOAL_QUALITY_CONTRACT_VERSION
    || entry.qualityContractHashVersion
      !== GOAL_QUALITY_CONTRACT_HASH_VERSION
  ) {
    throw new Error("quality contract version is unsupported");
  }
  if (!Number.isSafeInteger(entry.goalVersion) || entry.goalVersion < 1) {
    throw new Error("quality contract goalVersion is invalid");
  }
  const bounded = boundSessionGoalQualityContract(entry.contract);
  const hash = computeGoalQualityContractHash(bounded);
  if (hash !== entry.qualityContractHash) {
    throw new Error("quality contract hash verification failed");
  }
  if (!/^qgoal1:[a-f0-9]{64}$/u.test(entry.userGoalHash)) {
    throw new Error("quality contract userGoalHash is invalid");
  }
}

function latestRealUserGoalFromEntries(
  entries: readonly AgentTranscriptEntry[],
): string {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "accepted_input" || entry.synthetic) continue;
    const text = textFromUserMessages(entry.messages);
    if (!text || isContinuationOrRecoveryText(text)) continue;
    return stripNonAuthoritativeGoalMarkup(text);
  }
  return "";
}

function makeSyntheticQualityEntry(
  input: {
    sessionId: string;
    turnId: string;
    goalVersion: number;
    contract: SessionGoalQualityContract;
    userGoalHash: string;
  },
): AgentSessionGoalQualityContractTranscriptEntry {
  return {
    type: "session_goal_quality_contract",
    sessionId: input.sessionId,
    turnId: input.turnId,
    sequence: 0,
    createdAt: "",
    goalVersion: input.goalVersion,
    qualityContractVersion: GOAL_QUALITY_CONTRACT_VERSION,
    qualityContractHashVersion: GOAL_QUALITY_CONTRACT_HASH_VERSION,
    qualityContractHash: computeGoalQualityContractHash(input.contract),
    contract: boundSessionGoalQualityContract(input.contract),
    compiledAtTurnId: input.turnId,
    userGoalHash: input.userGoalHash,
  };
}

function resolveCompileGoal(input: {
  currentText: string;
  entries: readonly AgentTranscriptEntry[];
}): {
  userGoal: string;
  continuation: boolean;
} {
  const continuation = isContinuationOrRecoveryText(input.currentText);
  if (!continuation) {
    return {
      userGoal: stripNonAuthoritativeGoalMarkup(input.currentText),
      continuation: false,
    };
  }
  return {
    userGoal: latestRealUserGoalFromEntries(input.entries),
    continuation: true,
  };
}

export async function bootstrapSessionGoalQualityContract(
  input: BootstrapSessionGoalQualityContractInput,
): Promise<BootstrapSessionGoalQualityContractResult> {
  if (
    typeof input.transcript.recordSessionDeliverableManifest !== "function"
    || typeof input.transcript.recordSessionGoalQualityContract !== "function"
  ) {
    throw new Error(
      "joint quality bootstrap requires both transcript persistence methods",
    );
  }
  const readEntries =
    input.readEntries ?? (() => readTranscriptEntriesStrict(input.transcriptPath));
  let before: AgentTranscriptEntry[];
  try {
    before = await readEntries();
  } catch (error) {
    throw new Error("quality bootstrap initial transcript read failed", {
      cause: error,
    });
  }
  const previousQuality =
    resolveLatestSessionGoalQualityContractFromEntries(before);
  if (previousQuality) assertValidQualityEntry(previousQuality);

  let sdmResult: Awaited<
    ReturnType<typeof bootstrapSessionDeliverableManifest>
  >;
  try {
    sdmResult = await bootstrapSessionDeliverableManifest({
      sessionId: input.sessionId,
      turnId: input.turnId,
      acceptedMessages: input.acceptedMessages,
      transcript: input.transcript,
      transcriptPath: input.transcriptPath,
      capabilityContext: input.capabilityContext,
      capabilityCompletionMode: input.capabilityCompletionMode,
      transcriptEntries: before,
    });
  } catch (error) {
    throw new Error("joint quality bootstrap SDM append failed", {
      cause: error,
    });
  }

  const currentText = textFromUserMessages(input.acceptedMessages);
  const compileGoal = resolveCompileGoal({
    currentText,
    entries: before,
  });
  if (!compileGoal.userGoal && !previousQuality) {
    throw new Error(
      "joint quality bootstrap cannot resolve a real user goal",
    );
  }
  const targetGoalVersion =
    sdmResult.manifest?.goalVersion
    ?? previousQuality?.goalVersion
    ?? 1;
  if (
    previousQuality
    && previousQuality.goalVersion > targetGoalVersion
  ) {
    throw new Error(
      `joint quality bootstrap mixed goalVersion: quality=${previousQuality.goalVersion}, SDM=${targetGoalVersion}`,
    );
  }

  const pivotedThisTurn =
    sdmResult.manifest?.compiledAtTurnId === input.turnId
    && sdmResult.manifest.supersedes?.diff === "pivot";
  const frozenCurrentVersion =
    previousQuality?.goalVersion === targetGoalVersion
    && !sdmResult.versionChanged;
  let contract: SessionGoalQualityContract;
  if (frozenCurrentVersion && previousQuality) {
    contract = previousQuality.contract;
  } else if (
    previousQuality?.goalVersion === targetGoalVersion
    && previousQuality.compiledAtTurnId === input.turnId
  ) {
    contract = previousQuality.contract;
  } else if (compileGoal.continuation && previousQuality) {
    contract = previousQuality.contract;
  } else {
    const previousFallback = !pivotedThisTurn && previousQuality
      ? previousQuality.contract
      : undefined;
    contract = compileSessionGoalQualityContract({
      userGoal: compileGoal.userGoal,
      launchContext: input.launchContext,
      exactCapabilityPolicy: input.exactCapabilityPolicy,
      profileFallback: previousFallback
        ? {
            ...(input.profileFallback ?? {}),
            ...previousFallback,
          }
        : input.profileFallback,
    });
  }
  contract = boundSessionGoalQualityContract(contract);
  const qualityContractHash = computeGoalQualityContractHash(contract);
  let userGoalHash = (frozenCurrentVersion || compileGoal.continuation) && previousQuality
    ? previousQuality.userGoalHash
    : computeQualityUserGoalHash(compileGoal.userGoal);

  if (
    previousQuality
    && previousQuality.goalVersion === targetGoalVersion
    && !sdmResult.versionChanged
    && previousQuality.qualityContractHash === qualityContractHash
  ) {
    userGoalHash = previousQuality.userGoalHash;
  }

  const alreadyPersisted =
    previousQuality?.goalVersion === targetGoalVersion
    && previousQuality.qualityContractHash === qualityContractHash
    && previousQuality.userGoalHash === userGoalHash;
  if (!alreadyPersisted) {
    try {
      await input.transcript.recordSessionGoalQualityContract(
        input.sessionId,
        input.turnId,
        {
          goalVersion: targetGoalVersion,
          qualityContractVersion: GOAL_QUALITY_CONTRACT_VERSION,
          qualityContractHashVersion: GOAL_QUALITY_CONTRACT_HASH_VERSION,
          qualityContractHash,
          contract,
          compiledAtTurnId: input.turnId,
          userGoalHash,
        },
      );
    } catch (error) {
      throw new Error("quality contract append failed", { cause: error });
    }
  }

  let after: AgentTranscriptEntry[];
  try {
    after = await readEntries();
  } catch (error) {
    throw new Error("quality bootstrap post-append reread failed", {
      cause: error,
    });
  }
  const latestManifest = resolveLatestSessionManifestFromEntries(after);
  const latestQuality =
    resolveLatestSessionGoalQualityContractFromEntries(after);
  if (!latestQuality) {
    throw new Error("quality bootstrap reread did not find a quality row");
  }
  assertValidQualityEntry(latestQuality);
  if (
    sdmResult.manifest
    && latestManifest?.goalVersion !== targetGoalVersion
  ) {
    throw new Error(
      `joint quality bootstrap mixed goalVersion after reread: quality=${latestQuality.goalVersion}, SDM=${latestManifest?.goalVersion ?? "missing"}`,
    );
  }
  if (
    latestQuality.goalVersion !== targetGoalVersion
    || latestQuality.qualityContractHash !== qualityContractHash
    || latestQuality.userGoalHash !== userGoalHash
  ) {
    throw new Error(
      "joint quality bootstrap version/hash verification failed after reread",
    );
  }

  return {
    manifest: latestManifest ?? sdmResult.manifest,
    previousManifest: sdmResult.previousManifest,
    completionMode: sdmResult.completionMode,
    manifestVersionChanged: sdmResult.versionChanged,
    qualityContract: latestQuality
      ?? makeSyntheticQualityEntry({
        sessionId: input.sessionId,
        turnId: input.turnId,
        goalVersion: targetGoalVersion,
        contract,
        userGoalHash,
      }),
    qualityContractHash,
    qualityVersionChanged: !alreadyPersisted,
  };
}
