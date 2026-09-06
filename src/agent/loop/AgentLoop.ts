import { sanitizeMessagesForModel } from "../../model/request/sanitizeMessagesForModel.js";
import { setTimeout as sleep } from "node:timers/promises";
import {
  applyModelEventToAssembler,
  assembleAssistantMessage,
  cloneMessages,
  createModelMessageAssemblerState,
  type CanonicalToolCall,
  type CanonicalToolSchema,
  PROMPT_TOO_LONG_ANTHROPIC_PATTERN,
  PROMPT_TOO_LONG_OPENAI_PATTERN,
  REQUEST_TOO_LARGE_PATTERN,
  type CanonicalMessage,
  type CanonicalModelError,
  type CanonicalModelRequest,
  type CanonicalUsage,
} from "../../model/index.js";
import type {
  PilotDeckReadFileStateMap,
  PilotDeckSubagentForkApi,
  PilotDeckToolResult,
  PilotDeckToolRuntimeContext,
  PilotDeckWriteSnapshotMap,
} from "../../tool/index.js";
import {
  SUBAGENT_DEFINITIONS,
  getSubagentDefinition,
} from "../sub/builtinSubagentTypes.js";
import { buildPlanModeAgentToolSchema } from "../../tool/builtin/agent.js";
import { agentError } from "../protocol/errors.js";
import type { AgentEvent } from "../protocol/events.js";
import type { AgentPermissionDenial, AgentTurnResult } from "../protocol/result.js";
import type { AgentRuntimeConfig } from "../runtime/AgentRuntimeConfig.js";
import type { AgentRuntimeDependencies } from "../runtime/AgentRuntimeDependencies.js";
import type { LifecycleDispatchResult } from "../../lifecycle/index.js";
import type { PilotDeckHookEvent } from "../../extension/hooks/protocol/events.js";
import type { AgentTurnAcceptanceMetaTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import { NullContextRuntime } from "../../context/NullContextRuntime.js";
import type { AgentContextRuntime } from "../../context/ContextRuntime.js";
import type { ContextRecoveryDecision } from "../../context/index.js";
import type { PermissionMode, PermissionRule, PermissionRuleSet } from "../../permission/index.js";
import { collectToolCalls } from "./collectToolCalls.js";
import { createMissingToolResult, ensureToolResultPairing } from "./ensureToolResultPairing.js";
import { LargeFileRepair, type LargeFileRepairDecision } from "./LargeFileRepair.js";
import { projectToolResults } from "./projectToolResults.js";
// PD-SAAS-FORK: gentle recovery (tool/model) coexists with upstream max_output recovery
import {
  buildInvalidToolInputRecoveryPrompt,
  buildLargeFilePartialContinuePrompt,
  buildPrematureStopRecoveryUserMessage,
  isInfrastructureDisconnectMessage,
  looksLikeTaskDelivered,
  isContinuationOnlyUserText,
  isTaskFollowUpComplaintText,
  userGoalImpliesDeliverable,
  shouldAutoContinueAfterAssistantText,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  userGoalRequestsDirectStart,
} from "../errors/userFacingErrors.js";
import { ASK_USER_QUESTION_TOOL_NAME } from "../../tool/builtin/askUserQuestion.js";
import {
  buildSoftFetchRecoveryUserMessage,
  buildToolRecoveryUserMessage,
  buildToolRepeatTerminalMessage,
  isSoftFailedToolResult,
  isStuckInvalidInputTurn,
  isTransientModelErrorMessage,
  MAX_RECOVERY_ATTEMPTS,
  shouldInjectSoftFetchRecoveryTurn,
  shouldInjectToolRecoveryTurn,
} from "./toolFailureRecovery.js";
import {
  buildCapabilityBindingAppendPrompt,
  resolveDistillExtra,
  type CapabilityBindingContext,
  resolveDesignCanvasAgentAppendFromMessages,
} from "../../saas/capabilityBindingPrompt.js";
import {
  compileDeliverableBriefContract,
  buildBriefContractAppendPrompt,
} from "../../saas/deliverables/deliverableBriefContract.js";
import {
  resolveInferredCapabilityForTurn,
  recordCapabilityContextInferredTelemetry,
} from "../../saas/deliverables/inferCapabilityContext.js";
import { resolvePptExportDefaultAppendFromMessages } from "../../saas/pptExportDefaultPolicy.js";
import {
  isToolAllowedForCapabilityCompletionMode,
  type CapabilityCompletionMode,
} from "../../saas/intent/capabilityCompletionMode.js";
import { shouldSuppressExecuteContinuation } from "../../saas/intent/turnInteractionMode.js";
import type { TurnInteractionMode } from "../../saas/intent/turnInteractionMode.js";
import {
  buildGoalQualityContractPrompt,
  type SessionGoalQualityContract,
} from "../../saas/constraints/goalQualityContract.js";
import {
  isToolAllowedByQualityContract,
  type TrustedExecutionScope,
} from "../../saas/constraints/capabilityScopeContract.js";
import {
  buildGoalToolPolicy,
  isToolAllowedByGoalToolPolicy,
  type GoalToolPolicy,
} from "../../saas/media/goalToolPolicy.js";
import {
  getOfficialMediaFallbackStateMachine,
  type OfficialMediaBudget,
} from "../../saas/media/officialMediaFallbackStateMachine.js";
import { buildOfficialMediaPlaceholderRecoveryMessage } from "../../saas/media/officialMediaPlaceholder.js";
import {
  buildQualityAcceptanceMeta as projectQualityAcceptanceMeta,
  type BoundedQualityShadowDiff,
  type QualityContractMode,
} from "../../saas/constraints/qualityCanaryPolicy.js";
import { buildMediaStrategyAppendPrompt } from "../../saas/media/mediaStrategyPrompt.js";
import { isCreativePreferGenActive } from "../../saas/media/creativeGenerateImageIntent.js";
import {
  runVisualAssetOrchestrator,
  shouldAutoResolveVisualAssets,
} from "../../saas/media/visualAssetPlatform/orchestrator.js";
import { resolveVapOrchestratorBudgetMs } from "../../saas/media/visualAssetPlatform/forceLadder.js";
import {
  buildManifestHintForModel,
  loadVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import {
  assessFactualPremise,
  buildFactualPremiseSystemAppend,
  factualPremiseGuardMode,
} from "../../saas/research/factualPremisePolicy.js";
import {
  resolveToolRecoveryProfile,
  toToolRecoveryOptions,
} from "../../saas/resolveToolRecoveryProfile.js";
import {
  extractDeliverableSessionUserGoal,
  goalHasPageCount,
  isAmbiguousFollowUpText,
  isShortClarificationAnswerText,
  resolveClarificationGoal,
} from "../../saas/deliverableSessionGoal.js";
import { isSocialMatrixGoal, resolveProfile } from "../../saas/deliverableCapabilityProfiles.js";
import { classifyUserActionBlocker } from "../../saas/userActionBlocker.js";
import {
  getUserActionBlockerTracker,
  isUserActionBlockerResetText,
} from "../../saas/userActionBlockerStreakTracker.js";
import {
  buildRetryAlternateWeakHint,
  classifyAskUserQuestionPolicy,
  buildUserActionRequiredNotice,
  profileRequiresDeliverableForGoal,
  resolveContinuationAction,
  resolvePreferenceAskUserBypass,
  shouldBypassOptionalMissingKeyBlocker,
} from "../../saas/taskContinuationPolicy.js";
import { shouldBlockSyntheticContinuation, evaluateSessionSyntheticBudget } from "../../saas/sessionSyntheticTurnBudget.js";
import { isDeliverableQualityReworkGoal } from "../../saas/taskState/detectGoalMutation.js";
import {
  detectClarificationNeeded,
  hasConcreteTopic,
  isClarificationGateEnabled,
  userMessageHasAttachments,
} from "../../saas/clarificationGate.js";
import {
  EXPENSIVE_INTENT_PPT_VS_FILES,
  assertExpensiveIntentAskPayload,
  detectExpensiveIntentConflict,
  expensiveIntentUserCopy,
  scanExpensiveIntentFuseFromMessages,
} from "../../saas/intent/expensiveIntentConflict.js";
import { isExpensiveIntentClarifyMode } from "../../saas/resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import {
  validateEngineDeliverables,
} from "../deliverables/validateDeliverablesEngine.js";
import {
  buildTurnValidationCacheKey,
  lookupTurnValidationCache,
  storeTurnValidationCache,
  type TurnValidationCacheEntry,
} from "../deliverables/engineDeliverableValidationCache.js";
import {
  advanceRepairStreak,
  buildRepairFastStopContinuePrompt,
  buildSdmGapKey,
  shouldFastStopRepairLoop,
} from "../../saas/deliverables/repairStreakTracker.js";
import {
  buildCircuitBreakerContinuePrompt,
  mergeRepairCircuitIntoManifest,
  recordSessionRepairGap,
} from "../../saas/deliverables/sessionRepairCircuitBreaker.js";
import {
  applyGroundTruthToValidation,
  reconcileDeliverableGroundTruth,
} from "../../saas/deliverables/deliverableGroundTruth.js";
import { slotSatisfiedByValidation } from "../../saas/deliverables/sdmSlotMatching.js";
import { stripLaunchContextAndAttachmentBlocks } from "../../saas/deliverables/deliverableChecklistAuthority.js";
import {
  buildAcceptanceRepairPrompt,
} from "../../saas/final-acceptance/finalAcceptance.js";
import {
  recordFinalAcceptanceEvent,
} from "../../saas/final-acceptance/finalAcceptanceTelemetry.js";
import {
  detectResearchReportTurn,
  detectContentFlywheelTurn,
  resolveProcessTemplateAppendFromMessages,
} from "../../saas/processTemplateExecutionPrompt.js";
// PD-SAAS-FORK: unified recovery budget + error classification
import {
  classifyErrorMessage,
  shouldFastFailClassification,
} from "../../saas/resilience/errorClassifier.js";
import { HardFailStreakTracker } from "../../saas/resilience/hardFailStreakTracker.js";
import { RecoveryBudget } from "../../saas/resilience/recoveryBudget.js";
import {
  advanceRepeatedToolFailureState,
  buildRepeatedToolFastStopMessage,
  createRepeatedToolFailureState,
  REPEATED_TOOL_FAST_STOP_THRESHOLD,
  shouldFastStopRepeatedToolFailure,
} from "../../saas/resilience/repeatedToolFailureFastStop.js";
import {
  DEFAULT_STAGE_RECOVERY_BUDGET,
  resolveStageRecoveryBudget,
} from "../../saas/resilience/stageRecoveryBudget.js";
import {
  hardFailThresholdForClassification,
  resolveTieredRecoveryLimits,
  worstHardFailFromToolResults,
} from "../../saas/resilience/recoveryPolicy.js";
import {
  recoveryAttemptDetail,
  recoveryExhaustedDetail,
  hintKeyToRecoveryCategory,
} from "../../saas/resilience/recoveryEvents.js";
import { SoftFetchRepeatTracker } from "../../saas/resilience/softFetchTracker.js";
import {
  buildVisualMediaPlaceholderRecoveryMessage,
  hasVisualMediaFailureInResults,
  isVisualMediaAcquisitionTool,
  recordVisualMediaFailuresForSession,
  shouldSkipCreativeVisualPlaceholderDegrade,
  shouldUseVisualPlaceholderDegrade,
  toolNameFromRepeatKey,
} from "../../saas/media/visualMediaDegradePolicy.js";
import { ToolFailureRepeatTracker } from "./toolFailureRepeatTracker.js";
import {
  NoProgressReadRepeatTracker,
  buildNoProgressReadNudgeMessage,
  buildNoProgressReadStopMessage,
} from "./noProgressReadRepeatTracker.js";
import {
  ProgressLedger,
  buildProgressLedgerNudgeMessage,
  buildProgressLedgerStopMessage,
} from "./progressLedger.js";
import {
  isCompletionGateEnabled,
  isGoalStopConditionsEnabled,
  isPlanLedgerEnabled,
  isProgressBudgetEnabled,
  isToolResultCompactionEnabled,
  isToolWatchdogEnabled,
  isVerificationLlmEnabled,
  isVerificationPassEnabled,
  isPptExportDefaultPolicyEnabled,
  officialMediaV2Mode,
  visualAssetPlatformMode,
  deliverableBriefContractMode,
  inferCapabilityContextMode,
} from "../../saas/resilience/stabilityFlags.js";
import { mapToolNameToStage, observeTaskStage } from "../../saas/resilience/taskStageBudget.js";
import { decideCompletionGate, isCapExhaustionReason } from "./completionGate.js";
import { buildPlanLedger, formatPlanLedgerHint } from "./planLedger.js";
import { buildTaskGoalContract } from "../../saas/taskState/taskGoalContract.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import {
  buildTaskArtifactDirPromptXml,
  type SessionTaskDirectory,
} from "../../saas/taskState/sessionTaskDirectory.js";
import {
  buildExpectedManifestFromSdm,
  buildContractSnapshotFromManifest,
  buildSlotBindingsFromManifest,
  type SlotBindingRecord,
  slimSessionManifestForWire,
  buildTaskGoalContractFromManifest,
  computeSdmProgress,
  extractBodyDeliverablePathsFromText,
  hasSdmIncompleteSlots,
  parseNumberedDeliverableList,
  reconcileSlotsWithVerifiedPaths,
  advanceSessionStage,
} from "../../saas/taskState/sessionDeliverableManifest.js";
import {
  finalizeDeliverableAcceptance,
} from "../deliverables/finalizeDeliverableAcceptance.js";
import { filterVerifiedForContractBinding } from "../../saas/deliverables/filterVerifiedForContractBinding.js";
import {
  decideWatchdogVerdict,
  maxBatchDeadlineMsForToolCalls,
  resolveToolWatchdogConfig,
} from "./toolWatchdog.js";
import {
  compactToolResults,
  resolveToolResultCompactionConfig,
} from "./toolResultCompaction.js";
import { buildVerificationDirective, decideVerificationPass } from "./verificationPass.js";
import { runVerificationReview } from "./verificationReviewer.js";
import {
  getCrossTurnToolFailureTracker,
  hashToolInput,
} from "./crossTurnToolFailureTracker.js";
import { contentToText } from "../../tool/protocol/result.js";
import { StageHintDedup } from "./stageHintDedup.js";
import { resolveResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";
import { recordRecoveryEvent } from "../../telemetry/recoveryTiming.js";
import { gateAssistantCompletionText } from "../../saas/deliverables/assistantCompletionGate.js";
import {
  deliverableSubagentBlockedMessage,
  isDeliverableSubagentToolName,
  shouldBlockDeliverableSubagent,
} from "../../saas/deliverables/shouldBlockDeliverableSubagent.js";
import { getTurnTrace } from "../../telemetry/turnTiming.js";
import {
  buildSideEffectConfirmationNotice,
  classifyAutoRecoverySideEffectRisk,
} from "../../saas/autoRecoverySideEffectPolicy.js";
import { turnStageHintText, type TurnStageHintKey } from "../turnStageHints.js";
import {
  createTurnWallClockState,
  isTurnWallClockExceeded,
} from "./turnWallClock.js";

const TOOL_EVENT_PUMP_INTERVAL_MS = 500;
const SUBAGENT_STATUS_HEARTBEAT_MS = 2_000;

type ActiveSubagentStatus = {
  subagentId: string;
  subagentType?: string;
  startedAtMs: number;
  lastHeartbeatMs: number;
  currentToolCallId?: string;
  currentToolName?: string;
};

export type AgentLoopInput = {
  sessionId: string;
  turnId: string;
  messages: CanonicalMessage[];
  maxTurns?: number;
  permissionMode?: PermissionMode;
  /** The user's actual permission preference before plan-mode override. */
  basePermissionMode?: PermissionMode;
  permissionRules?: Partial<PermissionRuleSet>;
  capabilityContext?: CapabilityBindingContext;
  /** PD-SAAS-FORK: P0-1 exact capability file-completion mode. */
  capabilityCompletionMode?: CapabilityCompletionMode;
  /** PD-SAAS-FORK: binary intent gate — suppress auto-continue on dialogue/clarify turns. */
  turnInteractionMode?: TurnInteractionMode;
  /** PD-SAAS-FORK P0-2: independently recovered quality constraints. */
  sessionGoalQualityContract?: SessionGoalQualityContract;
  qualityContractHash?: string;
  qualityContractMode?: QualityContractMode;
  qualityContractShadowDiff?: BoundedQualityShadowDiff;
  trustedExecutionScope?: TrustedExecutionScope;
  /** PD-SAAS-FORK P0-6: inherited hard tool policy for official media. */
  goalToolPolicy?: GoalToolPolicy;
  /** PD-SAAS-FORK P0-6: inherited cross-turn/subagent fallback budget. */
  officialMediaBudget?: OfficialMediaBudget;
  /** PD-SAAS-FORK P0-3: URLs authenticated from the current user input. */
  trustedUserExplicitUrls?: string[];
  /** PD-SAAS-FORK: per-turn UI language override for prompts and recovery copy. */
  promptLanguage?: "en" | "zh-CN";
  abortSignal?: AbortSignal;
  /** PD-SAAS-FORK: Goal Loop Phase 3 session deliverable manifest for this turn. */
  sessionDeliverableManifest?: SessionDeliverableManifest;
  /** PD-SAAS-FORK (STDA): system-assigned task artifact directory for this turn. */
  sessionTaskDirectory?: SessionTaskDirectory;
  /** PD-SAAS-FORK: all session-known task roots for write-path guard. */
  knownTaskArtifactDirs?: string[];
  onDurableMessage?: (message: CanonicalMessage) => void | Promise<void>;
  onTurnAcceptanceMeta?: (
    payload: Omit<
      AgentTurnAcceptanceMetaTranscriptEntry,
      "type" | "sessionId" | "turnId" | "sequence" | "createdAt" | "entryId"
    >,
  ) => void | Promise<void>;
  /** PD-SAAS-FORK (Goal Loop R9-2): persist reconciled SDM at turn end. */
  onSessionManifestUpdated?: (manifest: SessionDeliverableManifest) => void | Promise<void>;
};

function buildQualityAcceptanceMeta(input: AgentLoopInput): {
  qualityContractHashVersion?: 1;
  qualityContractHash?: string;
  qualityContractMode?: QualityContractMode;
  qualityContractShadowDiff?: BoundedQualityShadowDiff;
} {
  if (!input.qualityContractHash) return {};
  return {
    qualityContractHashVersion: 1,
    ...projectQualityAcceptanceMeta({
      qualityContractHash: input.qualityContractHash,
      effectiveMode: input.qualityContractMode ?? "off",
      shadowDiff: input.qualityContractShadowDiff,
    }),
  };
}

export type AgentLoopRunResult = {
  result: AgentTurnResult;
  messages: CanonicalMessage[];
};

export type AgentLoopSeedState = {
  readFileState?: PilotDeckReadFileStateMap;
  writeSnapshots?: PilotDeckWriteSnapshotMap;
};

function messageCarriesToolResult(message: CanonicalMessage): boolean {
  if (message.role !== "user") return false;
  return message.content.some(
    (block) => block.type === "tool_result" || block.type === "tool_result_reference",
  );
}

function findLastToolResultCarrierMessage(messages: CanonicalMessage[]): CanonicalMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && messageCarriesToolResult(message)) return message;
  }
  return undefined;
}

function toContinuationValidationResult(
  validation: Awaited<ReturnType<typeof validateEngineDeliverables>> | null | undefined,
) {
  if (!validation) return undefined;
  return {
    verified: validation.verified,
    missing: validation.missing,
    broken: validation.broken,
    acceptance: validation.acceptance,
    completionState: validation.completionState,
  };
}

export class AgentLoop {
  private readonly readFileState: PilotDeckReadFileStateMap;
  private readonly writeSnapshots: PilotDeckWriteSnapshotMap;

  constructor(
    private readonly config: AgentRuntimeConfig,
    private readonly dependencies: AgentRuntimeDependencies,
    seedState?: AgentLoopSeedState,
  ) {
    this.readFileState = cloneReadFileStateMap(seedState?.readFileState);
    this.writeSnapshots = cloneWriteSnapshotMap(seedState?.writeSnapshots);
  }

  snapshotFileState(): AgentLoopSeedState {
    return {
      readFileState: cloneReadFileStateMap(this.readFileState),
      writeSnapshots: cloneWriteSnapshotMap(this.writeSnapshots),
    };
  }

  // PD-SAAS-FORK: per-turn UI language wins over session-frozen config.
  private resolvePromptLanguage(input: AgentLoopInput): "en" | "zh-CN" {
    return input.promptLanguage ?? this.config.promptLanguage ?? "zh-CN";
  }

  async *run(input: AgentLoopInput): AsyncGenerator<AgentEvent, AgentLoopRunResult, unknown> {
    this.applyPermissionOverrides(input.permissionMode, input.permissionRules, input.basePermissionMode);
    const startedAt = this.now().toISOString();
    // PD-SAAS-FORK (Goal Loop P2 H5): per-turn wall-clock budget.
    const turnWallClock = createTurnWallClockState(Date.parse(startedAt));
    let messages = [...input.messages];
    const syntheticBudgetExhausted = (
      validation?: { verified?: string[]; missing?: string[]; broken?: string[] } | null,
    ) => shouldBlockSyntheticContinuation(messages, validation
      ? { verified: validation.verified ?? [], missing: validation.missing ?? [], broken: validation.broken ?? [] }
      : undefined);
    let turnCount = 1;
    // PD-SAAS-FORK (/goal Feature 2, flag-gated): clamp the turn budget with a user-stated
    // "N 轮内停" parsed into the goal contract (maxTurnsHint). Deterministic: it can only make a
    // turn end sooner (same safety property as the completion gate). Flag OFF => effectiveMaxTurns
    // === input.maxTurns (zero behavior change). Computed once from the initial session goal.
    let effectiveMaxTurns = input.maxTurns;
    if (isGoalStopConditionsEnabled()) {
      try {
        const stopGoal = extractDeliverableSessionUserGoal(messages);
        const stopHint = buildTaskGoalContract({
          userGoal: stopGoal,
          capabilitySlug: input.capabilityContext?.slug,
          majorCategory: input.capabilityContext?.majorCategory,
          completionMode: input.capabilityCompletionMode,
        }).maxTurnsHint;
        if (stopHint != null) {
          const clamped = effectiveMaxTurns != null
            ? Math.min(effectiveMaxTurns, stopHint)
            : stopHint;
          if (clamped !== effectiveMaxTurns) {
            recordStabilityEvent({
              event: "goal_stop_condition_applied",
              sessionId: input.sessionId,
              turnId: input.turnId,
              detail: {
                maxTurnsHint: stopHint,
                ...(input.maxTurns != null ? { originalMaxTurns: input.maxTurns } : {}),
              },
            });
            effectiveMaxTurns = clamped;
          }
        }
      } catch {
        // best-effort: never let the clamp computation break a turn
      }
    }
    let usage: CanonicalUsage = {};
    let permissionDenials: AgentPermissionDenial[] = [];
    let structuredOutput: unknown;
    let finalMessage: CanonicalMessage | undefined;
    const captureTurn = async (errored: boolean): Promise<void> => {
      const hook = this.dependencies.context?.captureTurn;
      if (!hook) return;
      try {
        await hook.call(this.dependencies.context, {
          sessionId: input.sessionId,
          turnId: input.turnId,
          messages,
          errored,
        });
      } catch {
        // captureTurn must never break a turn — context impl already
        // swallows; this catch is defensive.
      }
    };
    /**
     * Single-shot reactive truncate-and-retry guard. Set true after the loop
     * already truncated for a `prompt_too_long` once; subsequent PTL errors
     * fall through to fallback / fail (legacy single-shot semantics).
     */
    let hasAttemptedCompact = false;
    /**
     * Single-shot guard for `max_output_reached` retries. The loop bumps
     * `config.maxOutputTokens` (capped at `OUTPUT_TOKEN_RETRY_CEILING`) once
     * and retries; a second hit falls through to the continuation recovery.
     */
    let hasAttemptedOutputRetry = false;
    /**
     * Multi-turn continuation recovery counter for `max_output_reached`.
     * After the single-shot token bump, the loop injects a continuation
     * prompt and preserves the truncated assistant message so the model can
     * resume from where it was cut off — up to MAX_OUTPUT_RECOVERY_LIMIT
     * times.
     */
    const MAX_OUTPUT_RECOVERY_LIMIT = 3;
    let maxOutputRecoveryCount = 0;
    const MAX_JSON_SELF_CORRECT_RETRIES = 3;
    let jsonSelfCorrectCount = 0;
    const largeFileRepair = new LargeFileRepair();

    /**
     * Circuit breaker: consecutive turns where ALL tool calls are
     * `invalid_tool_input` errors. When the model is stuck in a loop
     * (e.g. qwen repeatedly emitting empty-param bash calls), terminate
     * early instead of burning tokens. Resets on any turn with at least
     * one successful tool call.
     */
    const MAX_CONSECUTIVE_ALL_INVALID_TURNS = 3;
    let consecutiveAllInvalidTurns = 0;
    let toolRecoveryTurnsUsed = 0;
    const MAX_TOOL_RECOVERY_TURNS = MAX_RECOVERY_ATTEMPTS;
    let autoContinueTurnsUsed = 0;
    let recentSoftFetchFailure = false;
    let softFetchRecoveryConsumedInTurn = false;
    let transientModelRetries = 0;
    const resilienceCfg = resolveResilienceConfig();
    const tierLimits = resolveTieredRecoveryLimits(resilienceCfg);
    const hardFailStreakTracker = new HardFailStreakTracker();
    const userActionBlockerTracker = getUserActionBlockerTracker(input.sessionId);
    const initialUserGoal = extractLatestNonSyntheticUserText(messages);
    // PD-SAAS-FORK (0717 P1): one bounded, text-free observation per turn.
    const factualPremiseMode = factualPremiseGuardMode();
    const factualPremiseAssessment = factualPremiseMode === "off"
      ? null
      : assessFactualPremise(initialUserGoal);
    if (factualPremiseAssessment) {
      recordStabilityEvent({
        event: "factual_premise_assessed",
        sessionId: input.sessionId,
        turnId: input.turnId,
        reason: factualPremiseAssessment.suggestedKind,
        detail: {
          mode: factualPremiseMode,
          taskMode: factualPremiseAssessment.taskMode,
          requiresSource: factualPremiseAssessment.requiresSource,
          recent: factualPremiseAssessment.recent,
          highImpact: factualPremiseAssessment.highImpact,
        },
      });
    }
    const firstTurnDeliverableBoost =
      resolveProfile(
        input.capabilityContext?.slug,
        input.capabilityContext?.majorCategory,
        initialUserGoal,
      ).id !== "default"
      && profileRequiresDeliverableForGoal(
        initialUserGoal,
        input.capabilityContext?.slug,
        input.capabilityContext?.majorCategory,
      );
    // PD-SAAS-FORK: profile+goal dual hit — extra recoverable budget on first turn (template/video/PPT).
    const recoveryBudget = new RecoveryBudget(
      tierLimits.recoverableMax + (firstTurnDeliverableBoost ? 2 : 0),
      tierLimits.hardFailMax,
    );
    let turnValidationCache: TurnValidationCacheEntry | null = null;
    let repeatedToolFailureState = createRepeatedToolFailureState();
    let stageToolRecoveryUsed = 0;
    let stageToolRecoveryStageId: string | undefined;
    if (isUserActionBlockerResetText(initialUserGoal)) {
      userActionBlockerTracker.reset();
    }
    const softFetchTracker = new SoftFetchRepeatTracker();
    const researchReportMode = messages.some((msg) => {
      if (msg.role !== "user") return false;
      return detectResearchReportTurn(textFromMessage(msg));
    });
    const contentFlywheelMode = !researchReportMode && messages.some((msg) => {
      if (msg.role !== "user") return false;
      return detectContentFlywheelTurn(textFromMessage(msg));
    });
    const toolFailureRepeatTracker = resilienceCfg.toolFailureRepeatGuard
      ? new ToolFailureRepeatTracker()
      : null;
    // PD-SAAS-FORK: always-on safety net for "successful but zero-progress" read loops
    // (e.g. read_file the same file 16x). Independent of toolFailureRepeatGuard because
    // those guards only fire on failures; this one is the only thing that catches a
    // model burning tokens on repeated *successful* reads. See noProgressReadRepeatTracker.
    const noProgressReadTracker = new NoProgressReadRepeatTracker();
    // PD-SAAS-FORK (P0-5, flag-gated): extends the read-loop guard to write/edit-same-content and
    // thinking loops. Reads stay with the tracker above so the two never double-count one loop.
    const progressLedger = new ProgressLedger();
    const stageHintDedup = new StageHintDedup();
    let repairStreakState = { lastNormalizedGap: null as string | null, streak: 0 };
    let hadRecentToolSuccess = false;
    let loopIteration = 0;

    const logRecoveryAttempt = (
      reason: string,
      detail: ReturnType<typeof recoveryAttemptDetail>,
      failedTools?: string[],
    ) => {
      recordRecoveryEvent({
        recordedAtMs: Date.now(),
        runId: input.turnId,
        sessionId: input.sessionId,
        turnId: input.turnId,
        reason,
        attempt: detail.attempt,
        maxAttempts: detail.maxAttempts,
        budgetRemaining: detail.budgetRemaining,
        loopIteration,
        failedTools,
        category: detail.category,
      });
    };

    const promptLanguage = this.resolvePromptLanguage(input);
    const maybeStageHint = function* (
      stage: TurnStageHintKey,
    ): Generator<AgentEvent, void, unknown> {
      if (!stageHintDedup.shouldEmit(stage)) return;
      yield {
        type: "turn_stage_hint",
        sessionId: input.sessionId,
        turnId: input.turnId,
        stage,
        title: turnStageHintText(stage, promptLanguage),
      };
    };

    const maybeStopForSideEffectConfirmation = async (args: {
      userGoal: string;
      assistantText?: string;
    }): Promise<{ result: AgentTurnResult; event: AgentEvent } | null> => {
      const risk = classifyAutoRecoverySideEffectRisk({
        userGoal: args.userGoal,
        assistantText: args.assistantText,
      });
      if (!risk.requiresUserConfirmation) return null;
      const alreadyAnswered = messages.some(
        (msg) => msg.role === "assistant"
          && !msg.metadata?.synthetic
          && !msg.metadata?.needsUserInput
          && msg.content.some(
            (block) => block.type === "text" && String(block.text ?? "").trim().length > 0,
          ),
      );
      if (alreadyAnswered) return null;
      const notice = buildSideEffectConfirmationNotice({
        reason: risk.reason,
        locale: promptLanguage,
      });
      const noticeBody = [
        notice.reason,
        "",
        ...notice.steps.map((step, index) => `${index + 1}. ${step}`),
      ].join("\n");
      const noticeMessage: CanonicalMessage = {
        role: "assistant",
        content: [{ type: "text", text: noticeBody }],
        metadata: {
          needsUserInput: true,
          purpose: "user_action_required",
          userActionNotice: notice,
        },
      };
      messages.push(noticeMessage);
      await input.onDurableMessage?.(noticeMessage);
      const result = this.createTurnResult(input, {
        type: "success",
        stopReason: "completed",
        usage,
        permissionDenials,
        turns: turnCount,
        startedAt,
        finalMessage: noticeMessage,
        structuredOutput,
      });
      return {
        result,
        event: { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result },
      };
    };

    const stickyInfo = this.dependencies.router.invalidateSticky?.(input.sessionId);
    let previousTier: string | undefined = stickyInfo?.previousTier;

    const continueWithSyntheticPrompt = async (decision: LargeFileRepairDecision): Promise<{
      type: "continue";
      event: AgentEvent;
    } | {
      type: "completed";
      result: AgentTurnResult;
    }> => {
      if (decision.type === "stop") {
        const turnUserGoal = extractDeliverableSessionUserGoal(messages);
        const locale = this.resolvePromptLanguage(input) === "zh-CN" ? "zh" : "en";
        if (
          largeFileRepair.hasWrittenFiles
          && userGoalImpliesDeliverable(turnUserGoal)
          && recoveryBudget.tryConsume("auto_continue")
        ) {
          autoContinueTurnsUsed += 1;
          const partialMessage = buildLargeFilePartialContinuePrompt(
            locale,
            [...largeFileRepair.writtenFilePaths],
          );
          messages.push(partialMessage);
          await input.onDurableMessage?.(partialMessage);
          return {
            type: "continue",
            event: {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "large_file_partial_continue",
            },
          };
        }
        const result = this.createTurnResult(input, {
          type: "error",
          stopReason: "tool_error",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          structuredOutput,
          errors: [agentError("agent_tool_error_loop", decision.reason)],
        });
        return { type: "completed", result };
      }
      if (decision.strip === "error_pair") {
        messages = stripTrailingErrorPair(messages);
      } else if (decision.strip === "assistant") {
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages = messages.slice(0, -1);
        }
      }
      messages.push({
        role: "user",
        content: [{ type: "text", text: decision.prompt }],
        metadata: { synthetic: true, purpose: decision.purpose },
      });
      if (this.config.maxOutputTokens !== undefined
        && this.config.maxOutputTokens < largeFileRepair.recommendedMaxOutputTokens) {
        this.config.maxOutputTokens = largeFileRepair.recommendedMaxOutputTokens;
      }
      return {
        type: "continue",
        event: {
          type: "turn_continued",
          sessionId: input.sessionId,
          turnId: input.turnId,
          reason: "model_error",
        },
      };
    };

    loop: while (true) {
      loopIteration += 1;
      if (isTurnWallClockExceeded(turnWallClock, Date.now())) {
        const stopFailureMsg = promptLanguage === "zh-CN"
          ? "本轮任务用时较长，已暂停。您可以继续，或简化要求后重试。"
          : "This turn reached the wall-clock limit. You can continue or simplify the request.";
        const result = this.createTurnResult(input, {
          type: "error",
          stopReason: "wall_clock_exceeded",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          errors: [agentError("agent_wall_clock_exceeded", stopFailureMsg)],
        });
        await captureTurn(true);
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }
      if (input.abortSignal?.aborted) {
        const result = this.createTurnResult(input, {
          type: "aborted",
          stopReason: "aborted_streaming",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      // PD-SAAS-FORK: pre-model clarification gate (10b) — blocks auto_continue paths
      if (loopIteration === 1 && isClarificationGateEnabled()) {
        // Include synthetic user turns — Turn Queue stamps accepted_input.synthetic=true.
        let latestUserRaw = "";
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i]?.role !== "user") continue;
          const t = textFromMessage(messages[i]).trim();
          if (t) {
            latestUserRaw = t;
            break;
          }
        }
        // Infra auto-resume / prior page-count preference must never re-block the turn
        // (Showcase guizang-ppt: task-resume + 「转为中文」looped on 页数问卷).
        const fuseState = scanExpensiveIntentFuseFromMessages(messages);
        const fuseAlreadyOpen = Boolean(
          fuseState.alreadyAskedFingerprint === EXPENSIVE_INTENT_PPT_VS_FILES
          || fuseState.fuseAlreadyHandled,
        );
        const skipClarificationGate =
          /<task-resume\b/i.test(latestUserRaw)
          || fuseAlreadyOpen
          || messages.some((msg) => {
            if (msg.role !== "assistant") return false;
            const purpose = (msg.metadata as { purpose?: string } | undefined)?.purpose;
            if (purpose !== "preference_elicitation") return false;
            const text = Array.isArray(msg.content)
              ? msg.content.map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text?: string }).text ?? "") : "")).join("")
              : "";
            return /页数|直接开始做|page count|just start/i.test(text);
          });
        const turnUserGoal = resolveClarificationGoal(messages);
        const expensiveMode = isExpensiveIntentClarifyMode();
        const expensiveConflict = detectExpensiveIntentConflict(turnUserGoal);
        if (skipClarificationGate && expensiveConflict && expensiveMode === "enforce" && !fuseAlreadyOpen) {
          recordStabilityEvent({
            event: "expensive_intent_conflict_fallback",
            sessionId: input.sessionId,
            turnId: input.turnId,
            detail: {
              fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
              mode: expensiveMode,
              ask: false,
              fallbackReason: "unsafe_context",
            },
          });
        }
        const clarification = skipClarificationGate
          ? { needed: false as const }
          : detectClarificationNeeded({
          userGoal: turnUserGoal,
          latestUserRaw,
          alreadyAskedFingerprint: fuseState.alreadyAskedFingerprint,
          fuseAlreadyHandled: fuseState.fuseAlreadyHandled,
          hasAttachments: userMessageHasAttachments(messages),
          capabilitySlug: input.capabilityContext?.slug,
          missingTopic: !hasConcreteTopic(turnUserGoal),
          missingPageCount: !goalHasPageCount(turnUserGoal),
          sessionManifest: input.sessionDeliverableManifest,
          promptLanguage,
        });
        if (
          !skipClarificationGate
          && !clarification.needed
          && expensiveMode === "shadow"
          && expensiveConflict
        ) {
          recordStabilityEvent({
            event: "expensive_intent_conflict_shadow",
            sessionId: input.sessionId,
            turnId: input.turnId,
            detail: {
              fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
              mode: "shadow",
              ask: false,
              stripped: false,
            },
          });
        }
        if (clarification.needed && clarification.question) {
          const expensiveCopy = expensiveIntentUserCopy(promptLanguage === "en" ? "en" : "zh-CN");
          const isExpensiveFuse = clarification.fingerprint === EXPENSIVE_INTENT_PPT_VS_FILES;
          const expensivePayloadOk = !isExpensiveFuse || assertExpensiveIntentAskPayload({
            kind: clarification.kind,
            hasDefaultOption: clarification.hasDefaultOption === true ? true : false,
            fingerprint: clarification.fingerprint,
            question: clarification.question,
            optionKeep: expensiveCopy.optionKeep,
            optionSwitch: expensiveCopy.optionSwitch,
          });
          if (!expensivePayloadOk) {
            recordStabilityEvent({
              event: "expensive_intent_conflict_fallback",
              sessionId: input.sessionId,
              turnId: input.turnId,
              detail: {
                fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
                mode: expensiveMode,
                ask: false,
                fallbackReason: "payload_invalid",
              },
            });
          } else {
          const noticeMessage: CanonicalMessage = {
            role: "assistant",
            content: [{ type: "text", text: clarification.question }],
            metadata: {
              needsUserInput: clarification.kind === "required",
              purpose: clarification.kind === "required" ? "user_action_required" : "preference_elicitation",
              elicitationKind: clarification.kind ?? "preference",
              hasDefaultOption: clarification.hasDefaultOption === true,
              ...(isExpensiveFuse
                ? { expensiveIntentFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES }
                : {}),
              userActionNotice: isExpensiveFuse
                ? {
                    title: expensiveCopy.title,
                    reason: expensiveCopy.reason,
                    steps: [
                      `1. ${expensiveCopy.optionKeep}`,
                      `2. ${expensiveCopy.optionSwitch}`,
                      expensiveCopy.hint,
                    ],
                    confirmedAttempts: 1,
                    locale: promptLanguage,
                  }
                : {
                title: promptLanguage === "zh-CN" ? "需要补充一点信息" : "A quick detail needed",
                reason: clarification.question,
                steps: promptLanguage === "zh-CN"
                  ? ["补充主题/附件，或回复「直接开始做」"]
                  : ["Add a topic or attachment, or say \"just start\""],
                confirmedAttempts: 1,
                locale: promptLanguage,
              },
            },
          };
          if (isExpensiveFuse) {
            recordStabilityEvent({
              event: "expensive_intent_conflict_asked",
              sessionId: input.sessionId,
              turnId: input.turnId,
              detail: {
                fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
                mode: expensiveMode,
                ask: true,
              },
            });
          }
          messages.push(noticeMessage);
          await input.onDurableMessage?.(noticeMessage);
          const blockedResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: noticeMessage,
            structuredOutput,
          });
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: blockedResult };
          return { result: blockedResult, messages };
          }
        }
      }

      const ctx = this.dependencies.context;
      if (ctx?.tryAutoCompact) {
        const trace = getTurnTrace(input.turnId);
        trace?.beginStage("turn.compact");
        try {
          const compact = await ctx.tryAutoCompact({
            messages,
            abortSignal: input.abortSignal,
            allowFullCompaction: false,
          });
          if (compact.type === "compacted") {
            messages = compact.messages;
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "auto_compact",
            };
          } else if (compact.type === "deferred") {
            yield* maybeStageHint("compact");
          }
          yield {
            type: "context_budget",
            sessionId: input.sessionId,
            turnId: input.turnId,
            snapshot: compact.snapshot,
          };
        } catch {
          // Auto-compaction must never block the model call — proceed with
          // the original messages if evaluation or summarization fails.
        }
        trace?.endStage("turn.compact");
        yield* this.drainEventBuffer();
      }

      // PD-SAAS-FORK (P2-E, flag-gated): fold OLD, large tool_result bodies to save tokens on long
      // turns (keeps the head + a "re-read on demand" marker). Runs after, and independently of, the
      // whole-message auto-compaction above. Flag OFF => never invoked (messages untouched).
      if (isToolResultCompactionEnabled()) {
        try {
          const compaction = compactToolResults(messages, resolveToolResultCompactionConfig());
          if (compaction.compactedBlocks > 0) {
            messages = compaction.messages;
            recordStabilityEvent({
              event: "tool_result_compacted",
              sessionId: input.sessionId,
              turnId: input.turnId,
              detail: { blocks: compaction.compactedBlocks, savedChars: compaction.savedChars },
            });
          }
        } catch {
          // compaction is best-effort; never block the model call
        }
      }

      if (!(this.dependencies.context instanceof NullContextRuntime)) {
        yield* maybeStageHint("memory_retrieve");
      }

      let request = await this.createModelRequest(messages, input);
      if (input.abortSignal?.aborted) {
        const result = this.createTurnResult(input, {
          type: "aborted",
          stopReason: "aborted_streaming",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }
      this.dispatchLifecycle(input, "PreModelRequest", {
        provider: request.provider,
        model: request.model,
      }).catch(() => {});
      yield* maybeStageHint("router_judge");
      yield {
        type: "model_request_started",
        sessionId: input.sessionId,
        turnId: input.turnId,
        model: request.model,
        provider: request.provider,
      };

      // Split decide + execute so we can insert a post-routing compact pass
      // when the routed model's context window is smaller than the agent's
      // default model (the window used by the first tryAutoCompact above).
      const decision = await this.dependencies.router.decide({
        request,
        sessionId: input.sessionId,
        isMainAgent: !this.config.isSubagent,
        metadata: {
          runId: input.turnId,
          ...(previousTier ? { previousTier } : {}),
          ...(input.capabilityContext?.slug ? { capabilitySlug: input.capabilityContext.slug } : {}),
        },
      });

      const getMaxCtx = this.dependencies.getModelMaxContextTokens;
      const agentMaxCtx = this.config.maxContextTokens;
      if (ctx?.tryAutoCompact && getMaxCtx && agentMaxCtx) {
        const routedMaxCtx = getMaxCtx(decision.provider, decision.model);
        if (routedMaxCtx !== undefined && routedMaxCtx < agentMaxCtx) {
          try {
            const recompact = await ctx.tryAutoCompact({
              messages,
              abortSignal: input.abortSignal,
              maxContextTokens: routedMaxCtx,
              allowFullCompaction: false,
            });
            if (recompact.type === "compacted") {
              messages = recompact.messages;
              request = await this.createModelRequest(messages, input);
              yield {
                type: "turn_continued",
                sessionId: input.sessionId,
                turnId: input.turnId,
                reason: "auto_compact",
              };
            }
            yield {
              type: "context_budget",
              sessionId: input.sessionId,
              turnId: input.turnId,
              snapshot: recompact.snapshot,
            };
          } catch {
            // Post-routing compaction must never block the model call.
          }
        }
      }

      const assembler = createModelMessageAssemblerState();
      const trace = getTurnTrace(input.turnId);
      trace?.beginStage("turn.model_ttfb");
      let markedFirstVisible = false;
      try {
        for await (const event of this.dependencies.router.execute(decision, request, {
          sessionId: input.sessionId,
          turnId: input.turnId,
          projectPath: this.config.cwd,
          abortSignal: input.abortSignal,
        })) {
          if (!markedFirstVisible) {
            if (event.type === "text_delta" || event.type === "tool_call_start" || event.type === "tool_call_delta") {
              trace?.endStage("turn.model_ttfb");
              trace?.markFirstVisible(event.type === "text_delta" ? "text" : "tool");
              markedFirstVisible = true;
            }
          }
          yield { type: "model_event", sessionId: input.sessionId, turnId: input.turnId, event };
          applyModelEventToAssembler(assembler, event);
          if (event.type === "error") {
            break;
          }
        }
        if (!stickyInfo?.orchestrating) previousTier = undefined;
      } catch (error) {
        trace?.endStage("turn.model_ttfb");
        if (input.abortSignal?.aborted) {
          const result = this.createTurnResult(input, {
            type: "aborted",
            stopReason: "aborted_streaming",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage,
          });
          await captureTurn(result.type === "error");
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
          return { result, messages };
        }
        const stopFailureMsg = error instanceof Error ? error.message : String(error);
        const modelClassified = classifyErrorMessage(stopFailureMsg);
        if (shouldFastFailClassification(modelClassified.classification)) {
          const streak = hardFailStreakTracker.record(modelClassified.classification);
          const threshold = hardFailThresholdForClassification(modelClassified.classification);
          if (streak >= threshold) {
            const exhausted = recoveryExhaustedDetail(
              recoveryBudget.recoverableMaxCount(),
              recoveryBudget.usedCount(),
              "model_error",
              hintKeyToRecoveryCategory(modelClassified.hintKey),
            );
            yield {
              type: "recovery_exhausted",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: exhausted.reason,
              category: exhausted.category,
              attempt: exhausted.attempt,
              maxAttempts: exhausted.maxAttempts,
              budgetRemaining: exhausted.budgetRemaining,
              layer: exhausted.layer,
            };
          }
        } else if (isInfrastructureDisconnectMessage(stopFailureMsg)) {
          const exhausted = recoveryExhaustedDetail(
            recoveryBudget.recoverableMaxCount(),
            recoveryBudget.usedCount(),
            "model_error",
            hintKeyToRecoveryCategory("gateway"),
          );
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: exhausted.reason,
            category: exhausted.category,
            attempt: exhausted.attempt,
            maxAttempts: exhausted.maxAttempts,
            budgetRemaining: recoveryBudget.remaining(),
            layer: exhausted.layer,
          };
        } else if (isTransientModelErrorMessage(stopFailureMsg)) {
          const consumed = recoveryBudget.tryConsume("model_error");
          if (consumed) {
            transientModelRetries += 1;
            const detail = recoveryAttemptDetail(
              consumed,
              modelClassified.classification === "transient" ? "network" : "model",
            );
            logRecoveryAttempt("model_error", detail);
            yield {
              type: "recovery_attempt",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "model_error",
              attempt: detail.attempt,
              maxAttempts: detail.maxAttempts,
              category: detail.category,
              budgetRemaining: detail.budgetRemaining,
              layer: detail.layer,
            };
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "model_error",
            };
            continue loop;
          }
          if (recoveryBudget.isExhausted()) {
            const exhausted = recoveryExhaustedDetail(
              recoveryBudget.maxCount(),
              recoveryBudget.usedCount(),
              "model_error",
              "network",
            );
            yield {
              type: "recovery_exhausted",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: exhausted.reason,
              category: exhausted.category,
              attempt: exhausted.attempt,
              maxAttempts: exhausted.maxAttempts,
              budgetRemaining: exhausted.budgetRemaining,
              layer: exhausted.layer,
            };
          }
        }
        await this.dispatchLifecycle(input, "StopFailure", { error: stopFailureMsg });
        yield { type: "stop_failure", sessionId: input.sessionId, turnId: input.turnId, error: stopFailureMsg };
        const result = this.createTurnResult(input, {
          type: "error",
          stopReason: "model_error",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          errors: [agentError("agent_model_error", stopFailureMsg)],
        });
        yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      if (input.abortSignal?.aborted) {
        const result = this.createTurnResult(input, {
          type: "aborted",
          stopReason: "aborted_streaming",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      const assembled = assembleAssistantMessage(assembler);
      usage = mergeUsage(usage, assembled.usage);
      finalMessage = assembled.message;
      messages.push(assembled.message);
      yield { type: "assistant_message", sessionId: input.sessionId, turnId: input.turnId, message: assembled.message };
      await input.onDurableMessage?.(assembled.message);

      const toolCalls = collectToolCalls(assembled.message);
      if (assembled.error) {
        if (toolCalls.length > 0) {
          const projected = projectToolResults(
            toolCalls.map((call) => createMissingToolResult(call, this.now, "Model error interrupted tool execution.")),
          );
          messages.push(...projected);
          yield { type: "tool_results_projected", sessionId: input.sessionId, turnId: input.turnId, message: projected[0]! };
          for (const msg of projected) {
            await input.onDurableMessage?.(msg);
          }
        }

        if (
          this.config.jsonSelfCorrect &&
          assembled.error.code === "invalid_tool_arguments" &&
          jsonSelfCorrectCount < MAX_JSON_SELF_CORRECT_RETRIES
        ) {
          jsonSelfCorrectCount++;
          messages.push({
            role: "user",
            content: [{
              type: "text",
              text: "Your previous tool call contained invalid JSON in the arguments and could not be parsed. "
                + "Please retry with valid JSON. Common issues: missing quotes around keys/values, "
                + "trailing commas, unescaped special characters in strings.",
            }],
            metadata: { synthetic: true, purpose: "json_self_correct" },
          });
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "model_error",
          };
          continue;
        }

        // Reactive recovery: ask context runtime if it can recover from the
        // model error (e.g. `prompt_too_long` → truncate head and retry).
        // Single-shot per turn — see legacy parity §3.1 #8.
        const reactive = await this.tryReactiveRecover(input, assembled.error, messages, hasAttemptedCompact);
        if (reactive && reactive.type === "truncate_head_and_retry") {
          // Drop the failed assistant message + any synthetic tool_result we just
          // pushed so the retry doesn't carry a half-baked tool_call. Then apply
          // keepRatio so the cap is computed against valid history only.
          messages = stripTrailingErrorPair(messages);
          messages = truncateHeadKeepRatio(messages, reactive.keepRatio);
          hasAttemptedCompact = true;
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "model_error",
          };
          continue;
        }

        if (reactive && reactive.type === "strip_images_and_retry") {
          messages = stripTrailingErrorPair(messages);
          messages = stripImagesFromMessages(messages);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "model_error",
          };
          continue;
        }

        // `max_output_reached`: output token limit hit (or truncated JSON
        // reclassified from invalid_tool_arguments when finishReason=length).
        //
        // Phase A — single-shot token doubling: strip the partial response
        // and retry with 2x maxOutputTokens (capped at CEILING).
        // Phase B — multi-turn continuation: keep the truncated assistant
        // message in context and inject a "resume" prompt so the model can
        // pick up where it was cut off (up to MAX_OUTPUT_RECOVERY_LIMIT).
        // Phase C — exhausted: fall through to error surfacing.
        if (assembled.error.code === "max_output_reached") {
          // Phase A
          if (!hasAttemptedOutputRetry) {
            messages = stripTrailingErrorPair(messages);
            const previous = this.config.maxOutputTokens ?? OUTPUT_TOKEN_RETRY_DEFAULT;
            this.config.maxOutputTokens = Math.min(previous * 2, OUTPUT_TOKEN_RETRY_CEILING);
            hasAttemptedOutputRetry = true;
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "model_error",
            };
            continue;
          }

          // Phase B
          if (maxOutputRecoveryCount < MAX_OUTPUT_RECOVERY_LIMIT) {
            maxOutputRecoveryCount++;
            messages.push({
              role: "user",
              content: [{
                type: "text",
                text: "Output token limit hit. Resume directly — no apology, no recap of what you were doing. "
                  + "Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.",
              }],
              metadata: { synthetic: true, purpose: "max_output_recovery" },
            });
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "model_error",
            };
            continue;
          }
          // Phase C: fall through to error surfacing
        }

        // Cross-provider fallback decisions are now owned by RouterRuntime
        // (see `runFallbackChain` + `zeroUsageRetry`); the loop only
        // classifies the surfaced error and falls through.
        const classified = classifyModelError(assembled.error);
        await this.dispatchLifecycle(input, "StopFailure", { error: assembled.error });
        yield { type: "stop_failure", sessionId: input.sessionId, turnId: input.turnId, error: typeof assembled.error === "string" ? assembled.error : JSON.stringify(assembled.error) };
        const result = this.createTurnResult(input, {
          type: "error",
          stopReason: classified.stopReason,
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          errors: [classified.error],
        });
        yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      if (toolCalls.length === 0) {
        const largeFileDecision = largeFileRepair.onNoToolCalls();
        if (largeFileDecision) {
          const continued = await continueWithSyntheticPrompt(largeFileDecision);
          if (continued.type === "completed") {
            yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: continued.result.errors![0]! };
            await captureTurn(continued.result.type === "error");
            yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: continued.result };
            return { result: continued.result, messages };
          }
          yield continued.event;
          continue;
        }

        const stopHooks = await this.dispatchLifecycle(input, "Stop", {
          stopHookActive: false,
          lastAssistantMessage: textFromMessage(assembled.message),
        });
        yield { type: "stop_requested", sessionId: input.sessionId, turnId: input.turnId };
        messages.push(...stopHooks.messages);
        const stopBlock = findLifecycleBlock(stopHooks);
        if (stopBlock) {
          const result = this.createTurnResult(input, {
            type: "error",
            stopReason: "tool_error",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage,
            structuredOutput,
            errors: [agentError("agent_unsupported_feature", stopBlock.reason)],
          });
          yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
          await captureTurn(result.type === "error");
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
          return { result, messages };
        }

        const assistantText = textFromMessage(assembled.message);
        const turnUserGoal = extractDeliverableSessionUserGoal(messages);
        // PD-SAAS-FORK: block auto_continue when user must supply Key/attachment (三确同错)
        const assistantBlocker = classifyUserActionBlocker({ assistantText });
        const assistantBlockerStreak = assistantBlocker
          ? userActionBlockerTracker.recordForContext(assistantBlocker.fingerprint, {
            userGoal: turnUserGoal,
            capabilitySlug: input.capabilityContext?.slug,
            turnBoundary: input.turnId,
          })
          : 0;
        let assistantContinuation = resolveContinuationAction({
          userGoal: turnUserGoal,
          assistantText,
          completionMode: input.capabilityCompletionMode,
          turnInteractionMode: input.turnInteractionMode,
          blocker: assistantBlocker,
          blockerStreak: assistantBlockerStreak,
          hadRecentToolSuccess,
          planningOrSetupStop: false,
          autoRecoveryContinueEnabled: resilienceCfg.enabled,
          directStartRequested: userGoalRequestsDirectStart(turnUserGoal),
          missingIrreplaceableInput: Boolean(assistantBlocker),
          capabilitySlug: input.capabilityContext?.slug,
          majorCategory: input.capabilityContext?.majorCategory,
          syntheticBudgetExhausted: syntheticBudgetExhausted(),
        });
        if (assistantContinuation === "user_action_required" && assistantBlocker) {
          if (!shouldInjectUserActionRequiredNotice(assistantBlocker, turnUserGoal)) {
            assistantContinuation = "retry_alternate";
          }
        }
        if (assistantContinuation === "user_action_required" && assistantBlocker) {
          const notice = buildUserActionRequiredNotice({
            blocker: assistantBlocker,
            confirmedAttempts: assistantBlockerStreak,
            locale: promptLanguage,
            userGoal: turnUserGoal,
          });
          const noticeBody = [
            notice.reason,
            "",
            ...notice.steps.map((step, index) => `${index + 1}. ${step}`),
          ].join("\n");
          const noticeMessage: CanonicalMessage = {
            role: "assistant",
            content: [{ type: "text", text: noticeBody }],
            metadata: {
              needsUserInput: true,
              purpose: "user_action_required",
              userActionNotice: notice,
            },
          };
          messages.push(noticeMessage);
          await input.onDurableMessage?.(noticeMessage);
          const blockedResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: noticeMessage,
            structuredOutput,
          });
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: blockedResult };
          return { result: blockedResult, messages };
        }
        if (assistantContinuation === "user_action_required") {
          const sideEffectBlocked = await maybeStopForSideEffectConfirmation({
            userGoal: turnUserGoal,
            assistantText,
          });
          if (sideEffectBlocked) {
            yield sideEffectBlocked.event;
            return { result: sideEffectBlocked.result, messages };
          }
        }
        if (assistantContinuation === "retry_alternate") {
          const consumed = recoveryBudget.tryConsume("auto_continue");
          if (consumed) {
            autoContinueTurnsUsed += 1;
            const detail = recoveryAttemptDetail(consumed, "tool");
            logRecoveryAttempt("auto_continue", detail);
            yield {
              type: "recovery_attempt",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "retry_alternate",
              attempt: detail.attempt,
              maxAttempts: detail.maxAttempts,
              category: detail.category,
              budgetRemaining: detail.budgetRemaining,
              layer: detail.layer,
            };
            const weakHint = buildRetryAlternateWeakHint({
              streak: assistantBlockerStreak,
              locale: promptLanguage,
            });
            const retryAlternateMessage: CanonicalMessage = {
              role: "user",
              content: [{
                type: "text",
                text: [
                  weakHint,
                  promptLanguage === "zh-CN"
                    ? "不要暂停等待用户。请换一种可行路径继续完成原始任务；只有缺少 API Key、附件、权限、欠费、验证码等不可替代输入时才正式阻断。"
                    : "Do not pause for the user. Try a different viable path and continue the original task; stop only for irreplaceable input such as API keys, attachments, permissions, billing, or captcha.",
                ].join("\n"),
              }],
              metadata: {
                synthetic: true,
                purpose: "auto_continue",
                continuationAction: "retry_alternate",
              },
            };
            messages.push(retryAlternateMessage);
            await input.onDurableMessage?.(retryAlternateMessage);
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "auto_continue",
            };
            continue;
          }
        }
        const incompleteDeliverableStop = !resilienceCfg.deliverableValidation
          && assistantContinuation !== "user_action_required"
          && shouldAutoContinueAfterIncompleteDeliverableStop(
            assistantText,
            { hadRecentToolSuccess, userGoalText: turnUserGoal },
          );
        const latestUserText = extractLatestNonSyntheticUserText(messages);
        const prematureStopReasonRaw = shouldAutoContinueAfterAssistantText(assistantText, {
          strict: resilienceCfg.autoContinueStrict,
          hadRecentToolSuccess,
          latestUserText,
          userGoalText: turnUserGoal,
        })
          ? "assistant_gave_up" as const
          : incompleteDeliverableStop
            ? "assistant_gave_up" as const
            : recentSoftFetchFailure && !looksLikeTaskDelivered(assistantText, { userGoal: turnUserGoal })
              ? "soft_fetch_failure" as const
              : null;
        let prematureStopReason = prematureStopReasonRaw;
        if (prematureStopReason) {
          const autoContinueAction = resolveContinuationAction({
            userGoal: turnUserGoal,
            assistantText,
            completionMode: input.capabilityCompletionMode,
            blocker: assistantBlocker,
            blockerStreak: assistantBlockerStreak,
            hadRecentToolSuccess,
            planningOrSetupStop: incompleteDeliverableStop,
            autoRecoveryContinueEnabled: resilienceCfg.enabled,
            directStartRequested: userGoalRequestsDirectStart(turnUserGoal),
            missingIrreplaceableInput: Boolean(assistantBlocker),
            capabilitySlug: input.capabilityContext?.slug,
            majorCategory: input.capabilityContext?.majorCategory,
            sessionManifest: input.sessionDeliverableManifest,
            syntheticBudgetExhausted: syntheticBudgetExhausted(),
          });
          if (autoContinueAction !== "auto_continue_engine") {
            prematureStopReason = null;
          }
        }
        if (prematureStopReason) {
          const duplicateSoftFetchAutoContinue =
            !incompleteDeliverableStop
            && !userGoalRequestsDirectStart(turnUserGoal)
            && softFetchRecoveryConsumedInTurn
            && (
              prematureStopReason === "soft_fetch_failure"
              || (prematureStopReason === "assistant_gave_up" && recentSoftFetchFailure)
            );
          if (!duplicateSoftFetchAutoContinue) {
          const consumed = recoveryBudget.tryConsume("auto_continue");
          if (!consumed) {
            if (recoveryBudget.isExhausted()) {
              const exhausted = recoveryExhaustedDetail(
                recoveryBudget.maxCount(),
                recoveryBudget.usedCount(),
                "auto_continue",
                "tool",
              );
              yield {
                type: "recovery_exhausted",
                sessionId: input.sessionId,
                turnId: input.turnId,
                reason: exhausted.reason,
                category: exhausted.category,
                attempt: exhausted.attempt,
                maxAttempts: exhausted.maxAttempts,
                budgetRemaining: exhausted.budgetRemaining,
                layer: exhausted.layer,
              };
            }
          } else {
          autoContinueTurnsUsed += 1;
          recentSoftFetchFailure = false;
          const detail = recoveryAttemptDetail(consumed, "tool");
          logRecoveryAttempt("auto_continue", detail);
          yield {
            type: "recovery_attempt",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "auto_continue",
            attempt: detail.attempt,
            maxAttempts: detail.maxAttempts,
            category: detail.category,
            budgetRemaining: detail.budgetRemaining,
            layer: detail.layer,
          };
          const locale = this.resolvePromptLanguage(input) === "zh-CN" ? "zh" : "en";
          if (prematureStopReason === "assistant_gave_up") {
            stripTrailingAssistantTextBubble(messages);
          }
          const recoveryMessage = buildPrematureStopRecoveryUserMessage(locale, prematureStopReason);
          messages.push(recoveryMessage);
          await input.onDurableMessage?.(recoveryMessage);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "auto_continue",
          };
          continue;
          }
          }
        }

        // PD-SAAS-FORK: final-only acceptance gate before user-visible completion.
        let engineValidation: Awaited<ReturnType<typeof validateEngineDeliverables>> | null = null;
        const deliverableTask =
          userGoalImpliesDeliverable(turnUserGoal)
          || (input.sessionDeliverableManifest?.slots?.length ?? 0) > 0;
        if (resilienceCfg.deliverableValidation && deliverableTask) {
          const validationCacheKey = buildTurnValidationCacheKey({
            messages,
            sessionManifest: input.sessionDeliverableManifest,
          });
          const cachedValidation = lookupTurnValidationCache(turnValidationCache, validationCacheKey);
          if (cachedValidation) {
            engineValidation = cachedValidation;
            recordStabilityEvent({
              event: "deliverable_validate_cache_hit",
              sessionId: input.sessionId,
              turnId: input.turnId,
              detail: { hit: 1 },
            });
          } else {
            yield {
              type: "acceptance_started",
              sessionId: input.sessionId,
              turnId: input.turnId,
            };
            engineValidation = await validateEngineDeliverables({
              cwd: this.config.cwd,
              messages,
              userGoal: turnUserGoal,
              capabilitySlug: input.capabilityContext?.slug,
              majorCategory: input.capabilityContext?.majorCategory,
              sessionManifest: input.sessionDeliverableManifest,
              completionMode: input.capabilityCompletionMode,
              qualityContract: input.sessionGoalQualityContract,
              qualityContractHash: input.qualityContractHash,
              officialMediaAttemptState:
                this.resolveOfficialMediaBudget(input)?.snapshot(),
            });
            if (engineValidation) {
              turnValidationCache = storeTurnValidationCache(validationCacheKey, engineValidation);
            }
          }
          if (engineValidation) {
            recordFinalAcceptanceEvent({
              sessionId: input.sessionId,
              turnId: input.turnId,
              result: {
                status: engineValidation.acceptance,
                expected: {},
                expectedManifest: engineValidation.expectedManifest,
                verifiedPaths: engineValidation.verified,
                missingPaths: engineValidation.missing,
                brokenPaths: engineValidation.broken,
                failures: engineValidation.failures,
                continuePrompt: engineValidation.continuePrompt ?? "",
              },
              budgetRemaining: recoveryBudget.remaining(),
            });
            yield {
              type: "acceptance_completed",
              sessionId: input.sessionId,
              turnId: input.turnId,
              status: engineValidation.acceptance,
              failureReasons: engineValidation.failures.map((failure) => failure.reason),
            };
          }
        }
        let deliverableAction = resolveContinuationAction({
          userGoal: turnUserGoal,
          assistantText,
          completionMode: input.capabilityCompletionMode,
          turnInteractionMode: input.turnInteractionMode,
          blocker: assistantBlocker,
          blockerStreak: assistantBlockerStreak,
          validationResult: toContinuationValidationResult(engineValidation),
          planningOrSetupStop: incompleteDeliverableStop,
          autoRecoveryContinueEnabled: resilienceCfg.enabled,
          directStartRequested: userGoalRequestsDirectStart(turnUserGoal),
          missingIrreplaceableInput: Boolean(assistantBlocker),
          capabilitySlug: input.capabilityContext?.slug,
          majorCategory: input.capabilityContext?.majorCategory,
          sessionManifest: input.sessionDeliverableManifest,
          syntheticBudgetExhausted: syntheticBudgetExhausted(engineValidation),
        });
        let finalCircuitBreakerTripped = Boolean(
          input.sessionDeliverableManifest?.repairCircuit?.tripped,
        );
        let finalRecoveryBudgetExhausted = false;
        if (syntheticBudgetExhausted(engineValidation)) {
          finalRecoveryBudgetExhausted = true;
          const synthEval = evaluateSessionSyntheticBudget(
            messages,
            toContinuationValidationResult(engineValidation) ?? null,
          );
          recordStabilityEvent({
            event: "session_synthetic_budget_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            detail: {
              streak: synthEval.streak,
              limit: synthEval.limit,
              verified: synthEval.currentVerified,
            },
          });
        }
        // PD-SAAS-FORK (P0-6, flag-gated): completion gate. For a profile+goal double-matched
        // deliverable task whose contract is unmet, confirm the engine takeover and enforce the
        // third (no-progress / B) cap. Flag OFF => inert (no production behavior change). The gate
        // can only CONFIRM the existing takeover or VETO it when a budget is exhausted, so enabling
        // it can only make a stuck turn end sooner — never loop longer.
        let completionGateVeto = false;
        if (
          isCompletionGateEnabled()
          && (deliverableAction === "auto_continue_engine" || deliverableAction === "deliverable_repair")
        ) {
          const gateProfile = resolveProfile(
            input.capabilityContext?.slug,
            input.capabilityContext?.majorCategory,
            turnUserGoal,
          );
          const gate = decideCompletionGate({
            flagEnabled: true,
            goalImpliesDeliverable: userGoalImpliesDeliverable(turnUserGoal),
            profileRequiresDeliverable: gateProfile.id !== "default",
            numberedDeliverableSteps: parseNumberedDeliverableList(turnUserGoal).length,
            acceptanceUnmet: Boolean(
              engineValidation
              && (
                engineValidation.acceptance === "needs_repair"
                || engineValidation.missing.length > 0
                || engineValidation.broken.length > 0
              ),
            ),
            autoRecoveryEnabled: resilienceCfg.enabled,
            recoveryBudgetRemaining: recoveryBudget.remaining(),
            progressBudgetTerminal: progressLedger.terminalReached,
            turnsRemaining: effectiveMaxTurns
              ? Math.max(0, effectiveMaxTurns - turnCount)
              : Number.MAX_SAFE_INTEGER,
          });
          if (gate.takeover) {
            recordStabilityEvent({
              event: "completion_gate_continue",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: deliverableAction,
            });
          } else if (isCapExhaustionReason(gate.reason)) {
            // A budget cap is hit -> stop repairing and let the turn complete (third cap).
            completionGateVeto = true;
            finalRecoveryBudgetExhausted = true;
            recordStabilityEvent({
              event: "completion_gate_continue",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: gate.reason,
              detail: { vetoed: true },
            });
          }
        }
        // PD-SAAS-FORK (P1-A, flag-gated): plan ledger. Derive an ordered step list from the goal
        // contract and compute remaining steps from the verified paths. Purely observational — it
        // records telemetry and produces a one-line hint appended to the repair prompt below. Flag
        // OFF => never built (zero behavior change).
        let planLedgerHint: string | undefined;
        if (
          isPlanLedgerEnabled()
          && engineValidation
          && (deliverableAction === "auto_continue_engine" || deliverableAction === "deliverable_repair")
        ) {
          try {
            const ledger = buildPlanLedger(
              input.sessionDeliverableManifest
                ? buildTaskGoalContractFromManifest(input.sessionDeliverableManifest)
                : buildTaskGoalContract({
                  userGoal: turnUserGoal,
                  capabilitySlug: input.capabilityContext?.slug,
                  majorCategory: input.capabilityContext?.majorCategory,
                  completionMode: input.capabilityCompletionMode,
                }),
              engineValidation.verified,
            );
            if (ledger.total > 0) {
              planLedgerHint = formatPlanLedgerHint(ledger);
              recordStabilityEvent({
                event: "plan_ledger_step",
                sessionId: input.sessionId,
                turnId: input.turnId,
                reason: deliverableAction,
                detail: { total: ledger.total, done: ledger.done, remaining: ledger.remaining.length },
              });
            }
          } catch {
            // ledger is best-effort; never let it affect the turn
          }
        }
        // PD-SAAS-FORK (P2, flag-gated, scaffold): verification-pass decision. When acceptance PASSED
        // for a profile+goal deliverable task, decide whether an independent second look is warranted
        // and record the decision (telemetry only — the verifier sub-agent itself is opt-in future
        // work). Flag OFF => never evaluated.
        if (
          isVerificationPassEnabled()
          && engineValidation
          && engineValidation.acceptance === "passed"
          && userGoalImpliesDeliverable(turnUserGoal)
        ) {
          const verifyProfile = resolveProfile(
            input.capabilityContext?.slug,
            input.capabilityContext?.majorCategory,
            turnUserGoal,
          );
          // PD-SAAS-FORK (/goal Feature 1x2 bridge): a user-stated NL completion condition is a
          // third "verifiable" signal, so a goal with only assertions (no file/count contract) can
          // still warrant a second look. Contract build is cheap & deterministic.
          const verifyContract = buildTaskGoalContract({
            userGoal: turnUserGoal,
            capabilitySlug: input.capabilityContext?.slug,
            majorCategory: input.capabilityContext?.majorCategory,
            completionMode: input.capabilityCompletionMode,
          });
          const verifyAssertions = verifyContract.completionAssertions ?? [];
          const verifyPlan = decideVerificationPass({
            flagEnabled: true,
            goalImpliesDeliverable: true,
            profileRequiresDeliverable: verifyProfile.id !== "default",
            acceptancePassed: true,
            hasRequiredFiles: engineValidation.verified.length > 0,
            hasCountExpectations: Boolean(engineValidation.expectedManifest),
            hasCompletionAssertions: verifyAssertions.length > 0,
            budgetRemaining: recoveryBudget.remaining(),
          });
          if (verifyPlan.shouldVerify) {
            recordStabilityEvent({
              event: "verification_pass_run",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: verifyPlan.reason,
              detail: { checks: verifyPlan.checks.join(",") },
            });
            // PD-SAAS-FORK (/goal Feature 1, flag-gated, OBSERVE-ONLY): when the verification LLM
            // flag is ON and budget remains, run ONE short, fail-open model call to independently
            // review the delivered result. It records ONLY the verdict/reasonCount/checks as
            // telemetry (NEVER raw paths/reasons), and takes NO corrective action and surfaces NO
            // user bubble. Any error/timeout/parse failure fails open to "pass".
            if (isVerificationLlmEnabled() && recoveryBudget.remaining() > 0) {
              const directive = buildVerificationDirective(verifyPlan, turnUserGoal, verifyAssertions);
              const reviewPrompt = [
                directive,
                "",
                "本回合助手的结论（待核验，勿轻信此前“已完成”表述）：",
                String(assistantText ?? "").slice(0, 2000),
                "",
                "已通过验收的文件清单：",
                ...engineValidation.verified.slice(0, 20).map((verifiedPath) => `- ${verifiedPath}`),
              ].join("\n");
              const review = await runVerificationReview({
                directive: reviewPrompt,
                signal: input.abortSignal,
                callModel: async (promptText, signal) => {
                  const reviewRequest: CanonicalModelRequest = {
                    provider: this.config.provider,
                    model: this.config.model,
                    messages: [{ role: "user", content: [{ type: "text", text: promptText }] }],
                    maxOutputTokens: 512,
                    temperature: 0,
                    thinking: { enabled: false },
                    stream: true,
                  };
                  let accumulated = "";
                  for await (const event of this.dependencies.router.stream(reviewRequest, {
                    sessionId: input.sessionId,
                    turnId: input.turnId,
                    projectPath: this.config.cwd,
                    abortSignal: signal,
                    isMainAgent: false,
                  })) {
                    if (event.type === "text_delta") accumulated += event.text;
                  }
                  return accumulated;
                },
              });
              recordStabilityEvent({
                event: "verification_llm_verdict",
                sessionId: input.sessionId,
                turnId: input.turnId,
                reason: review.outcome,
                detail: {
                  verdict: review.verdict,
                  reasonCount: review.reasons.length,
                  checks: verifyPlan.checks.join(","),
                },
              });
              // PD-SAAS-FORK Goal Loop Phase 4: needs_repair closes the verifier loop → engine repair.
              if (review.verdict === "needs_repair" && engineValidation) {
                recordStabilityEvent({
                  event: "verification_repair_triggered",
                  sessionId: input.sessionId,
                  turnId: input.turnId,
                  reason: "model_needs_repair",
                  detail: { reasonCount: review.reasons.length },
                });
                engineValidation = {
                  ...engineValidation,
                  acceptance: "failed",
                  missing: engineValidation.missing.length > 0
                    ? engineValidation.missing
                    : ["__verifier_needs_repair__"],
                };
                deliverableAction = "deliverable_repair";
              }
            }
          }
        }
        if (engineValidation) {
          let sdmForMeta = input.sessionDeliverableManifest;
          if (sdmForMeta) {
            const bodyPaths = extractBodyDeliverablePathsFromText(String(assistantText ?? ""));
            // PD-SAAS-FORK P0-A′: scope = taskArtifactDir; never fall back to unscoped verified (cross-task pollution).
            const bindingScopeDir = input.sessionTaskDirectory?.taskArtifactDir
              ?? sdmForMeta.taskArtifactDir
              ?? null;
            const filteredVerified = filterVerifiedForContractBinding(
              engineValidation.verified,
              { scopeDir: bindingScopeDir ?? undefined },
            );
            const verifiedForBinding = filteredVerified;
            const reconciled = reconcileSlotsWithVerifiedPaths(
              sdmForMeta,
              verifiedForBinding,
              bodyPaths,
            );
            if (reconciled.changed) {
              sdmForMeta = reconciled.manifest;
              input.sessionDeliverableManifest = reconciled.manifest;
              turnValidationCache = null;
              await input.onSessionManifestUpdated?.(reconciled.manifest);
              yield {
                type: "session_manifest_updated",
                sessionId: input.sessionId,
                turnId: input.turnId,
                sessionManifest: slimSessionManifestForWire(reconciled.manifest),
              };
            }
            const advanced = advanceSessionStage(sdmForMeta, verifiedForBinding);
            if (advanced.changed) {
              sdmForMeta = advanced.manifest;
              input.sessionDeliverableManifest = advanced.manifest;
              turnValidationCache = null;
              await input.onSessionManifestUpdated?.(advanced.manifest);
              yield {
                type: "session_manifest_updated",
                sessionId: input.sessionId,
                turnId: input.turnId,
                sessionManifest: slimSessionManifestForWire(advanced.manifest),
              };
            }
            engineValidation = {
              ...engineValidation,
              verified: verifiedForBinding,
            };
          }
          const sdm = sdmForMeta;
          const acceptanceStatusForMeta = engineValidation.acceptance === "not_applicable"
            ? "passed"
            : engineValidation.acceptance;
          const circuitBreakerTripped = Boolean(sdm?.repairCircuit?.tripped);
          const continuationOwner = circuitBreakerTripped
            ? "none" as const
            : deliverableAction === "deliverable_repair"
              ? "deliverable_repair" as const
              : deliverableAction === "auto_continue_engine"
                ? "auto_continue_engine" as const
                : "none" as const;
          // P0-7 draft snapshot: the certificate is intentionally absent until
          // verification, repair circuit, and recovery budget have all settled.
          const slotBindings: SlotBindingRecord[] | undefined = sdm
            ? buildSlotBindingsFromManifest(sdm)
            : undefined;
          const contractSnapshot = sdm
            ? buildContractSnapshotFromManifest(sdm)
            : undefined;
          await input.onTurnAcceptanceMeta?.({
            finality: "draft",
            ...buildQualityAcceptanceMeta(input),
            expectedManifest: engineValidation.expectedManifest,
            verifiedPaths: engineValidation.verified,
            missingPaths: engineValidation.missing,
            brokenPaths: engineValidation.broken,
            displayPaths: engineValidation.verified,
            hiddenByPolicyPaths: [],
            ...(input.sessionTaskDirectory
              ? {
                  turnArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                  taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                  scopeId: input.sessionTaskDirectory.taskDirKey,
                }
              : {}),
            resolvedPathMap: engineValidation.resolvedPathMap
              ?? Object.fromEntries(
                engineValidation.verified.map((filePath) => [filePath, filePath]),
              ),
            acceptanceStatus: acceptanceStatusForMeta,
            continuationOwner,
            circuitBreakerTripped: circuitBreakerTripped || undefined,
            ...(engineValidation.compositeSlotQuality?.length
              ? { compositeSlotQuality: engineValidation.compositeSlotQuality }
              : {}),
            ...(sdm
              ? {
                  sessionManifestVersion: sdm.manifestVersion,
                  goalVersion: sdm.goalVersion,
                  sdmSnapshot: buildExpectedManifestFromSdm(sdm),
                  currentStageId: sdm.currentStageId,
                  slotBindings,
                  contractSnapshot,
                }
              : {}),
          });
          const resolvedPathMap = engineValidation.resolvedPathMap
            ?? Object.fromEntries(
              engineValidation.verified.map((filePath) => [filePath, filePath]),
            );
          const acceptanceStatus = acceptanceStatusForMeta;
          yield {
            type: "turn_acceptance_snapshot",
            sessionId: input.sessionId,
            turnId: input.turnId,
            verifiedDeliverablePaths: engineValidation.verified,
            missingPaths: engineValidation.missing,
            brokenPaths: engineValidation.broken,
            hiddenByPolicyPaths: [],
            expectedManifest: engineValidation.expectedManifest,
            resolvedPathMap,
            acceptanceStatus,
            continuationOwner,
            turnAcceptanceMeta: {
              finality: "draft",
              ...buildQualityAcceptanceMeta(input),
              expectedManifest: engineValidation.expectedManifest,
              verifiedPaths: engineValidation.verified,
              missingPaths: engineValidation.missing,
              brokenPaths: engineValidation.broken,
              displayPaths: engineValidation.verified,
              hiddenByPolicyPaths: [],
              resolvedPathMap,
              acceptanceStatus,
              continuationOwner,
              circuitBreakerTripped: circuitBreakerTripped || undefined,
              ...(engineValidation.bindingAudit
                ? { bindingAudit: engineValidation.bindingAudit }
                : {}),
              ...(engineValidation.compositeSlotQuality?.length
                ? { compositeSlotQuality: engineValidation.compositeSlotQuality }
                : {}),
              ...(input.sessionTaskDirectory
                ? {
                    turnArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                    taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                    scopeId: input.sessionTaskDirectory.taskDirKey,
                  }
                : {}),
              ...(sdm
                ? {
                    sessionManifestVersion: sdm.manifestVersion,
                    goalVersion: sdm.goalVersion,
                    sdmSnapshot: buildExpectedManifestFromSdm(sdm),
                    currentStageId: sdm.currentStageId,
                    slotBindings,
                    contractSnapshot,
                  }
                : {}),
            },
            ...(sdm ? { sessionManifest: slimSessionManifestForWire(sdm) } : {}),
          };
        }
        if (deliverableAction === "user_action_required") {
          const sideEffectBlocked = await maybeStopForSideEffectConfirmation({
            userGoal: turnUserGoal,
            assistantText,
          });
          if (sideEffectBlocked) {
            yield sideEffectBlocked.event;
            return { result: sideEffectBlocked.result, messages };
          }
        }
        if (
          !completionGateVeto
          && (deliverableAction === "auto_continue_engine" || deliverableAction === "deliverable_repair")
        ) {
          if (deliverableAction === "deliverable_repair" && engineValidation) {
            const qualityRework = isDeliverableQualityReworkGoal(
              turnUserGoal,
              input.sessionDeliverableManifest,
            );
            if (
              !qualityRework
              && (
                engineValidation.acceptance === "passed"
                || engineValidation.userAcknowledgedPartial === true
              )
            ) {
              deliverableAction = "none";
            } else {
            const repairValidation = engineValidation;
            const repairManifest = input.sessionDeliverableManifest;
            const activeRepairSlots = repairManifest?.slots.filter(
              (slot) => slot.required && slot.status !== "removed",
            ) ?? [];
            const repairValidationOptions = {
              htmlSlotCount: activeRepairSlots.filter((slot) => slot.kind === "html").length > 0
                ? activeRepairSlots.filter((slot) => slot.kind === "html").length
                : undefined,
              taskArtifactDir: repairManifest?.taskArtifactDir
                ?? input.sessionTaskDirectory?.taskArtifactDir,
            };
            const incompleteSdmIds = activeRepairSlots
              .filter((slot) => !slotSatisfiedByValidation(slot, repairValidation.verified, repairValidationOptions))
              .map((slot) => slot.id) ?? [];
            repairStreakState = advanceRepairStreak(
              repairStreakState,
              repairValidation.missing,
              repairValidation.broken,
              buildSdmGapKey(incompleteSdmIds),
            );
            // PD-SAAS-FORK: taskStageBudget observe for deliverable_repair. Do not change repair return/arbitration.
            observeTaskStage({
              sessionId: input.sessionId,
              stage: "deliverable_repair",
              elapsedMs: 0,
              retryCount: repairStreakState.streak,
              verifiedNet: 0,
            });
            let circuitBreakerTripped = Boolean(input.sessionDeliverableManifest?.repairCircuit?.tripped);
            if (input.sessionDeliverableManifest && !circuitBreakerTripped) {
              const gapRecord = recordSessionRepairGap({
                manifest: input.sessionDeliverableManifest,
                missing: repairValidation.missing,
                broken: repairValidation.broken,
                sdmGapKey: buildSdmGapKey(incompleteSdmIds),
                verified: engineValidation.verified,
                userGoal: turnUserGoal,
              });
              if (gapRecord.gapKey || gapRecord.tripped) {
                const mergedCircuitManifest = mergeRepairCircuitIntoManifest(
                  input.sessionDeliverableManifest,
                  gapRecord.circuit,
                );
                input.sessionDeliverableManifest = mergedCircuitManifest;
                turnValidationCache = null;
                await input.onSessionManifestUpdated?.(mergedCircuitManifest);
                yield {
                  type: "session_manifest_updated",
                  sessionId: input.sessionId,
                  turnId: input.turnId,
                  sessionManifest: slimSessionManifestForWire(mergedCircuitManifest),
                };
              }
              circuitBreakerTripped = gapRecord.tripped;
            }
            const groundTruth = reconcileDeliverableGroundTruth({
              userGoal: turnUserGoal,
              verified: engineValidation.verified,
              missing: engineValidation.missing,
              broken: engineValidation.broken,
              sessionManifest: input.sessionDeliverableManifest,
              capabilitySlug: input.capabilityContext?.slug,
              majorCategory: input.capabilityContext?.majorCategory,
              profileId: input.sessionDeliverableManifest?.profileId,
            });
            const repairFastStopReached =
              shouldFastStopRepairLoop(repairStreakState.streak);
            if (
              circuitBreakerTripped
              || repairFastStopReached
              || (groundTruth.reconciled && engineValidation.acceptance === "passed")
            ) {
              const totalHint = input.sessionDeliverableManifest?.slots?.length
                ?? engineValidation.expectedManifest?.length
                ?? Math.max(engineValidation.verified.length + engineValidation.missing.length, 1);
              engineValidation = applyGroundTruthToValidation(engineValidation, {
                userGoal: turnUserGoal,
                sessionManifest: input.sessionDeliverableManifest,
                capabilitySlug: input.capabilityContext?.slug,
                majorCategory: input.capabilityContext?.majorCategory,
                profileId: input.sessionDeliverableManifest?.profileId,
              });
              finalCircuitBreakerTripped =
                finalCircuitBreakerTripped || circuitBreakerTripped;
              if (
                engineValidation.acceptance !== "passed"
                && repairFastStopReached
                && !groundTruth.reconciled
              ) {
                finalRecoveryBudgetExhausted = true;
                engineValidation = {
                  ...engineValidation,
                  continuePrompt: circuitBreakerTripped
                    ? buildCircuitBreakerContinuePrompt(
                        engineValidation.verified.length,
                        totalHint,
                      )
                    : buildRepairFastStopContinuePrompt({
                        verifiedCount: engineValidation.verified.length,
                        totalHint,
                        reason: "同一缺口连续修复未通过",
                      }),
                };
              }
              deliverableAction = "none";
              const sdmAfterStop = input.sessionDeliverableManifest;
              const trippedAfterStop = Boolean(sdmAfterStop?.repairCircuit?.tripped) || circuitBreakerTripped;
              const slotBindingsAfterStop = sdmAfterStop
                ? buildSlotBindingsFromManifest(sdmAfterStop)
                : undefined;
              const contractSnapshotAfterStop = sdmAfterStop
                ? buildContractSnapshotFromManifest(sdmAfterStop)
                : undefined;
              const acceptanceAfterStop = engineValidation.acceptance === "not_applicable"
                ? "passed"
                : engineValidation.acceptance;
              const resolvedPathMapAfterStop = engineValidation.resolvedPathMap
                ?? Object.fromEntries(
                  engineValidation.verified.map((filePath) => [filePath, filePath]),
                );
              await input.onTurnAcceptanceMeta?.({
                finality: "draft",
                ...buildQualityAcceptanceMeta(input),
                expectedManifest: engineValidation.expectedManifest,
                verifiedPaths: engineValidation.verified,
                missingPaths: engineValidation.missing,
                brokenPaths: engineValidation.broken,
                displayPaths: engineValidation.verified,
                hiddenByPolicyPaths: [],
                ...(input.sessionTaskDirectory
                  ? {
                      turnArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                      taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                      scopeId: input.sessionTaskDirectory.taskDirKey,
                    }
                  : {}),
                resolvedPathMap: resolvedPathMapAfterStop,
                acceptanceStatus: acceptanceAfterStop,
                continuationOwner: "none",
                circuitBreakerTripped: trippedAfterStop || undefined,
                ...(engineValidation.compositeSlotQuality?.length
                  ? { compositeSlotQuality: engineValidation.compositeSlotQuality }
                  : {}),
                ...(sdmAfterStop
                  ? {
                      sessionManifestVersion: sdmAfterStop.manifestVersion,
                      goalVersion: sdmAfterStop.goalVersion,
                      sdmSnapshot: buildExpectedManifestFromSdm(sdmAfterStop),
                      currentStageId: sdmAfterStop.currentStageId,
                      slotBindings: slotBindingsAfterStop,
                      contractSnapshot: contractSnapshotAfterStop,
                    }
                  : {}),
              });
              yield {
                type: "turn_acceptance_snapshot",
                sessionId: input.sessionId,
                turnId: input.turnId,
                verifiedDeliverablePaths: engineValidation.verified,
                missingPaths: engineValidation.missing,
                brokenPaths: engineValidation.broken,
                hiddenByPolicyPaths: [],
                expectedManifest: engineValidation.expectedManifest,
                resolvedPathMap: resolvedPathMapAfterStop,
                acceptanceStatus: acceptanceAfterStop,
                continuationOwner: "none",
                turnAcceptanceMeta: {
                  finality: "draft",
                  ...buildQualityAcceptanceMeta(input),
                  expectedManifest: engineValidation.expectedManifest,
                  verifiedPaths: engineValidation.verified,
                  missingPaths: engineValidation.missing,
                  brokenPaths: engineValidation.broken,
                  displayPaths: engineValidation.verified,
                  hiddenByPolicyPaths: [],
                  resolvedPathMap: resolvedPathMapAfterStop,
                  acceptanceStatus: acceptanceAfterStop,
                  continuationOwner: "none",
                  circuitBreakerTripped: trippedAfterStop || undefined,
                  ...(engineValidation.compositeSlotQuality?.length
                    ? { compositeSlotQuality: engineValidation.compositeSlotQuality }
                    : {}),
                  ...(input.sessionTaskDirectory
                    ? {
                        turnArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                        taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
                        scopeId: input.sessionTaskDirectory.taskDirKey,
                      }
                    : {}),
                  ...(sdmAfterStop
                    ? {
                        sessionManifestVersion: sdmAfterStop.manifestVersion,
                        goalVersion: sdmAfterStop.goalVersion,
                        sdmSnapshot: buildExpectedManifestFromSdm(sdmAfterStop),
                        currentStageId: sdmAfterStop.currentStageId,
                        slotBindings: slotBindingsAfterStop,
                        contractSnapshot: contractSnapshotAfterStop,
                      }
                    : {}),
                },
                ...(sdmAfterStop ? { sessionManifest: slimSessionManifestForWire(sdmAfterStop) } : {}),
              };
            }
            }
          }
        }
        if (
          !completionGateVeto
          && deliverableAction !== "none"
          && (deliverableAction === "auto_continue_engine" || deliverableAction === "deliverable_repair")
        ) {
          const consumeReason = deliverableAction === "deliverable_repair"
            ? "acceptance_repair"
            : "auto_continue";
          const consumed = recoveryBudget.tryConsume(consumeReason);
          if (consumed) {
            autoContinueTurnsUsed += 1;
            const detail = recoveryAttemptDetail(consumed, "tool");
            logRecoveryAttempt(consumeReason, detail);
            yield {
              type: "recovery_attempt",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: consumeReason,
              attempt: detail.attempt,
              maxAttempts: detail.maxAttempts,
              category: detail.category,
              budgetRemaining: detail.budgetRemaining,
              layer: detail.layer,
            };
            const locale = promptLanguage === "zh-CN" ? "zh" : "en";
            const recoveryText = deliverableAction === "deliverable_repair" && engineValidation
              ? buildAcceptanceRepairPrompt({
                userGoal: turnUserGoal,
                result: {
                  status: engineValidation.acceptance,
                  expected: {},
                  verifiedPaths: engineValidation.verified,
                  missingPaths: engineValidation.missing,
                  brokenPaths: engineValidation.broken,
                  failures: engineValidation.failures,
                  continuePrompt: engineValidation.continuePrompt ?? "",
                },
              })
              : buildPrematureStopRecoveryUserMessage(locale, "assistant_gave_up").content
                .filter((block): block is { type: "text"; text: string } => block.type === "text")
                .map((block) => block.text)
                .join("\n");
            // PD-SAAS-FORK (P1-A): append the plan-ledger next-step hint so the repair attempt is
            // anchored to the concrete remaining deliverable rather than re-deriving it each turn.
            const recoveryTextWithPlan = planLedgerHint
              ? `${recoveryText}\n\n${planLedgerHint}`
              : recoveryText;
            const recoveryMessage: CanonicalMessage = {
              role: "user",
              content: [{ type: "text", text: recoveryTextWithPlan }],
            };
            recoveryMessage.metadata = {
              ...recoveryMessage.metadata,
              synthetic: true,
              continuationOwner: "engine",
              purpose: deliverableAction === "deliverable_repair" ? "acceptance_repair" : "auto_continue",
              acceptanceFailures: engineValidation?.failures.map((failure) => failure.reason),
            };
            messages.push(recoveryMessage);
            await input.onDurableMessage?.(recoveryMessage);
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: deliverableAction === "deliverable_repair"
                ? "acceptance_failed"
                : "deliverable_validate_failed",
            };
            continue;
          }
          finalRecoveryBudgetExhausted = true;
          deliverableAction = "none";
        }

        let lastFinalizedAcceptanceStatus: string | undefined;
        let lastFinalizedCompletionState: string | undefined;
        let lastFinalizedCertificateComplete: boolean | undefined;
        if (engineValidation) {
          const finalizedAcceptance = finalizeDeliverableAcceptance({
            validation: engineValidation,
            manifest: input.sessionDeliverableManifest,
            scopeDir: input.sessionTaskDirectory?.taskArtifactDir
              ?? input.sessionDeliverableManifest?.taskArtifactDir
              ?? null,
            diskPaths: engineValidation.verified,
            candidateContinuationAction: deliverableAction,
            candidateContinuationOwner: deliverableAction === "deliverable_repair"
              ? "deliverable_repair"
              : deliverableAction === "auto_continue_engine"
                ? "auto_continue_engine"
                : "none",
            userAcknowledgedPartial:
              engineValidation.userAcknowledgedPartial === true,
            circuitBreakerTripped: finalCircuitBreakerTripped,
            recoveryBudgetExhausted: finalRecoveryBudgetExhausted,
          });
          engineValidation = finalizedAcceptance.validation;
          deliverableAction = finalizedAcceptance.continuationAction;
          lastFinalizedAcceptanceStatus = finalizedAcceptance.acceptanceStatus;
          lastFinalizedCompletionState = finalizedAcceptance.completionState;
          const finalSdm = input.sessionDeliverableManifest;
          const finalCertificate =
            finalizedAcceptance.acceptanceCertificate;
          lastFinalizedCertificateComplete = finalCertificate
            ? finalCertificate.completionState === "complete"
            : undefined;
          const finalResolvedPathMap = engineValidation.resolvedPathMap
            ?? Object.fromEntries(
              engineValidation.verified.map((filePath) => [filePath, filePath]),
            );
          const finalSlotBindings: SlotBindingRecord[] | undefined =
            finalCertificate
              ? finalCertificate.slots.map((row) => ({
                  slotId: row.slotId,
                  label: row.label,
                  resolvedPath: row.resolvedPath,
                  status: row.status === "done" ? "done" as const : "pending",
                  required: row.required !== false,
                }))
              : finalSdm
                ? buildSlotBindingsFromManifest(finalSdm)
                : undefined;
          const finalContractSnapshot = finalCertificate
            ? {
                rowsHash: finalCertificate.contractHash,
                totalSlots: finalCertificate.requiredTotal,
                doneSlots: finalCertificate.requiredDone,
                completionState: finalCertificate.completionState,
                evidenceHash: finalCertificate.evidenceHash,
              }
            : finalSdm
              ? buildContractSnapshotFromManifest(finalSdm)
              : undefined;
          const finalAcceptanceMeta: Parameters<
            NonNullable<AgentLoopInput["onTurnAcceptanceMeta"]>
          >[0] = {
            finality: "final",
            ...buildQualityAcceptanceMeta(input),
            expectedManifest: engineValidation.expectedManifest,
            verifiedPaths: engineValidation.verified,
            missingPaths: engineValidation.missing,
            brokenPaths: engineValidation.broken,
            displayPaths: engineValidation.verified,
            hiddenByPolicyPaths: [],
            ...(input.sessionTaskDirectory
              ? {
                  turnArtifactDir:
                    input.sessionTaskDirectory.taskArtifactDir,
                  taskArtifactDir:
                    input.sessionTaskDirectory.taskArtifactDir,
                  scopeId: input.sessionTaskDirectory.taskDirKey,
                }
              : {}),
            resolvedPathMap: finalResolvedPathMap,
            acceptanceStatus: finalizedAcceptance.acceptanceStatus,
            completionState: finalizedAcceptance.completionState,
            continuationOwner: finalizedAcceptance.continuationOwner,
            circuitBreakerTripped:
              finalCircuitBreakerTripped || undefined,
            ...(engineValidation.qualityEvidenceHash
              ? {
                  qualityEvidenceHashVersion: 1,
                  qualityEvidenceHash:
                    engineValidation.qualityEvidenceHash,
                }
              : {}),
            ...(engineValidation.qualityCompletion
              ? { qualityCompletion: engineValidation.qualityCompletion }
              : {}),
            ...(input.sessionDeliverableManifest
              ? (() => {
                  const progress = computeSdmProgress(
                    input.sessionDeliverableManifest,
                    engineValidation.verified,
                  );
                  const structureComplete =
                    progress.total > 0 && progress.done >= progress.total;
                  return {
                    structureCompletion: structureComplete ? "passed" : "needs_repair",
                  };
                })()
              : {}),
            ...(finalizedAcceptance.partialReason
              ? { partialReason: finalizedAcceptance.partialReason }
              : {}),
            ...(finalizedAcceptance.blockedReasonType
              ? {
                  blockedReasonType:
                    finalizedAcceptance.blockedReasonType,
                }
              : {}),
            ...(engineValidation.qualityFailures
              ? { qualityFailures: engineValidation.qualityFailures }
              : {}),
            ...(engineValidation.assetProvenanceSummary
              ? {
                  assetProvenanceSummary:
                    engineValidation.assetProvenanceSummary,
                }
              : {}),
            ...(engineValidation.bindingAudit
              ? { bindingAudit: engineValidation.bindingAudit }
              : {}),
            ...(engineValidation.compositeSlotQuality?.length
              ? {
                  compositeSlotQuality:
                    engineValidation.compositeSlotQuality,
                }
              : {}),
            ...(finalCertificate
              ? { acceptanceCertificate: finalCertificate }
              : {}),
            ...(finalSdm
              ? {
                  sessionManifestVersion: finalSdm.manifestVersion,
                  goalVersion: finalSdm.goalVersion,
                  sdmSnapshot: buildExpectedManifestFromSdm(finalSdm),
                  currentStageId: finalSdm.currentStageId,
                  slotBindings: finalSlotBindings,
                  contractSnapshot: finalContractSnapshot,
                }
              : {}),
          };
          await input.onTurnAcceptanceMeta?.(finalAcceptanceMeta);
          yield {
            type: "turn_acceptance_snapshot",
            sessionId: input.sessionId,
            turnId: input.turnId,
            verifiedDeliverablePaths: engineValidation.verified,
            missingPaths: engineValidation.missing,
            brokenPaths: engineValidation.broken,
            hiddenByPolicyPaths: [],
            expectedManifest: engineValidation.expectedManifest,
            resolvedPathMap: finalResolvedPathMap,
            acceptanceStatus: finalizedAcceptance.acceptanceStatus,
            continuationOwner: finalizedAcceptance.continuationOwner,
            turnAcceptanceMeta: finalAcceptanceMeta,
            ...(finalSdm
              ? { sessionManifest: slimSessionManifestForWire(finalSdm) }
              : {}),
          };
        }

        if (finalMessage) {
          const gated = gateAssistantCompletionText(
            {
              text: textFromMessage(finalMessage),
              acceptanceStatus: lastFinalizedAcceptanceStatus,
              completionState: lastFinalizedCompletionState,
              certificateComplete: lastFinalizedCertificateComplete,
              taskArtifactDir: input.sessionTaskDirectory?.taskArtifactDir
                ?? input.sessionDeliverableManifest?.taskArtifactDir
                ?? null,
            },
            input.promptLanguage === "zh-CN" ? "zh-CN" : "en",
          );
          if (gated.gated) {
            recordStabilityEvent({
              event: "assistant_completion_gate",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: gated.mode,
            });
            finalMessage = {
              ...finalMessage,
              content: [{ type: "text", text: gated.text }],
            };
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0 && messages[lastIdx]?.role === "assistant") {
              messages[lastIdx] = finalMessage;
            }
          }
        }

        const result = this.createTurnResult(input, {
          type: "success",
          stopReason: "completed",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          structuredOutput,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      yield { type: "tool_calls_detected", sessionId: input.sessionId, turnId: input.turnId, calls: toolCalls };
      getTurnTrace(input.turnId)?.markFirstVisible("tool");
      if (input.abortSignal?.aborted) {
        const result = this.createTurnResult(input, {
          type: "aborted",
          stopReason: "aborted_streaming",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }
      // PD-SAAS-FORK: direct-start / Nova research deliverable turns must not stall on elicitation.
      const turnUserGoalForTools = extractDeliverableSessionUserGoal(messages);
      const askUserQuestionPolicy = classifyAskUserQuestionToolCalls(toolCalls);
      const preferenceAskUserBypass =
        askUserQuestionPolicy.kind === "preference" || askUserQuestionPolicy.kind === "required"
          ? resolvePreferenceAskUserBypass({
            userGoal: turnUserGoalForTools,
            capabilitySlug: input.capabilityContext?.slug,
            majorCategory: input.capabilityContext?.majorCategory,
            askUserPolicy: {
              kind: askUserQuestionPolicy.kind,
              hasDefaultOption: askUserQuestionPolicy.hasDefaultOption,
            },
          })
          : null;
      if (preferenceAskUserBypass) {
        const skipBudgetForResearchPref = preferenceAskUserBypass === "research_deliverable";
        const consumed = recoveryBudget.tryConsume("auto_continue")
          ?? (skipBudgetForResearchPref
            ? {
              attempt: recoveryBudget.usedCount() + 1,
              maxAttempts: recoveryBudget.recoverableMaxCount(),
              budgetRemaining: recoveryBudget.remaining(),
              reason: "auto_continue" as const,
            }
            : null);
        if (consumed) {
          const detail = recoveryAttemptDetail(consumed, "tool");
          logRecoveryAttempt("auto_continue", detail);
          yield {
            type: "recovery_attempt",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "auto_continue",
            attempt: detail.attempt,
            maxAttempts: detail.maxAttempts,
            category: detail.category,
            budgetRemaining: detail.budgetRemaining,
            layer: detail.layer,
          };
          if (messages[messages.length - 1] === assembled.message) {
            messages = messages.slice(0, -1);
          }
          const locale = this.resolvePromptLanguage(input) === "zh-CN" ? "zh" : "en";
          const directStartPrompt = locale === "zh"
            ? preferenceAskUserBypass === "direct_start"
              ? "用户已经明确要求「直接开始做」。这次 ask_user_question 属于偏好确认，不要等待用户选择；请采用推荐/默认选项，记录默认假设，继续完成尚未交付的文件成果，并把成果保存到 artifacts/ 后报告路径。"
              : "本次 ask_user_question 属于偏好确认（如深度 tier、数据是否充分）。不要等待用户选择；采用 standard 默认深度与推荐/默认选项，记录假设后搜完即 write_file 完整调研报告到 artifacts/research-*/ 并报告路径。"
            : preferenceAskUserBypass === "direct_start"
              ? "The user explicitly asked to start directly. This ask_user_question is preference elicitation, so do not wait for choices; use recommended/default options, record the assumptions, finish the missing file deliverables, save them under artifacts/, and report paths."
              : "This ask_user_question is preference elicitation (depth tier, data sufficiency). Do not wait for choices; use the standard default depth and recommended options, record assumptions, then write the full research report under artifacts/research-*/ and report paths.";
          messages.push({
            role: "user",
            content: [{ type: "text", text: directStartPrompt }],
            metadata: { synthetic: true, purpose: "auto_continue" },
          });
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "auto_continue",
          };
          continue;
        }
      }
      // When jsonrepair silently "fixed" truncated JSON and the response
      // was cut by max_tokens, the tool call arguments are likely incomplete
      // (e.g. half-written file content). Apply the same recovery as
      // max_output_reached: token doubling → continuation prompt → give up.
      if (assembled.hasRepairedToolCalls && (assembled.finishReason === "length" || assembled.finishReason === "tool_call" || assembled.finishReason === "stop")) {
        console.warn(
          `[AgentLoop] Blocking ${toolCalls.length} repaired-but-truncated tool call(s) — entering max_output recovery`,
        );

        const largeFileDecision = largeFileRepair.recoverFromRepairedTruncation(toolCalls);
        if (largeFileDecision) {
          const continued = await continueWithSyntheticPrompt(largeFileDecision);
          if (continued.type === "completed") {
            yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: continued.result.errors![0]! };
            await captureTurn(continued.result.type === "error");
            yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: continued.result };
            return { result: continued.result, messages };
          }
          yield continued.event;
          continue;
        }

        // Phase A: token doubling (if not yet attempted)
        if (!hasAttemptedOutputRetry) {
          messages = stripTrailingErrorPair(messages);
          const previous = this.config.maxOutputTokens ?? OUTPUT_TOKEN_RETRY_DEFAULT;
          this.config.maxOutputTokens = Math.min(previous * 2, OUTPUT_TOKEN_RETRY_CEILING);
          hasAttemptedOutputRetry = true;
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "model_error",
          };
          continue;
        }

        // Phase B: continuation recovery
        if (maxOutputRecoveryCount < MAX_OUTPUT_RECOVERY_LIMIT) {
          maxOutputRecoveryCount++;
          messages.push({
            role: "user",
            content: [{
              type: "text",
              text: "Output token limit hit. Resume directly — no apology, no recap of what you were doing. "
                + "Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.",
            }],
            metadata: { synthetic: true, purpose: "max_output_recovery" },
          });
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "model_error",
          };
          continue;
        }

        // Phase C: exhausted — let tool execution proceed with
        // outputTruncated=true so formatValidationError can provide hints.
      }

      let results: PilotDeckToolResult[];
      try {
        const toolContext = this.createToolContext(input, messages);
        if (assembled.finishReason === "length" || assembled.hasRepairedToolCalls) {
          toolContext.outputTruncated = true;
        }
        results = yield* this.executeToolsWithEventPump(
          toolCalls,
          toolContext,
          input,
        );
      } catch (error) {
        results = toolCalls.map((call) =>
          createMissingToolResult(call, this.now, error instanceof Error ? error.message : String(error)),
        );
      }
      if (input.abortSignal?.aborted) {
        const result = this.createTurnResult(input, {
          type: "aborted",
          stopReason: "aborted_streaming",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }
      yield* this.drainEventBuffer();

      const pairedResults = ensureToolResultPairing(toolCalls, results, this.now);
      const toolResultRepair = largeFileRepair.analyzeToolResults(pairedResults, {
        outputTruncated: assembled.finishReason === "length" || assembled.hasRepairedToolCalls === true,
        repairedToolCalls: assembled.hasRepairedToolCalls === true,
        finishReason: assembled.finishReason,
      });
      permissionDenials = [...permissionDenials, ...collectPermissionDenials(pairedResults)];
      for (const result of pairedResults) {
        if (result.type === "success" && result.metadata?.structuredOutput) {
          structuredOutput = result.data;
        }
        const requestedMode = readRequestedMode(result.type === "success" ? result.data : undefined);
        if (requestedMode) {
          let effectiveMode = requestedMode;

          if (requestedMode === "plan" && this.config.permissionMode !== "plan") {
            this.config.permissionModeBeforePlan = this.config.permissionMode;
          } else if (this.config.permissionMode === "plan" && requestedMode !== "plan") {
            if (this.config.permissionModeBeforePlan) {
              effectiveMode = this.config.permissionModeBeforePlan;
              this.config.permissionModeBeforePlan = undefined;
            }
          }

          this.config.permissionMode = effectiveMode;
          this.config.permissionContext.mode = effectiveMode;
          yield { type: "mode_change_requested", sessionId: input.sessionId, turnId: input.turnId, mode: effectiveMode };
        }
        yield { type: "tool_result", sessionId: input.sessionId, turnId: input.turnId, result };
      }

      const projected = projectToolResults(pairedResults);
      // Route the freshly projected tool_result message through the context
      // runtime so large payloads land on disk via `ToolResultBudget`. When
      // the runtime doesn't implement `applyToolResults` (e.g. NullContext),
      // we simply append the raw projection (legacy behaviour).
      // Only the first message (containing tool_result blocks) goes through
      // budget processing; supplemental messages (PDF/image data) are appended directly.
      const [toolResultMsg, ...supplementalMsgs] = projected;
      const ctxApply = this.dependencies.context?.applyToolResults;
      if (ctxApply) {
        try {
          const applied = await ctxApply.call(this.dependencies.context, {
            sessionId: input.sessionId,
            turnId: input.turnId,
            toolResultMessage: toolResultMsg,
            messages,
          });
          messages = applied.messages;
        } catch {
          messages.push(toolResultMsg);
        }
      } else {
        messages.push(toolResultMsg);
      }
      for (const supplemental of supplementalMsgs) {
        messages.push(supplemental);
      }
      yield { type: "tool_results_projected", sessionId: input.sessionId, turnId: input.turnId, message: toolResultMsg };
      const durableToolResult = ctxApply
        ? (findLastToolResultCarrierMessage(messages) ?? toolResultMsg)
        : toolResultMsg;
      await input.onDurableMessage?.(durableToolResult);
      for (const supplemental of supplementalMsgs) {
        await input.onDurableMessage?.(supplemental);
      }
      const officialMediaBudget = this.resolveOfficialMediaBudget(input);
      if (
        officialMediaBudget?.shouldIssuePlaceholderRecovery()
        && input.sessionTaskDirectory?.taskArtifactDir
      ) {
        // PD-SAAS-FORK P0-6: the shared FSM owns this one-shot fallback;
        // legacy visual degrade remains excluded for the same enforce scope.
        const officialFallback =
          buildOfficialMediaPlaceholderRecoveryMessage({
            taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
            language: this.resolvePromptLanguage(input),
            failedTools: pairedResults
              .filter((result) => result.type === "error")
              .map((result) => result.toolName),
          });
        messages.push(officialFallback);
        await input.onDurableMessage?.(officialFallback);
        officialMediaBudget.markPlaceholderRecoveryIssued();
      }

      if (toolResultRepair) {
        const continued = await continueWithSyntheticPrompt(toolResultRepair);
        if (continued.type === "completed") {
          yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: continued.result.errors![0]! };
          await captureTurn(continued.result.type === "error");
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: continued.result };
          return { result: continued.result, messages };
        }
        yield continued.event;
        continue;
      }

      const lifecycleBlock = findToolLifecycleBlock(pairedResults);
      if (lifecycleBlock) {
        const result = this.createTurnResult(input, {
          type: "error",
          stopReason: "tool_error",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          structuredOutput,
          errors: [agentError("agent_unsupported_feature", lifecycleBlock.reason)],
        });
        yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      // Circuit breaker: detect turns where ALL tool calls returned
      // invalid_tool_input. If the model is stuck (e.g. repeatedly emitting
      // empty-param bash), terminate early after MAX_CONSECUTIVE_ALL_INVALID_TURNS.
      // When LargeFileRepair is actively managing recovery, defer to its own
      // attempt limits instead of terminating here.
      const allInvalid = pairedResults.length > 0 && pairedResults.every(
        (r) => r.type === "error" && r.error.code === "invalid_tool_input",
      );
      if (allInvalid && largeFileRepair.hasPendingRepair) {
        const fallbackRepair = largeFileRepair.onInvalidToolInput();
        if (fallbackRepair) {
          const continued = await continueWithSyntheticPrompt(fallbackRepair);
          if (continued.type === "completed") {
            yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: continued.result.errors![0]! };
            await captureTurn(continued.result.type === "error");
            yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: continued.result };
            return { result: continued.result, messages };
          }
          yield continued.event;
          continue;
        }
        const turnUserGoalInvalid = extractLatestNonSyntheticUserText(messages);
        if (
          userGoalImpliesDeliverable(turnUserGoalInvalid)
          && recoveryBudget.tryConsume("auto_continue")
        ) {
          consecutiveAllInvalidTurns = 0;
          autoContinueTurnsUsed += 1;
          const locale = this.resolvePromptLanguage(input) === "zh-CN" ? "zh" : "en";
          const recoveryMessage = buildInvalidToolInputRecoveryPrompt(locale);
          messages.push(recoveryMessage);
          await input.onDurableMessage?.(recoveryMessage);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "invalid_tool_input_recovery",
          };
          continue;
        }
      }

      // PD-SAAS-FORK: soft fetch recovery when web tools return empty/soft-failed success.
      const softFetchRepeatKey = softFetchTracker.record(pairedResults);
      const toolRepeatKey = toolFailureRepeatTracker?.record(pairedResults) ?? null;
      const turnUserGoalForMedia = extractDeliverableSessionUserGoal(messages);
      const visualMediaFailureStat = recordVisualMediaFailuresForSession(
        input.sessionId,
        turnUserGoalForMedia,
        pairedResults,
        {
          officialMediaPolicy:
            input.sessionGoalQualityContract?.officialMediaPolicy,
        },
      );
      const visualMediaForcePlaceholder = visualMediaFailureStat?.shouldForcePlaceholder ?? false;
      // PD-SAAS-FORK: cross-turn same tool+input failure guard (P1-3)
      let crossTurnRepeatKey: string | null = null;
      if (input.sessionId) {
        const crossTracker = getCrossTurnToolFailureTracker(input.sessionId);
        for (const result of pairedResults) {
          if (result.type !== "error") continue;
          const inputKey = result.content.map((c) => contentToText(c)).join("\n").slice(0, 500);
          const inputHash = hashToolInput(inputKey);
          crossTracker.record(result.toolName, inputHash);
          if (crossTracker.shouldTerminal(result.toolName, inputHash)) {
            crossTurnRepeatKey = `${result.toolName}:${inputHash.slice(0, 80)}`;
          }
        }
      }

      // PD-SAAS-FORK: HTML/docx/PDF 等配图任务 — 生图/搜图/抓取多次失败后强制占位图降级续跑
      const visualMediaRepeatKey = toolRepeatKey ?? crossTurnRepeatKey;
      const skipCreativeHardFailPlaceholder = shouldSkipCreativeVisualPlaceholderDegrade({
        userGoal: turnUserGoalForMedia,
        capabilitySlug: input.capabilityContext?.slug,
        results: pairedResults,
      });
      if (
        !largeFileRepair.hasPendingRepair
        && !skipCreativeHardFailPlaceholder
        && hasVisualMediaFailureInResults(pairedResults)
        && shouldUseVisualPlaceholderDegrade({
          userGoal: turnUserGoalForMedia,
          repeatKey: visualMediaRepeatKey,
          forceFromTracker: visualMediaForcePlaceholder || Boolean(softFetchRepeatKey),
          officialMediaPolicy:
            input.sessionGoalQualityContract?.officialMediaPolicy,
        })
      ) {
        const consumed = recoveryBudget.tryConsume("visual_media_degrade");
        if (consumed) {
          toolRecoveryTurnsUsed += 1;
          consecutiveAllInvalidTurns = 0;
          const failedTools = [...new Set(
            pairedResults
              .filter((result) => result.type === "error" || isSoftFailedToolResult(result))
              .map((result) => result.toolName)
              .filter((name) => isVisualMediaAcquisitionTool(name)),
          )];
          const detail = recoveryAttemptDetail(consumed, "tool");
          logRecoveryAttempt("visual_media_degrade", detail);
          yield {
            type: "recovery_attempt",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "visual_media_degrade",
            attempt: detail.attempt,
            maxAttempts: detail.maxAttempts,
            category: detail.category,
            budgetRemaining: detail.budgetRemaining,
            layer: detail.layer,
          };
          const recoveryMessage = buildVisualMediaPlaceholderRecoveryMessage(
            this.resolvePromptLanguage(input),
            failedTools.length > 0 ? failedTools : [toolNameFromRepeatKey(visualMediaRepeatKey) ?? "generate_image"],
            {
              officialMediaPolicy:
                input.sessionGoalQualityContract?.officialMediaPolicy,
              userGoal: turnUserGoalForMedia,
              capabilitySlug: input.capabilityContext?.slug,
            },
          );
          if (recoveryMessage) {
            messages.push(recoveryMessage);
            await input.onDurableMessage?.(recoveryMessage);
          }
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "visual_media_placeholder_degrade",
          };
          continue;
        }
      }

      // PD-SAAS-FORK: no-progress read loop guard. The model is re-issuing the same
      // read-only call(s) (e.g. read_file the same file 16x) with zero progress — none
      // of the failure-based guards above can see it because the reads SUCCEED. Nudge
      // it to produce a deliverable, then wrap the turn up so it cannot burn tokens
      // indefinitely; the incomplete-deliverable auto-continue resumes with a strong
      // "stop reading, write_file now" task-resume if anything is still missing.
      if (!largeFileRepair.hasPendingRepair) {
        const readLoopVerdict = noProgressReadTracker.record(
          toolCalls.map((call) => ({ name: call.name, input: call.input })),
        );
        if (readLoopVerdict === "terminal") {
          const stopNote = buildNoProgressReadStopMessage(this.resolvePromptLanguage(input));
          messages.push(stopNote);
          await input.onDurableMessage?.(stopNote);
          const stuckResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: stopNote,
            structuredOutput,
          });
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "no_progress_read_loop",
            category: "stuck",
            attempt: recoveryBudget.usedCount(),
            maxAttempts: recoveryBudget.maxCount(),
            budgetRemaining: recoveryBudget.remaining(),
            layer: "loop",
          };
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: stuckResult };
          return { result: stuckResult, messages };
        }
        if (readLoopVerdict === "nudge") {
          const nudge = buildNoProgressReadNudgeMessage(this.resolvePromptLanguage(input));
          messages.push(nudge);
          await input.onDurableMessage?.(nudge);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "no_progress_read_nudge",
          };
          continue;
        }
      }

      // PD-SAAS-FORK (P0-5, flag-gated): general no-progress budget for write/edit-same-content
      // and thinking loops. Independent of the read guard above (reads are neutral here).
      if (!largeFileRepair.hasPendingRepair && isProgressBudgetEnabled()) {
        const ledgerVerdict = progressLedger.record(
          toolCalls.map((call) => ({ name: call.name, input: call.input })),
          textFromMessage(assembled.message),
        );
        if (ledgerVerdict === "terminal") {
          recordStabilityEvent({
            event: "no_progress_terminal",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "progress_ledger",
          });
          const stopNote = buildProgressLedgerStopMessage(this.resolvePromptLanguage(input));
          messages.push(stopNote);
          await input.onDurableMessage?.(stopNote);
          const stuckResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: stopNote,
            structuredOutput,
          });
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "no_progress_ledger_loop",
            category: "stuck",
            attempt: recoveryBudget.usedCount(),
            maxAttempts: recoveryBudget.maxCount(),
            budgetRemaining: recoveryBudget.remaining(),
            layer: "loop",
          };
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: stuckResult };
          return { result: stuckResult, messages };
        }
        if (ledgerVerdict === "nudge") {
          recordStabilityEvent({
            event: "no_progress_nudge",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "progress_ledger",
          });
          const nudge = buildProgressLedgerNudgeMessage(this.resolvePromptLanguage(input));
          messages.push(nudge);
          await input.onDurableMessage?.(nudge);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "no_progress_ledger_nudge",
          };
          continue;
        }
      }

      const injectSoftFetch = shouldInjectSoftFetchRecoveryTurn(pairedResults);
      if (
        !largeFileRepair.hasPendingRepair
        && injectSoftFetch
        && !softFetchRepeatKey
      ) {
        const consumed = recoveryBudget.tryConsume("soft_fetch_recovery");
        if (consumed) {
          recentSoftFetchFailure = true;
          softFetchRecoveryConsumedInTurn = true;
          toolRecoveryTurnsUsed += 1;
          consecutiveAllInvalidTurns = 0;
          const detail = recoveryAttemptDetail(consumed, "tool");
          logRecoveryAttempt("soft_fetch_recovery", detail);
          yield {
            type: "recovery_attempt",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "soft_fetch_recovery",
            attempt: detail.attempt,
            maxAttempts: detail.maxAttempts,
            category: detail.category,
            budgetRemaining: detail.budgetRemaining,
            layer: detail.layer,
          };
          const recoveryMessage = buildSoftFetchRecoveryUserMessage(this.resolvePromptLanguage(input));
          messages.push(recoveryMessage);
          await input.onDurableMessage?.(recoveryMessage);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "soft_fetch_recovery",
          };
          continue;
        }
        if (recoveryBudget.isExhausted()) {
          const exhausted = recoveryExhaustedDetail(
            recoveryBudget.maxCount(),
            recoveryBudget.usedCount(),
            "soft_fetch_recovery",
            "tool",
          );
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: exhausted.reason,
            category: exhausted.category,
            attempt: exhausted.attempt,
            maxAttempts: exhausted.maxAttempts,
            budgetRemaining: exhausted.budgetRemaining,
            layer: exhausted.layer,
          };
        }
      }

      if (shouldInjectSoftFetchRecoveryTurn(pairedResults)) {
        recentSoftFetchFailure = true;
      } else if (pairedResults.some((result) => result.type === "success" && !result.metadata?.softFailed)) {
        recentSoftFetchFailure = false;
        softFetchRecoveryConsumedInTurn = false;
        hadRecentToolSuccess = true;
      }

      // PD-SAAS-FORK: hard-fail tool errors (auth/billing/gateway) — confirm then stop
      const toolHardFailClass = worstHardFailFromToolResults(pairedResults);
      if (toolHardFailClass) {
        const hardStreak = hardFailStreakTracker.record(toolHardFailClass);
        const hardThreshold = hardFailThresholdForClassification(toolHardFailClass);
        if (hardStreak >= hardThreshold) {
          const hintKey = toolHardFailClass === "gateway_unreachable"
            ? "gateway"
            : toolHardFailClass === "model_auth" || toolHardFailClass === "model_billing"
              ? "model"
              : "config";
          const exhausted = recoveryExhaustedDetail(
            recoveryBudget.recoverableMaxCount(),
            recoveryBudget.usedCount(),
            "tool_recovery",
            hintKeyToRecoveryCategory(hintKey),
          );
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: exhausted.reason,
            category: exhausted.category,
            attempt: exhausted.attempt,
            maxAttempts: exhausted.maxAttempts,
            budgetRemaining: exhausted.budgetRemaining,
            layer: exhausted.layer,
          };
          const result = this.createTurnResult(input, {
            type: "error",
            stopReason: "tool_error",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage,
            structuredOutput,
            errors: [agentError(
              "agent_model_error",
              `Hard failure confirmed (${toolHardFailClass}) after ${hardStreak} attempt(s).`,
            )],
          });
          yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
          await captureTurn(result.type === "error");
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
          return { result, messages };
        }
      }

      // PD-SAAS-FORK: repeated soft fetch on same URL — skip tool_recovery storm
      const forceToolRecoveryFromRepeat = false;

      if (pairedResults.some((result) => result.type === "error")) {
        repeatedToolFailureState = advanceRepeatedToolFailureState(repeatedToolFailureState, pairedResults);
        if (shouldFastStopRepeatedToolFailure(repeatedToolFailureState)) {
          const fastStopTool = repeatedToolFailureState.lastToolName ?? "tool";
          const notice = buildUserActionRequiredNotice({
            blocker: {
              type: "missing_key",
              fingerprint: `repeated_tool:${fastStopTool}`,
              serviceId: "video",
              alternateHints: [],
              unambiguous: true,
            },
            confirmedAttempts: REPEATED_TOOL_FAST_STOP_THRESHOLD,
            locale: promptLanguage,
            userGoal: extractDeliverableSessionUserGoal(messages),
          });
          const noticeBody = [
            notice.reason,
            "",
            ...notice.steps.map((step, index) => `${index + 1}. ${step}`),
          ].join("\n");
          const noticeMessage: CanonicalMessage = {
            role: "assistant",
            content: [{ type: "text", text: noticeBody }],
            metadata: {
              needsUserInput: true,
              purpose: "user_action_required",
              userActionNotice: notice,
            },
          };
          messages.push(noticeMessage);
          await input.onDurableMessage?.(noticeMessage);
          const blockedResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: noticeMessage,
            structuredOutput,
          });
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: blockedResult };
          return { result: blockedResult, messages };
        }
      }

      if (
        !largeFileRepair.hasPendingRepair
        && (shouldInjectToolRecoveryTurn(pairedResults) || forceToolRecoveryFromRepeat)
        && !isStuckInvalidInputTurn(pairedResults)
        && !toolRepeatKey
        && !crossTurnRepeatKey
      ) {
        const toolErrorMessage = pairedResults
          .filter((r): r is Extract<PilotDeckToolResult, { type: "error" }> => r.type === "error")
          .map((r) => r.error.message ?? "")
          .join("\n");
        const toolUserGoal = extractDeliverableSessionUserGoal(messages);
        const toolBlocker = classifyUserActionBlocker({ toolErrorMessage });
        const toolBlockerStreak = toolBlocker
          ? userActionBlockerTracker.recordForContext(toolBlocker.fingerprint, {
            userGoal: toolUserGoal,
            capabilitySlug: input.capabilityContext?.slug,
            turnBoundary: input.turnId,
          })
          : 0;
        let toolContinuation = resolveContinuationAction({
          userGoal: toolUserGoal,
          toolErrorMessage,
          completionMode: input.capabilityCompletionMode,
          turnInteractionMode: input.turnInteractionMode,
          blocker: toolBlocker,
          blockerStreak: toolBlockerStreak,
          autoRecoveryContinueEnabled: resilienceCfg.enabled,
          directStartRequested: userGoalRequestsDirectStart(toolUserGoal),
          missingIrreplaceableInput: Boolean(toolBlocker),
          capabilitySlug: input.capabilityContext?.slug,
          majorCategory: input.capabilityContext?.majorCategory,
          syntheticBudgetExhausted: syntheticBudgetExhausted(),
        });
        if (toolContinuation === "user_action_required" && toolBlocker) {
          if (!shouldInjectUserActionRequiredNotice(toolBlocker, toolUserGoal)) {
            toolContinuation = "retry_alternate";
          }
        }
        if (toolContinuation === "user_action_required" && toolBlocker) {
          const notice = buildUserActionRequiredNotice({
            blocker: toolBlocker,
            confirmedAttempts: toolBlockerStreak,
            locale: promptLanguage,
            userGoal: toolUserGoal,
          });
          const noticeBody = [
            notice.reason,
            "",
            ...notice.steps.map((step, index) => `${index + 1}. ${step}`),
          ].join("\n");
          const noticeMessage: CanonicalMessage = {
            role: "assistant",
            content: [{ type: "text", text: noticeBody }],
            metadata: {
              needsUserInput: true,
              purpose: "user_action_required",
              userActionNotice: notice,
            },
          };
          messages.push(noticeMessage);
          await input.onDurableMessage?.(noticeMessage);
          const blockedResult = this.createTurnResult(input, {
            type: "success",
            stopReason: "completed",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage: noticeMessage,
            structuredOutput,
          });
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result: blockedResult };
          return { result: blockedResult, messages };
        }
        if (toolContinuation === "stop") {
          // skip tool recovery injection
        } else {
        const currentStageId = input.sessionDeliverableManifest?.currentStageId;
        if (currentStageId !== stageToolRecoveryStageId) {
          stageToolRecoveryStageId = currentStageId;
          stageToolRecoveryUsed = 0;
        }
        const stageToolRecoveryCap = resolveToolRecoveryStageCap(
          input.sessionDeliverableManifest,
          recoveryBudget,
        );
        const stageBudgetBlocked = stageToolRecoveryCap != null
          && stageToolRecoveryUsed >= stageToolRecoveryCap;
        const consumed = !stageBudgetBlocked ? recoveryBudget.tryConsume("tool_recovery") : null;
        if (consumed) {
          stageToolRecoveryUsed += 1;
          toolRecoveryTurnsUsed += 1;
          consecutiveAllInvalidTurns = 0;
          const detail = recoveryAttemptDetail(consumed, "tool");
          const failedTools = pairedResults
            .filter((r) => r.type === "error")
            .map((r) => r.toolName);
          logRecoveryAttempt("tool_recovery", detail, failedTools);
          yield {
            type: "recovery_attempt",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "tool_recovery",
            attempt: detail.attempt,
            maxAttempts: detail.maxAttempts,
            category: detail.category,
            budgetRemaining: detail.budgetRemaining,
            layer: detail.layer,
          };
          // PD-SAAS-FORK: recovery copy follows the UI/system language
          const recoveryMessage = buildToolRecoveryUserMessage(
            pairedResults,
            this.resolvePromptLanguage(input),
            toToolRecoveryOptions(resolveToolRecoveryProfile({
              slug: input.capabilityContext?.slug,
              majorCategory: input.capabilityContext?.majorCategory,
              userGoal: extractDeliverableSessionUserGoal(messages),
              messagesResearchMode: researchReportMode,
              messagesContentMode: contentFlywheelMode,
            })),
          );
          messages.push(recoveryMessage);
          await input.onDurableMessage?.(recoveryMessage);
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "tool_recovery",
          };
          continue;
        }
        if (recoveryBudget.isExhausted()) {
          const exhausted = recoveryExhaustedDetail(
            recoveryBudget.maxCount(),
            recoveryBudget.usedCount(),
            "tool_recovery",
            "tool",
          );
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: exhausted.reason,
            category: exhausted.category,
            attempt: exhausted.attempt,
            maxAttempts: exhausted.maxAttempts,
            budgetRemaining: exhausted.budgetRemaining,
            layer: exhausted.layer,
          };
        }
        }
      }

      // PD-SAAS-FORK: repeated hard failure on same tool+input — terminal hints, no more tool_recovery
      if (
        (toolRepeatKey || crossTurnRepeatKey)
        && shouldInjectToolRecoveryTurn(pairedResults)
        && !largeFileRepair.hasPendingRepair
      ) {
        const repeatKey = toolRepeatKey ?? crossTurnRepeatKey;
        const repeatTool = toolNameFromRepeatKey(repeatKey);
        const useVisualPlaceholder = !skipCreativeHardFailPlaceholder
          && shouldUseVisualPlaceholderDegrade({
            userGoal: turnUserGoalForMedia,
            repeatKey,
            officialMediaPolicy:
              input.sessionGoalQualityContract?.officialMediaPolicy,
          });
        if (useVisualPlaceholder && recoveryBudget.tryConsume("visual_media_degrade")) {
          const recoveryMessage = buildVisualMediaPlaceholderRecoveryMessage(
            this.resolvePromptLanguage(input),
            repeatTool ? [repeatTool] : [],
            {
              officialMediaPolicy:
                input.sessionGoalQualityContract?.officialMediaPolicy,
              userGoal: turnUserGoalForMedia,
              capabilitySlug: input.capabilityContext?.slug,
            },
          );
          if (recoveryMessage) {
            messages.push(recoveryMessage);
            await input.onDurableMessage?.(recoveryMessage);
          }
          yield {
            type: "turn_continued",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "visual_media_tool_repeat_degrade",
          };
          continue;
        }
        const recoveryMessage = buildToolRepeatTerminalMessage(this.resolvePromptLanguage(input));
        messages.push(recoveryMessage);
        await input.onDurableMessage?.(recoveryMessage);
        yield {
          type: "recovery_exhausted",
          sessionId: input.sessionId,
          turnId: input.turnId,
          reason: crossTurnRepeatKey ? "cross_turn_tool_repeat" : "tool_repeat",
          category: "stuck",
          attempt: recoveryBudget.usedCount(),
          maxAttempts: recoveryBudget.maxCount(),
          budgetRemaining: recoveryBudget.remaining(),
          layer: "loop",
        };
      }

      if (allInvalid) {
        consecutiveAllInvalidTurns++;
        if (consecutiveAllInvalidTurns >= MAX_CONSECUTIVE_ALL_INVALID_TURNS) {
          const turnUserGoalLoop = extractDeliverableSessionUserGoal(messages);
          const localeLoop = this.resolvePromptLanguage(input) === "zh-CN" ? "zh" : "en";
          if (
            userGoalImpliesDeliverable(turnUserGoalLoop)
            && (largeFileRepair.hasWrittenFiles || largeFileRepair.hasPendingRepair)
            && recoveryBudget.tryConsume("auto_continue")
          ) {
            consecutiveAllInvalidTurns = 0;
            autoContinueTurnsUsed += 1;
            const recoveryMessage = largeFileRepair.hasWrittenFiles
              ? buildLargeFilePartialContinuePrompt(localeLoop, [...largeFileRepair.writtenFilePaths])
              : buildInvalidToolInputRecoveryPrompt(localeLoop);
            messages.push(recoveryMessage);
            await input.onDurableMessage?.(recoveryMessage);
            yield {
              type: "turn_continued",
              sessionId: input.sessionId,
              turnId: input.turnId,
              reason: "invalid_tool_input_recovery",
            };
            continue;
          }
          yield {
            type: "recovery_exhausted",
            sessionId: input.sessionId,
            turnId: input.turnId,
            reason: "tool_input_loop",
            category: "stuck",
            attempt: consecutiveAllInvalidTurns,
            maxAttempts: MAX_CONSECUTIVE_ALL_INVALID_TURNS,
          };
          const result = this.createTurnResult(input, {
            type: "error",
            stopReason: "tool_error",
            usage,
            permissionDenials,
            turns: turnCount,
            startedAt,
            finalMessage,
            structuredOutput,
            errors: [agentError(
              "agent_tool_error_loop",
              "Repeated invalid tool input after recovery attempts.",
            )],
          });
          yield { type: "turn_failed", sessionId: input.sessionId, turnId: input.turnId, error: result.errors![0]! };
          await captureTurn(result.type === "error");
          yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
          return { result, messages };
        }
      } else {
        consecutiveAllInvalidTurns = 0;
        maxOutputRecoveryCount = 0;
        hasAttemptedOutputRetry = false;
      }

      if (this.config.stopOnStructuredOutput && structuredOutput !== undefined) {
        const result = this.createTurnResult(input, {
          type: "success",
          stopReason: "completed",
          usage,
          permissionDenials,
          turns: turnCount,
          startedAt,
          finalMessage,
          structuredOutput,
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      const nextTurnCount = turnCount + 1;
      if (effectiveMaxTurns && nextTurnCount > effectiveMaxTurns) {
        const result = this.createTurnResult(input, {
          type: "max_turns",
          stopReason: "max_turns",
          usage,
          permissionDenials,
          turns: nextTurnCount,
          startedAt,
          finalMessage,
          structuredOutput,
          errors: [agentError("agent_max_turns_reached", `Reached maximum number of turns (${effectiveMaxTurns}).`)],
        });
        await captureTurn(result.type === "error");
        yield { type: "turn_completed", sessionId: input.sessionId, turnId: input.turnId, result };
        return { result, messages };
      }

      turnCount = nextTurnCount;
      yield { type: "turn_continued", sessionId: input.sessionId, turnId: input.turnId, reason: "next_turn" };
    }
  }

  private async tryReactiveRecover(
    input: AgentLoopInput,
    error: CanonicalModelError,
    messages: CanonicalMessage[],
    hasAttemptedCompact: boolean,
  ): Promise<ContextRecoveryDecision | undefined> {
    const ctx: AgentContextRuntime | undefined = this.dependencies.context;
    if (!ctx?.recoverFromModelError) {
      return undefined;
    }
    try {
      return await ctx.recoverFromModelError({
        sessionId: input.sessionId,
        turnId: input.turnId,
        error,
        messages,
        hasAttemptedCompact,
      });
    } catch {
      // Recovery probe should never block fallback. Pretend the runtime gave up.
      return undefined;
    }
  }

  private async createModelRequest(
    messages: CanonicalMessage[],
    input: AgentLoopInput,
  ): Promise<CanonicalModelRequest> {
    const contextRuntime = this.dependencies.context ?? new NullContextRuntime();
    const planTodo = this.dependencies.planTodoManager?.forSession(input.sessionId);
    let tools = this.dependencies.tools.registry.toCanonicalSchemas();
    if (this.config.permissionMode === "plan") {
      tools = applyPlanModeToolOverrides(tools);
    }
    if (input.capabilityCompletionMode === "consultation") {
      // PD-SAAS-FORK: P0-1 consultation keeps research/analysis tools but exposes no mutation tool.
      tools = tools.filter((tool) => isToolAllowedForCapabilityCompletionMode(
        tool.name,
        input.capabilityCompletionMode,
      ));
    }
    if (
      input.sessionGoalQualityContract
      && input.qualityContractMode === "enforce"
    ) {
      // PD-SAAS-FORK P0-2: enforce the same bounded deny/allow policy in
      // model-visible schemas; ToolRuntime receives the contract as defense.
      tools = tools.filter((tool) => isToolAllowedByQualityContract(
        tool.name,
        input.sessionGoalQualityContract,
        input.qualityContractMode ?? "off",
      ));
    }
    const goalToolPolicy = this.resolveGoalToolPolicy(input);
    if (
      goalToolPolicy.mode === "enforce"
      && goalToolPolicy.officialMediaRequired
    ) {
      // PD-SAAS-FORK P0-6: expose the same allowlist enforced by ToolRuntime.
      tools = tools.filter((tool) => {
        const definition = this.dependencies.tools.registry.get(tool.name);
        return definition
          ? isToolAllowedByGoalToolPolicy(
              tool.name,
              definition.kind,
              goalToolPolicy,
            )
          : false;
      });
    }

    const turnUserGoal = extractDeliverableSessionUserGoal(messages)
      || extractLatestNonSyntheticUserText(messages)
      || "";
    if (
      shouldBlockDeliverableSubagent({
        userGoal: turnUserGoal,
        capabilitySlug: input.capabilityContext?.slug,
        majorCategory: input.capabilityContext?.majorCategory,
        sessionManifest: input.sessionDeliverableManifest,
      })
    ) {
      tools = tools.filter((tool) => !isDeliverableSubagentToolName(tool.name));
    }

  // PD-SAAS-FORK: Hub「试一下」技能锁定 — append to system prompt for this turn only
    const bindingUserGoal = extractDeliverableSessionUserGoal(messages);
    // PD-SAAS-FORK workbench yield P0-B: high-confidence infer when no Hub binding
    if (!input.capabilityContext?.slug?.trim()) {
      const inferResult = resolveInferredCapabilityForTurn({
        userText: bindingUserGoal || extractLatestNonSyntheticUserText(messages) || "",
        mode: inferCapabilityContextMode(),
      });
      recordCapabilityContextInferredTelemetry({
        sessionId: input.sessionId,
        inferred: inferResult.inferred,
        mode: inferResult.mode,
        applied: inferResult.apply,
      });
      if (inferResult.apply && inferResult.inferred) {
        input.capabilityContext = {
          slug: inferResult.inferred.slug,
          displayName: inferResult.inferred.displayName,
          majorCategory: inferResult.inferred.majorCategory,
          source: "inferred",
        };
      }
    }
    const capabilityAppend = input.capabilityContext?.slug
      ? buildCapabilityBindingAppendPrompt(input.capabilityContext, {
          completionMode: input.capabilityCompletionMode,
          manifestPathHints: input.sessionDeliverableManifest?.slots
            .filter((slot) => slot.status !== "removed")
            .flatMap((slot) => slot.pathHints ?? (slot.pathHint ? [slot.pathHint] : [])),
          manifestProfileId: input.sessionDeliverableManifest?.profileId,
          // PD-SAAS-FORK VAP: surface official order whenever compiled, not only enforce.
          officialMediaPolicy:
            input.sessionGoalQualityContract?.officialMediaPolicy,
          allowPlaceholders: input.sessionGoalQualityContract?.allowPlaceholders,
          userGoal: bindingUserGoal,
        })
      : (() => {
          // PD-SAAS-FORK 0731: distill without Hub slug still gets narrow binding
          const distill = resolveDistillExtra(bindingUserGoal);
          return distill
            ? `<capability-binding>${distill}</capability-binding>`
            : undefined;
        })();
    // PD-SAAS-FORK workbench yield P0-A: model-side brief contract (enforce only; SDM already overlaid)
    const briefContractMode = deliverableBriefContractMode();
    const briefContract = compileDeliverableBriefContract({
      userGoal: bindingUserGoal || "",
      capabilitySlug: input.capabilityContext?.slug,
      majorCategory: input.capabilityContext?.majorCategory,
    });
    const briefContractAppend = briefContractMode === "enforce"
      ? buildBriefContractAppendPrompt(briefContract)
      : undefined;
    const mediaStrategyAppend = buildMediaStrategyAppendPrompt(
      extractDeliverableSessionUserGoal(messages),
      input.capabilityContext?.slug,
      this.config.env,
    );
    // PD-SAAS-FORK VAP: Phase-A/B with TTFT soft budget (G3) — prefer existing
    // manifest first; race orchestrator ≤8s; continue discovery in background.
    let visualAssetAppend: string | undefined;
    if (
      visualAssetPlatformMode() !== "off"
      && input.sessionTaskDirectory?.taskArtifactDir
    ) {
      const userGoal = extractDeliverableSessionUserGoal(messages)
        || extractLatestNonSyntheticUserText(messages)
        || "";
      const imageSlots = (input.sessionDeliverableManifest?.slots ?? [])
        .filter((slot) => slot.status !== "removed")
        .map((slot) => ({
          slotId: slot.id,
          label: slot.label,
          pathHint: slot.pathHint ?? slot.pathHints?.[0],
          kind: slot.kind,
        }));
      const sdmFrozen = (input.sessionDeliverableManifest?.slots?.length ?? 0) > 0;
      const language = this.resolvePromptLanguage(input) === "zh-CN" ? "zh-CN" : "en";
      if (
        shouldAutoResolveVisualAssets({
          userGoal,
          capabilitySlug: input.capabilityContext?.slug,
          imageSlots,
        })
      ) {
        try {
          const existing = await loadVisualAssetManifest({
            workspaceRoot: this.config.cwd,
            taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
            sessionId: input.sessionId,
            goalVersion: input.sessionTaskDirectory.goalVersion
              ?? input.sessionDeliverableManifest?.goalVersion,
          });
          const visualAssetBlocks: string[] = [];
          if (existing.assets.length > 0) {
            const hint = buildManifestHintForModel(existing, language);
            if (hint) {
              visualAssetBlocks.push(
                `<visual-asset-manifest>\n${hint}\n</visual-asset-manifest>`,
              );
            }
          }
          const orchestratorInput = {
            workspaceRoot: this.config.cwd,
            sessionId: input.sessionId,
            taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
            userGoal,
            goalVersion: input.sessionTaskDirectory.goalVersion
              ?? input.sessionDeliverableManifest?.goalVersion,
            capabilitySlug: input.capabilityContext?.slug,
            phase: (sdmFrozen ? "phase_b" : "phase_a") as "phase_a" | "phase_b",
            imageSlots: sdmFrozen ? imageSlots : undefined,
            language: language as "zh-CN" | "en",
          };
          // PD-SAAS-FORK VAP: 60s budget when goal has URL/official intent (plan P0-5).
          const budgetMs = resolveVapOrchestratorBudgetMs(userGoal);
          const plan = await Promise.race([
            runVisualAssetOrchestrator(orchestratorInput),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), budgetMs);
            }),
          ]);
          if (plan?.hintForModel) {
            visualAssetBlocks.push(
              `<visual-acquisition-ladder>\n${plan.hintForModel}\n</visual-acquisition-ladder>`,
            );
          } else if (
            !plan
            && existing.assets.length === 0
            // PD-SAAS-FORK: creative prefer-generate — do not inject "forbid generate_image".
            && !isCreativePreferGenActive({
              goal: userGoal,
              slug: input.capabilityContext?.slug,
              env: this.config.env,
            })
          ) {
            visualAssetBlocks.push(
              language === "zh-CN"
                ? "<visual-acquisition-ladder>配图发现进行中（含网页/图片搜索引擎等多渠道），请优先调用 resolve_session_visual_assets(phase_a) 读取 manifest，禁止首轮 fetch 失败就用 generate_image/SVG。</visual-acquisition-ladder>"
                : "<visual-acquisition-ladder>Visual discovery in progress (search engines included). Call resolve_session_visual_assets(phase_a) before generate_image or placeholders.</visual-acquisition-ladder>",
            );
            void runVisualAssetOrchestrator(orchestratorInput).catch(() => undefined);
          }
          if (visualAssetBlocks.length > 0) {
            visualAssetAppend = visualAssetBlocks.join("\n\n");
          }
        } catch {
          // VAP must never block the turn.
        }
      }
    }
    const designCanvasAppend = resolveDesignCanvasAgentAppendFromMessages(messages);
    // PD-SAAS-FORK: PPT intent routing (native editable / Nova aesthetic / doc→ppt) + quality bar.
    const pptExportAppend = resolvePptExportDefaultAppendFromMessages({
      messages,
      capabilitySlug: input.capabilityContext?.slug,
      language: this.resolvePromptLanguage(input) === "zh-CN" ? "zh-CN" : "en",
      enabled: isPptExportDefaultPolicyEnabled(),
    });
    const researchAppend = resolveProcessTemplateAppendFromMessages(
      messages,
      this.resolvePromptLanguage(input),
    );
    const taskDirAppend = input.sessionTaskDirectory
      ? buildTaskArtifactDirPromptXml(input.sessionTaskDirectory)
      : undefined;
    const factualPremiseAppend = buildFactualPremiseSystemAppend(
      extractLatestNonSyntheticUserText(messages)
        || extractDeliverableSessionUserGoal(messages),
    );
    const planAppend = planTodo?.buildPromptAddendum();
    const qualityContractAppend = buildGoalQualityContractPrompt(
      input.sessionGoalQualityContract,
      input.qualityContractMode ?? "off",
    );
    const appendSystemPrompt =
      [factualPremiseAppend, capabilityAppend, briefContractAppend, pptExportAppend, mediaStrategyAppend, visualAssetAppend, designCanvasAppend, researchAppend, taskDirAppend, qualityContractAppend, planAppend].filter(Boolean).join("\n\n") || undefined;

    const trace = getTurnTrace(input.turnId);
    trace?.beginStage("turn.context_prepare");
    const prepared = await contextRuntime.prepareForModel({
      sessionId: input.sessionId,
      turnId: input.turnId,
      cwd: this.config.cwd,
      provider: this.config.provider,
      model: this.config.model,
      permissionMode: this.config.permissionMode,
      additionalWorkingDirectories: this.config.permissionContext.additionalWorkingDirectories,
      messages: cloneMessages(messages),
      tools,
      maxMessages: this.config.maxContextMessages,
      customSystemPrompt: this.config.systemPrompt,
      appendSystemPrompt,
      promptLanguage: this.resolvePromptLanguage(input),
      abortSignal: input.abortSignal,
      // PD-SAAS-FORK: creative prefer-generate degrade block needs goal
      sessionUserGoal: extractDeliverableSessionUserGoal(messages)
        || extractLatestNonSyntheticUserText(messages)
        || undefined,
      capabilitySlug: input.capabilityContext?.slug,
    });
    trace?.endStage("turn.context_prepare");

    this.dispatchLifecycle(input, "InstructionsLoaded", {
      hasSystemPrompt: !!prepared.systemPrompt,
    }).catch(() => {});
    this.dependencies.eventEmitter?.({
      type: "instructions_loaded",
      sessionId: input.sessionId,
      turnId: input.turnId,
      hasSystemPrompt: !!prepared.systemPrompt,
    });

    return {
      provider: this.config.provider,
      model: this.config.model,
      messages: prepared.messages,
      systemPrompt: prepared.systemPrompt ?? this.config.systemPrompt,
      tools: prepared.tools,
      toolChoice: this.config.toolChoice,
      maxOutputTokens: this.config.maxOutputTokens,
      temperature: this.config.temperature,
      thinking: this.config.thinking,
      stream: true,
      metadata: this.config.metadata,
      cacheBreakpoints: prepared.cacheBreakpoints,
    };
  }

  private resolveGoalToolPolicy(input: AgentLoopInput): GoalToolPolicy {
    return input.goalToolPolicy ?? buildGoalToolPolicy({
      contract: input.sessionGoalQualityContract,
      mode: officialMediaV2Mode(),
      workspaceRoot: this.config.cwd,
      taskArtifactDir: input.sessionTaskDirectory?.taskArtifactDir,
      taskGoalVersion: input.sessionTaskDirectory?.goalVersion,
      trustedExecutionScope: input.trustedExecutionScope,
    });
  }

  private resolveOfficialMediaBudget(
    input: AgentLoopInput,
  ): OfficialMediaBudget | undefined {
    if (input.officialMediaBudget) return input.officialMediaBudget;
    const policy = this.resolveGoalToolPolicy(input);
    if (
      policy.mode === "off"
      || (!policy.officialMediaRequired && !policy.officialMediaPreferred)
    ) {
      return undefined;
    }
    const trustedScope = input.trustedExecutionScope ?? {
      tenantScopeId: "local",
      principalScopeId: "local",
    };
    return getOfficialMediaFallbackStateMachine(
      {
        ...trustedScope,
        workspaceRoot: this.config.cwd,
        sessionId: input.sessionId,
        taskRoot:
          input.sessionTaskDirectory?.taskArtifactDir
          ?? "__unassigned_official_media_task__",
        goalVersion: input.sessionTaskDirectory?.goalVersion ?? 1,
      },
      {
        allowPlaceholders: input.sessionGoalQualityContract?.allowPlaceholders
          === true,
      },
    );
  }

  private createToolContext(
    input: AgentLoopInput,
    messages: CanonicalMessage[],
  ): PilotDeckToolRuntimeContext {
    const planDirectoryPath = this.dependencies.planFileManager?.getPlanDirectoryPath();
    const planTodo = this.dependencies.planTodoManager?.forSession(input.sessionId);
    const permissionContext = {
      ...this.config.permissionContext,
      cwd: this.config.cwd,
      ...(planDirectoryPath ? { planDirectoryPath } : {}),
    };
    return {
      sessionId: input.sessionId,
      turnId: input.turnId,
      // Group key for `FileHistoryStore.trackEdit` (C4). Our canonical
      // assistant messages don't carry an id, so the turn id is the closest
      // stable scope: every edit/write produced inside this turn rewinds as
      // a single batch — semantic match to legacy "rewind by messageId".
      messageId: input.turnId,
      cwd: this.config.cwd,
      abortSignal: input.abortSignal,
      subagentTimeoutMs: this.config.subagentTimeoutMs,
      // PD-SAAS-FORK P0-2: tools receive server-derived scope and the same
      // bounded contract used to filter model-visible schemas.
      trustedExecutionScope: input.trustedExecutionScope,
      sessionGoalQualityContract: input.sessionGoalQualityContract,
      qualityContractMode: input.qualityContractMode,
      goalToolPolicy: this.resolveGoalToolPolicy(input),
      officialMediaBudget: this.resolveOfficialMediaBudget(input),
      trustedUserExplicitUrls: input.trustedUserExplicitUrls,
      permissionMode: this.config.permissionMode,
      permissionContext,
      auditRecorder: this.dependencies.auditRecorder,
      now: this.now,
      env: this.config.env,
      maxResultBytes: this.config.maxResultBytes,
      // Tools that need a secondary model call (e.g. `agent` subagents in
      // fallback mode, `web_fetch` extraction) get a thin adapter that
      // funnels into the router's stream so subagents inherit fallback /
      // zero-usage retry.
      model: {
        stream: (request, signal) =>
          this.dependencies.router.stream(request, {
            sessionId: input.sessionId,
            turnId: input.turnId,
            projectPath: this.config.cwd,
            abortSignal: signal,
            isMainAgent: false,
          }),
      },
      elicitation: this.dependencies.elicitation,
      fileHistory: this.dependencies.fileHistory,
      subagentDepth: this.config.subagentDepth ?? 0,
      subagent: this.buildSubagentForkApi(input, messages),
      modelMultimodal: this.config.modelMultimodal,
      maxOutputTokens: this.config.maxOutputTokens,
      readFileState: this.readFileState,
      writeSnapshots: this.writeSnapshots,
      fileUpdateNotifier: this.dependencies.fileUpdateNotifier,
      ...(planTodo ? { planTodo } : {}),
      ...(input.sessionTaskDirectory?.taskArtifactDir
        ? {
            taskArtifactDir: input.sessionTaskDirectory.taskArtifactDir,
            // PD-SAAS-FORK P0-4: bind official media handles to this frozen task generation.
            taskGoalVersion: input.sessionTaskDirectory.goalVersion,
            knownTaskArtifactDirs: input.knownTaskArtifactDirs,
          }
        : {}),
      ...(input.sessionDeliverableManifest
        ? { sessionDeliverableManifest: input.sessionDeliverableManifest }
        : {}),
      ...(planDirectoryPath
        ? {
            planDirectory: {
              path: planDirectoryPath,
              resolve: (filePath: string) =>
                this.dependencies.planFileManager?.resolvePlanFilePath(filePath, this.config.cwd),
              read: (filePath: string) =>
                this.dependencies.planFileManager?.readPlanFile(filePath, this.config.cwd),
            },
          }
        : {}),
    };
  }

  private buildSubagentForkApi(
    input: AgentLoopInput,
    messages: CanonicalMessage[],
  ): PilotDeckSubagentForkApi {
    const depth = this.config.subagentDepth ?? 0;
    const maxDepth = this.config.maxSubagentDepth ?? 1;
    return {
      depth,
      maxSubagentDepth: maxDepth,
      listDefinitions: () =>
        Object.values(SUBAGENT_DEFINITIONS).map((d) => ({
          id: d.id,
          description: d.description,
        })),
      isAllowedDefinition: (id: string) => getSubagentDefinition(id) !== undefined,
      fork: async ({ definitionId, directive, subagentId, abortSignal, timeoutMs }) => {
        // Defer SubAgentSession import to avoid the runtime cycle (sub → loop → sub).
        const { SubAgentSession } = await import("../sub/SubAgentSession.js");
        const def = getSubagentDefinition(definitionId);
        if (!def) throw new Error(`Unknown subagent type: ${definitionId}`);
        const composedAbort = composeAbortSignal({
          parent: abortSignal,
          timeoutMs,
        });

        const subagentSessionId = `${this.config.cwd}::sub::${subagentId}`;
        const transcriptHooks = this.dependencies.subagentTranscript;
        const sidechain = transcriptHooks?.subagentTranscriptResolver?.(subagentId);
        const transcriptRelativePath = sidechain?.transcriptRelativePath ?? "";

        await transcriptHooks?.recordSubagentStarted?.({
          sessionId: input.sessionId,
          turnId: input.turnId,
          subagentId,
          subagentType: def.id,
          prompt: directive,
          transcriptRelativePath,
          subagentSessionId,
        });
        await this.dispatchLifecycle(input, "SubagentStart", {
          subagentId,
          subagentType: def.id,
        });
        this.dependencies.eventEmitter?.({
          type: "subagent_started",
          sessionId: input.sessionId,
          turnId: input.turnId,
          subagentId,
          subagentType: def.id,
        });

        const subSession = new SubAgentSession({
          definition: def,
          directive,
          parentMessages: messages,
          parentConfig: {
            ...this.config,
            subagentDepth: depth + 1,
            isSubagent: true,
          },
          parentDependencies: this.dependencies,
          parentReadFileState: this.readFileState,
          parentWriteSnapshots: this.writeSnapshots,
          parentSessionId: input.sessionId,
          parentTurnId: input.turnId,
          subagentSessionId,
          subagentId,
          abortSignal: composedAbort.signal,
          capabilityContext: input.capabilityContext,
          capabilityCompletionMode: input.capabilityCompletionMode,
          trustedExecutionScope: input.trustedExecutionScope,
          sessionGoalQualityContract: input.sessionGoalQualityContract,
          qualityContractMode: input.qualityContractMode,
          goalToolPolicy: this.resolveGoalToolPolicy(input),
          officialMediaBudget: this.resolveOfficialMediaBudget(input),
          trustedUserExplicitUrls: input.trustedUserExplicitUrls,
          // PD-SAAS-FORK P0-4: a child may discover and localize candidates,
          // but remains bound to the parent's frozen task generation.
          sessionTaskDirectory: input.sessionTaskDirectory,
          knownTaskArtifactDirs: input.knownTaskArtifactDirs,
          sessionDeliverableManifest: input.sessionDeliverableManifest,
          sidechainTranscript: sidechain
            ? {
                recordAcceptedInput: sidechain.recordAcceptedInput.bind(sidechain),
                recordDurableMessage: sidechain.recordDurableMessage.bind(sidechain),
              }
            : undefined,
        });

        let report;
        let errored = false;
        try {
          report = await subSession.run();
          if (composedAbort.timedOut()) {
            throw new Error(`Subagent timed out after ${timeoutMs}ms.`);
          }
        } catch (err) {
          composedAbort.cleanup();
          errored = true;
          await transcriptHooks?.recordSubagentCompleted?.({
            sessionId: input.sessionId,
            turnId: input.turnId,
            subagentId,
            subagentType: def.id,
            summary: err instanceof Error ? err.message : String(err),
            turns: 0,
            durationMs: 0,
            errored: true,
          });
          await this.dispatchLifecycle(input, "SubagentStop", {
            subagentId,
            subagentType: def.id,
            success: false,
          });
          this.dependencies.eventEmitter?.({
            type: "subagent_completed",
            sessionId: input.sessionId,
            turnId: input.turnId,
            subagentId,
            subagentType: def.id,
            success: false,
            durationMs: 0,
          });
          throw err;
        }
        composedAbort.cleanup();

        await transcriptHooks?.recordSubagentCompleted?.({
          sessionId: input.sessionId,
          turnId: input.turnId,
          subagentId,
          subagentType: def.id,
          summary: report.markdown,
          usage: report.usage,
          turns: report.turns,
          durationMs: report.durationMs,
          errored,
        });
        await this.dispatchLifecycle(input, "SubagentStop", {
          subagentId,
          subagentType: def.id,
          success: !errored,
        });
        this.dependencies.eventEmitter?.({
          type: "subagent_completed",
          sessionId: input.sessionId,
          turnId: input.turnId,
          subagentId,
          subagentType: def.id,
          success: !errored,
          durationMs: report.durationMs,
        });

        return {
          markdown: report.markdown,
          usage: report.usage,
          turns: report.turns,
          durationMs: report.durationMs,
          parsed: report.parsed as unknown as Record<string, string> | undefined,
        };
      },
    };
  }

  private async dispatchLifecycle(
    input: AgentLoopInput,
    event: PilotDeckHookEvent,
    payload: Record<string, unknown>,
  ): Promise<LifecycleDispatchResult> {
    return this.dependencies.lifecycle?.dispatch({
      event,
      baseInput: {
        sessionId: input.sessionId,
        transcriptPath: "",
        cwd: this.config.cwd,
        permissionMode: this.config.permissionMode,
      },
      payload,
      matchQuery: event,
      signal: input.abortSignal,
      env: this.config.env,
    }) ?? {
      effects: [],
      messages: [],
      events: [],
      blockingErrors: [],
      nonBlockingErrors: [],
    };
  }

  private *drainEventBuffer(): Generator<AgentEvent> {
    const events = this.dependencies.drainEvents?.() ?? [];
    for (const event of events) {
      yield event;
    }
  }

  private async *executeToolsWithEventPump(
    toolCalls: CanonicalToolCall[],
    context: PilotDeckToolRuntimeContext,
    input: AgentLoopInput,
  ): AsyncGenerator<AgentEvent, PilotDeckToolResult[], unknown> {
    const activeSubagents = new Map<string, ActiveSubagentStatus>();
    let results: PilotDeckToolResult[] | undefined;
    let error: unknown;
    let settled = false;

    // PD-SAAS-FORK (P1-F, flag-gated): single-tool watchdog. Observe the batch against the largest
    // per-tool deadline and record ONE timeout event if it overruns. Non-destructive: we never abort
    // an in-flight tool here (that could corrupt a half-written deliverable); the signal feeds
    // telemetry + the stale-turn watchdog. Flag OFF => no timing math, no events.
    const watchdogEnabled = isToolWatchdogEnabled();
    const watchdogStartedAt = Date.now();
    const watchdogBudgetMs = watchdogEnabled
      ? maxBatchDeadlineMsForToolCalls(
        toolCalls.map((call) => ({ name: call.name, input: call.input as Record<string, unknown> | undefined })),
        resolveToolWatchdogConfig(),
      )
      : 0;
    let watchdogTimedOut = false;

    const execution = this.dependencies.tools.scheduler.executeAll(toolCalls, context)
      .then((value) => {
        results = value;
      }, (err) => {
        error = err;
      })
      .finally(() => {
        settled = true;
      });

    while (!settled) {
      await Promise.race([execution, sleep(TOOL_EVENT_PUMP_INTERVAL_MS)]);
      yield* this.drainToolEventBufferForSubagentStatus(input, activeSubagents);
      if (!settled) {
        yield* this.emitSubagentHeartbeats(input, activeSubagents);
        if (
          watchdogEnabled
          && !watchdogTimedOut
          && decideWatchdogVerdict(Date.now() - watchdogStartedAt, watchdogBudgetMs, resolveToolWatchdogConfig()) === "timeout"
        ) {
          watchdogTimedOut = true;
          recordStabilityEvent({
            event: "tool_watchdog_timeout",
            sessionId: input.sessionId,
            turnId: input.turnId,
            detail: {
              budgetMs: watchdogBudgetMs,
              elapsedMs: Date.now() - watchdogStartedAt,
              tools: toolCalls.map((call) => call.name).slice(0, 8).join(","),
            },
          });
        }
      }
    }

    // PD-SAAS-FORK: taskStageBudget observe (shadow). Same-batch tools share max elapsed. Never abort write_file.
    const batchElapsedMs = Date.now() - watchdogStartedAt;
    const observedStages = new Set(toolCalls.map((call) => mapToolNameToStage(call.name)));
    for (const stage of observedStages) {
      observeTaskStage({
        sessionId: input.sessionId,
        stage,
        elapsedMs: batchElapsedMs,
        retryCount: 0,
        verifiedNet: 0,
      });
    }

    yield* this.drainToolEventBufferForSubagentStatus(input, activeSubagents);
    if (error) throw error;
    return results ?? [];
  }

  private *drainToolEventBufferForSubagentStatus(
    input: AgentLoopInput,
    activeSubagents: Map<string, ActiveSubagentStatus>,
  ): Generator<AgentEvent> {
    const events = this.dependencies.drainEvents?.() ?? [];
    for (const event of events) {
      const statusEvent = this.updateSubagentStatusFromEvent(input, activeSubagents, event);
      yield event;
      if (statusEvent) {
        yield statusEvent;
      }
    }
  }

  private updateSubagentStatusFromEvent(
    input: AgentLoopInput,
    activeSubagents: Map<string, ActiveSubagentStatus>,
    event: AgentEvent,
  ): AgentEvent | undefined {
    if (event.type === "subagent_started") {
      const nowMs = this.now().getTime();
      activeSubagents.set(event.subagentId, {
        subagentId: event.subagentId,
        subagentType: event.subagentType,
        startedAtMs: nowMs,
        lastHeartbeatMs: nowMs,
      });
      return undefined;
    }

    if (event.type === "subagent_completed") {
      activeSubagents.delete(event.subagentId);
      return undefined;
    }

    if (event.type !== "pre_tool_execute" && event.type !== "post_tool_execute") {
      return undefined;
    }

    const subagentId = subagentIdFromSessionId(event.sessionId);
    if (!subagentId) {
      return undefined;
    }

    const nowMs = this.now().getTime();
    const state = activeSubagents.get(subagentId) ?? {
      subagentId,
      startedAtMs: nowMs,
      lastHeartbeatMs: nowMs,
    };
    if (event.type === "pre_tool_execute") {
      state.currentToolCallId = event.toolCallId;
      state.currentToolName = event.toolName;
    } else {
      state.currentToolCallId = undefined;
      state.currentToolName = undefined;
    }
    state.lastHeartbeatMs = nowMs;
    activeSubagents.set(subagentId, state);

    return {
      type: "subagent_status",
      sessionId: input.sessionId,
      turnId: input.turnId,
      subagentId,
      subagentType: state.subagentType,
      status: event.type === "pre_tool_execute" ? "tool_started" : "tool_completed",
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      ...(event.type === "post_tool_execute" ? { success: event.success } : {}),
      durationMs: Math.max(0, nowMs - state.startedAtMs),
    };
  }

  private *emitSubagentHeartbeats(
    input: AgentLoopInput,
    activeSubagents: Map<string, ActiveSubagentStatus>,
  ): Generator<AgentEvent> {
    const nowMs = this.now().getTime();
    for (const state of activeSubagents.values()) {
      if (nowMs - state.lastHeartbeatMs < SUBAGENT_STATUS_HEARTBEAT_MS) {
        continue;
      }
      state.lastHeartbeatMs = nowMs;
      yield {
        type: "subagent_status",
        sessionId: input.sessionId,
        turnId: input.turnId,
        subagentId: state.subagentId,
        subagentType: state.subagentType,
        status: state.currentToolName ? "running" : "waiting_model",
        toolCallId: state.currentToolCallId,
        toolName: state.currentToolName,
        durationMs: Math.max(0, nowMs - state.startedAtMs),
      };
    }
  }

  private createTurnResult(
    input: AgentLoopInput,
    options: Omit<AgentTurnResult, "sessionId" | "turnId" | "completedAt">,
  ): AgentTurnResult {
    return {
      ...options,
      sessionId: input.sessionId,
      turnId: input.turnId,
      completedAt: this.now().toISOString(),
    };
  }

  private applyPermissionOverrides(
    permissionMode?: PermissionMode,
    permissionRules?: Partial<PermissionRuleSet>,
    basePermissionMode?: PermissionMode,
  ): void {
    if (permissionMode) {
      if (permissionMode === "plan" && this.config.permissionMode !== "plan") {
        this.config.permissionModeBeforePlan = basePermissionMode ?? this.config.permissionMode;
      }
      this.config.permissionMode = permissionMode;
      this.config.permissionContext.mode = permissionMode;
    }
    if (!permissionRules) return;
    mergeUserRules(this.config.permissionContext.rules.allow, permissionRules.allow);
    mergeUserRules(this.config.permissionContext.rules.deny, permissionRules.deny);
    mergeUserRules(this.config.permissionContext.rules.ask, permissionRules.ask);
  }

  private readonly now = (): Date => this.dependencies.now?.() ?? new Date();
}

function applyPlanModeToolOverrides(tools: CanonicalToolSchema[]): CanonicalToolSchema[] {
  const override = buildPlanModeAgentToolSchema();
  return tools.map((tool) => {
    if (tool.name !== "agent") return tool;
    return { ...tool, description: override.description, inputSchema: override.inputSchema };
  });
}

function mergeUserRules(target: PermissionRule[], userRules: PermissionRule[] | undefined): void {
  const nonUserRules = target.filter((rule) => rule.source !== "user");
  target.splice(0, target.length, ...nonUserRules, ...(userRules ?? []));
}

function findLifecycleBlock(result: LifecycleDispatchResult): { reason: string; stopReason?: string } | undefined {
  return result.effects.find(
    (effect): effect is { type: "block"; reason: string; stopReason?: string } => effect.type === "block",
  );
}

function findToolLifecycleBlock(results: PilotDeckToolResult[]): { reason: string; stopReason?: string } | undefined {
  for (const result of results) {
    const lifecycle = result.metadata?.lifecycle;
    if (isRecord(lifecycle) && isRecord(lifecycle.blocked) && typeof lifecycle.blocked.reason === "string") {
      return {
        reason: lifecycle.blocked.reason,
        stopReason: typeof lifecycle.blocked.stopReason === "string" ? lifecycle.blocked.stopReason : undefined,
      };
    }
  }
  return undefined;
}

function shouldInjectUserActionRequiredNotice(
  blocker: NonNullable<ReturnType<typeof classifyUserActionBlocker>>,
  userGoal: string,
): boolean {
  if (
    shouldBypassOptionalMissingKeyBlocker(blocker, { userGoal })
  ) {
    return false;
  }
  if (blocker.type !== "missing_key") return true;
  if (!isSocialMatrixGoal(userGoal)) return true;
  const service = blocker.serviceId ?? "";
  return service === "yixiaoer";
}

function textFromMessage(message: CanonicalMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export function extractLatestNonSyntheticUserText(messages: CanonicalMessage[]): string {
  let continuationFallback = "";
  let clarificationAnswer = "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (message.metadata?.synthetic) continue;
    const text = stripLaunchContextAndAttachmentBlocks(textFromMessage(message)).trim();
    if (!text) continue;
    if (isAcceptanceRepairPromptText(text)) continue;
    if (isContinuationOnlyUserText(text)) {
      continuationFallback ||= text;
      continue;
    }
    if (isTaskFollowUpComplaintText(text)) {
      continuationFallback ||= text;
      continue;
    }
    if (isAmbiguousFollowUpText(text)) {
      continuationFallback ||= text;
      continue;
    }
    if (isShortClarificationAnswerText(text)) {
      clarificationAnswer ||= text;
      continue;
    }
    if (clarificationAnswer && userGoalImpliesDeliverable(text)) {
      return `${text}\n补充：${clarificationAnswer}`;
    }
    return text;
  }
  const sessionGoal = extractDeliverableSessionUserGoal(messages);
  if (sessionGoal) return stripLaunchContextAndAttachmentBlocks(sessionGoal).trim();
  return stripLaunchContextAndAttachmentBlocks(clarificationAnswer || continuationFallback).trim();
}

export { extractDeliverableSessionUserGoal } from "../../saas/deliverableSessionGoal.js";

function isAcceptanceRepairPromptText(text: string): boolean {
  const normalized = String(text ?? "").trim();
  return /^最终交付验收未通过。不要询问用户/.test(normalized)
    && /(?:原始用户目标|已通过验收的成果|缺失成果|下一步要求)/.test(normalized);
}

function classifyAskUserQuestionToolCalls(toolCalls: CanonicalToolCall[]): {
  kind: "preference" | "required" | "none";
  hasDefaultOption: boolean;
} {
  let hasPreference = false;
  let hasDefaultOption = false;
  for (const call of toolCalls) {
    const name = String(call.name ?? "");
    if (name !== ASK_USER_QUESTION_TOOL_NAME && name !== "AskUserQuestion") continue;
    const policy = classifyAskUserQuestionPolicy(extractAskUserQuestionInput(call.input));
    if (policy.kind === "required") {
      return policy;
    }
    hasPreference = true;
    hasDefaultOption ||= policy.hasDefaultOption;
  }
  return hasPreference ? { kind: "preference", hasDefaultOption } : { kind: "none", hasDefaultOption: false };
}

function extractAskUserQuestionInput(input: unknown): {
  question?: string;
  options?: string[];
  hasDefaultOption?: boolean;
} {
  if (!isRecord(input)) {
    return {};
  }
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const questionText: string[] = [];
  const options: string[] = [];
  for (const item of questions) {
    if (!isRecord(item)) continue;
    if (typeof item.question === "string") questionText.push(item.question);
    if (typeof item.header === "string") questionText.push(item.header);
    const rawOptions = Array.isArray(item.options) ? item.options : [];
    for (const option of rawOptions) {
      if (typeof option === "string") {
        options.push(option);
      } else if (isRecord(option)) {
        if (typeof option.label === "string") options.push(option.label);
        if (typeof option.description === "string") options.push(option.description);
      }
    }
  }
  return {
    question: questionText.join("\n"),
    options,
    hasDefaultOption: isRecord(input.metadata) && input.metadata.hasDefaultOption === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneReadFileStateMap(
  state: PilotDeckReadFileStateMap | undefined,
): PilotDeckReadFileStateMap {
  const out: PilotDeckReadFileStateMap = new Map();
  if (!state) return out;
  for (const [key, value] of state.entries()) {
    out.set(key, { ...value });
  }
  return out;
}

function cloneWriteSnapshotMap(
  state: PilotDeckWriteSnapshotMap | undefined,
): PilotDeckWriteSnapshotMap {
  const out: PilotDeckWriteSnapshotMap = new Map();
  if (!state) return out;
  for (const [key, value] of state.entries()) {
    out.set(key, { ...value });
  }
  return out;
}

function subagentIdFromSessionId(sessionId: string): string | undefined {
  const marker = "::sub::";
  const index = sessionId.lastIndexOf(marker);
  if (index < 0) return undefined;
  const subagentId = sessionId.slice(index + marker.length).trim();
  return subagentId.length > 0 ? subagentId : undefined;
}

const OUTPUT_TOKEN_RETRY_DEFAULT = 4_096;
const OUTPUT_TOKEN_RETRY_CEILING = 64_000;

/** Keep only the trailing `keepRatio` portion of the message history. */
function truncateHeadKeepRatio(messages: CanonicalMessage[], keepRatio: number): CanonicalMessage[] {
  const ratio = Math.max(0.05, Math.min(1, keepRatio));
  const keep = Math.max(1, Math.floor(messages.length * ratio));
  return messages.slice(-keep);
}

/**
 * Drop the trailing `[assistant_message_with_partial_tool_call,
 * synthetic_tool_result]` pair the loop just appended on a model error so a
 * retry doesn't replay an unfinished tool call. Safe no-op if the trailing
 * shape doesn't match.
 */
function stripTrailingErrorPair(messages: CanonicalMessage[]): CanonicalMessage[] {
  const out = [...messages];
  const last = out[out.length - 1];
  if (
    last &&
    last.role === "user" &&
    last.content.every((block) => block.type === "tool_result")
  ) {
    out.pop();
  }
  const newLast = out[out.length - 1];
  if (newLast && newLast.role === "assistant") {
    out.pop();
  }
  return out;
}

/** Remove the last assistant prose bubble before synthetic auto-continue (give-up stops). */
function stripTrailingAssistantTextBubble(messages: CanonicalMessage[]): void {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant") {
    messages.pop();
  }
}

/**
 * Strip all image blocks from messages, replacing them with a text placeholder.
 * Used as a recovery strategy when a multimodal processor fails on corrupted images.
 */
function stripImagesFromMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  return sanitizeMessagesForModel(messages, { input: ["text"] });
}

function collectPermissionDenials(results: PilotDeckToolResult[]): AgentPermissionDenial[] {
  return results.flatMap((result) => {
    if (
      result.type === "error" &&
      (result.error.code === "permission_denied" ||
        result.error.code === "permission_required" ||
        result.error.code === "permission_cancelled")
    ) {
      return [
        {
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          errorCode: result.error.code,
        },
      ];
    }
    return [];
  });
}

function mergeUsage(first: CanonicalUsage, second: CanonicalUsage | undefined): CanonicalUsage {
  if (!second) {
    return first;
  }
  return {
    inputTokens: add(first.inputTokens, second.inputTokens),
    outputTokens: add(first.outputTokens, second.outputTokens),
    cacheReadTokens: add(first.cacheReadTokens, second.cacheReadTokens),
    cacheWriteTokens: add(first.cacheWriteTokens, second.cacheWriteTokens),
    totalTokens: add(first.totalTokens, second.totalTokens),
  };
}

function add(first: number | undefined, second: number | undefined): number | undefined {
  if (first === undefined && second === undefined) {
    return undefined;
  }
  return (first ?? 0) + (second ?? 0);
}

function countDistinctManifestStages(
  manifest: SessionDeliverableManifest | undefined,
): number {
  if (!manifest?.slots?.length) return 1;
  const stageIds = new Set(
    manifest.slots
      .map((slot) => slot.stageId)
      .filter((stageId): stageId is string => Boolean(stageId)),
  );
  return Math.max(1, stageIds.size);
}

function resolveManifestStageIndex(
  manifest: SessionDeliverableManifest | undefined,
): number {
  if (!manifest?.currentStageId || !manifest.slots?.length) return 0;
  const stageIds = [...new Set(
    manifest.slots
      .map((slot) => slot.stageId)
      .filter((stageId): stageId is string => Boolean(stageId)),
  )];
  const index = stageIds.indexOf(manifest.currentStageId);
  return index >= 0 ? index : 0;
}

function resolveToolRecoveryStageCap(
  manifest: SessionDeliverableManifest | undefined,
  recoveryBudget: RecoveryBudget,
): number | null {
  const totalStages = countDistinctManifestStages(manifest);
  if (totalStages <= 1) return null;
  return resolveStageRecoveryBudget({
    stageIndex: resolveManifestStageIndex(manifest),
    totalStages,
    globalRemaining: recoveryBudget.remaining(),
    perStageMax: DEFAULT_STAGE_RECOVERY_BUDGET,
  });
}

function readRequestedMode(value: unknown): AgentRuntimeConfig["permissionMode"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const requestedMode = (value as Record<string, unknown>).requestedMode;
  return isPermissionMode(requestedMode) ? requestedMode : undefined;
}

function isPermissionMode(value: unknown): value is AgentRuntimeConfig["permissionMode"] {
  return (
    value === "default" ||
    value === "plan" ||
    value === "acceptEdits" ||
    value === "bypassPermissions" ||
    value === "dontAsk"
  );
}

function classifyModelError(error: CanonicalModelError): {
  stopReason: AgentTurnResult["stopReason"];
  error: ReturnType<typeof agentError>;
} {
  if (isPromptTooLong(error)) {
    return {
      stopReason: "prompt_too_long",
      error: agentError("agent_prompt_too_long", error.message, error),
    };
  }
  return {
    stopReason: "model_error",
    error: agentError("agent_model_error", error.message, error),
  };
}

function isPromptTooLong(error: CanonicalModelError): boolean {
  if (error.code === "prompt_too_long" || error.recoverableViaCompact) {
    return true;
  }
  if (PROMPT_TOO_LONG_ANTHROPIC_PATTERN.test(error.message)) {
    return true;
  }
  if (PROMPT_TOO_LONG_OPENAI_PATTERN.test(error.message)) {
    return true;
  }
  if (REQUEST_TOO_LARGE_PATTERN.test(error.message)) {
    return true;
  }
  return false;
}

function composeAbortSignal(args: {
  parent?: AbortSignal;
  timeoutMs?: number;
}): { signal: AbortSignal | undefined; cleanup: () => void; timedOut: () => boolean } {
  const { parent, timeoutMs } = args;
  if (!parent && (!timeoutMs || timeoutMs <= 0)) {
    return { signal: undefined, cleanup: () => {}, timedOut: () => false };
  }
  const controller = new AbortController();
  const cleanupFns: Array<() => void> = [];
  let timedOut = false;
  if (parent) {
    if (parent.aborted) {
      controller.abort(parent.reason);
    } else {
      const onAbort = () => controller.abort(parent.reason);
      parent.addEventListener("abort", onAbort, { once: true });
      cleanupFns.push(() => parent.removeEventListener("abort", onAbort));
    }
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0 && !controller.signal.aborted) {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`Subagent timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    cleanupFns.push(() => clearTimeout(timeout));
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      for (const fn of cleanupFns) fn();
    },
    timedOut: () => timedOut,
  };
}
