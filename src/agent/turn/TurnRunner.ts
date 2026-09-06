import { agentError, normalizeAgentError } from "../protocol/errors.js";
import type { AgentEvent } from "../protocol/events.js";
import type { AgentInput } from "../protocol/input.js";
import type { AgentTurnResult } from "../protocol/result.js";
import type { AgentLoop, AgentLoopSeedState } from "../loop/AgentLoop.js";
import type { AgentTranscriptWriter } from "../../session/transcript/TranscriptWriter.js";
import { TurnInputProcessor } from "./TurnInputProcessor.js";
import type { CanonicalMessage, CanonicalUsage } from "../../model/index.js";
import type { LifecycleRuntime } from "../../lifecycle/index.js";
import type { PermissionMode, PermissionRuleSet } from "../../permission/index.js";
import type { AgentTranscriptWriterState } from "../../session/transcript/TranscriptWriter.js";
import type { CapabilityBindingContext } from "../protocol/input.js";
import { resolveResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";
import { bootstrapSessionDeliverableManifest } from "../../session/transcript/bootstrapSessionDeliverableManifest.js";
import { bootstrapSessionGoalQualityContract } from "../../session/transcript/bootstrapSessionGoalQualityContract.js";
import { bootstrapSessionTaskDirectory } from "../../session/transcript/bootstrapSessionTaskDirectory.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import type { SessionTaskDirectory } from "../../saas/taskState/sessionTaskDirectory.js";
import type { SessionGoalQualityContract } from "../../saas/constraints/goalQualityContract.js";
import type { TrustedExecutionScope } from "../../saas/constraints/capabilityScopeContract.js";
import {
  buildBoundedQualityShadowDiff,
  resolveQualityCanaryPolicy,
  type BoundedQualityShadowDiff,
  type QualityContractMode,
} from "../../saas/constraints/qualityCanaryPolicy.js";
import {
  resolveExactCapabilityGoalQualityPolicy,
} from "../../saas/constraints/capabilityGoalQualityPolicy.js";
import { textFromUserMessages } from "../../session/transcript/bootstrapSessionDeliverableManifest.js";
import {
  attachSessionTaskDirectoryToManifest,
  slimSessionManifestForWire,
} from "../../saas/taskState/sessionDeliverableManifest.js";
import { readFile } from "node:fs/promises";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import {
  collectSessionKnownTaskDirs,
  resolvePrimaryTaskArtifactDir,
} from "../../saas/taskState/resolvePrimaryTaskArtifactDir.js";
import {
  isCapabilityScopeV2EnforcedForSlug,
  isStdaAddPreserveRootEnabled,
} from "../../saas/resilience/stabilityFlags.js";
import {
  resolveCapabilityCompletionMode,
  type CapabilityCompletionMode,
} from "../../saas/intent/capabilityCompletionMode.js";
import { resolveCurrentIntent } from "../../saas/intent/resolveCurrentIntent.js";
import type { TurnInteractionMode } from "../../saas/intent/turnInteractionMode.js";
import { recordCapabilityScopeShadowTelemetry } from "../../saas/intent/capabilityScopeShadowTelemetry.js";
import {
  acceptedInputReplayMetadataMatches,
  markAcceptedInputMessages,
  replaceMatchingUnresolvedAcceptedInput,
  shouldSkipGatewayAcceptedInputWrite,
} from "../../session/transcript/acceptedInputDedup.js";
import type { AcceptedInputRef } from "../../session/transcript/acceptedInputDedup.js";
import type {
  AcceptedInputAttachmentDescriptor,
} from "../../session/transcript/acceptedInputIdentity.js";
import { sanitizeAcceptedInputMessagesForDurability } from "../../session/transcript/acceptedInputIdentity.js";
import { extractTrustedUserExplicitUrls } from "../../saas/media/officialSourceClassifier.js";

export type TurnRunnerOptions = {
  sessionId: string;
  turnId: string;
  messages: CanonicalMessage[];
  input: AgentInput;
  maxTurns?: number;
  permissionMode?: PermissionMode;
  /** The user's actual permission preference before plan-mode override. */
  basePermissionMode?: PermissionMode;
  permissionRules?: Partial<PermissionRuleSet>;
  /** PD-SAAS-FORK: Hub「试一下」隐式技能绑定，仅本 turn 注入 system prompt */
  capabilityContext?: CapabilityBindingContext;
  /** PD-SAAS-FORK: UI language for work-language prompt and recovery copy. */
  promptLanguage?: "en" | "zh-CN";
  /** PD-SAAS-FORK: Bridge turn-queue pre-wrote accepted_input — skip Gateway duplicate. */
  acceptedInputRef?: AcceptedInputRef;
  /** PD-SAAS-FORK: Gateway-computed current input identity. */
  acceptedInputFingerprint?: string;
  /** PD-SAAS-FORK: safe attachment references for durable replay. */
  acceptedInputAttachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  /** PD-SAAS-FORK: stable queue request id used by durable completion receipts. */
  queueItemId?: string;
  /** PD-SAAS-FORK P0-2: server-derived tenant/principal scope; never prompt-derived. */
  trustedExecutionScope?: TrustedExecutionScope;
  /** PD-SAAS-FORK: N2 Bot steward sessionKind skip SDM / STDA. */
  sessionKind?: string | null;
  abortSignal?: AbortSignal;
};

export type TurnRunnerResult = {
  result: AgentTurnResult;
  messages: CanonicalMessage[];
};

export type TurnRunnerRuntimeContext = {
  cwd: string;
  transcriptPath: string;
};

export type TurnRunnerRuntimeReloadSnapshot = {
  runtimeContext: TurnRunnerRuntimeContext;
  transcriptWriterState?: AgentTranscriptWriterState;
};

export class TurnRunner {
  constructor(
    private readonly loop: AgentLoop,
    private readonly transcript: AgentTranscriptWriter,
    private readonly inputProcessor = new TurnInputProcessor(),
    private readonly now: () => Date = () => new Date(),
    private readonly lifecycle?: LifecycleRuntime,
    private readonly runtimeContext: TurnRunnerRuntimeContext = {
      cwd: process.cwd(),
      transcriptPath: "",
    },
  ) {}

  async *run(options: TurnRunnerOptions): AsyncGenerator<AgentEvent, TurnRunnerResult, unknown> {
    yield { type: "turn_started", sessionId: options.sessionId, turnId: options.turnId };
    const accepted = this.inputProcessor.accept(options.input);
    const acceptedMessages = options.acceptedInputRef && options.acceptedInputFingerprint
      ? markAcceptedInputMessages(accepted.messages, {
          sessionId: options.sessionId,
          acceptedInputRef: options.acceptedInputRef,
          inputFingerprint: options.acceptedInputFingerprint,
          attachmentDescriptors: options.acceptedInputAttachmentDescriptors,
          synthetic: false,
        })
      : accepted.messages;
    let historicalMessages = options.messages;

    try {
      const skipAcceptedInput = await shouldSkipGatewayAcceptedInputWrite({
        transcriptPath: this.runtimeContext.transcriptPath,
        sessionId: options.sessionId,
        turnId: options.turnId,
        acceptedInputRef: options.acceptedInputRef,
        inputFingerprint: options.acceptedInputFingerprint,
      });
      if (skipAcceptedInput && options.acceptedInputRef) {
        historicalMessages = options.acceptedInputFingerprint
          ? options.messages.filter((message) => !acceptedInputReplayMetadataMatches(message, {
              sessionId: options.sessionId,
              acceptedInputRef: options.acceptedInputRef as AcceptedInputRef,
              inputFingerprint: options.acceptedInputFingerprint as string,
            }))
          : options.messages;
        const writerState = this.transcript.snapshotState?.();
        if (
          writerState
          && (
            writerState.sequence < options.acceptedInputRef.sequence
            || (
              writerState.sequence === options.acceptedInputRef.sequence
              && writerState.lastEntryId !== options.acceptedInputRef.entryId
            )
          )
          && typeof this.transcript.restoreState === "function"
        ) {
          // PD-SAAS-FORK (P0-7): cached sessions must advance past the external Bridge row.
          this.transcript.restoreState(
            options.acceptedInputRef.sequence,
            options.acceptedInputRef.entryId,
          );
        }
      } else {
        const fallback = options.acceptedInputFingerprint || options.acceptedInputRef
          ? replaceMatchingUnresolvedAcceptedInput(options.messages, {
              sessionId: options.sessionId,
              inputFingerprint: options.acceptedInputFingerprint,
              acceptedInputRef: options.acceptedInputRef,
            })
          : { messages: options.messages };
        historicalMessages = fallback.messages;
        await this.transcript.recordAcceptedInput(
          options.sessionId,
          options.turnId,
          sanitizeAcceptedInputMessagesForDurability(acceptedMessages),
          {
            inputFingerprint: options.acceptedInputFingerprint,
            attachmentDescriptors: options.acceptedInputAttachmentDescriptors,
            logicalInputEntryId: fallback.replacedAcceptedInputRef?.entryId,
            queueItemId: options.queueItemId,
          },
        );
      }
    } catch (error) {
      const agentTranscriptError = agentError("agent_transcript_error", "Failed to record accepted input.", error);
      const result = this.createErrorResult(options, agentTranscriptError);
      yield { type: "turn_failed", sessionId: options.sessionId, turnId: options.turnId, error: agentTranscriptError };
      yield { type: "turn_completed", sessionId: options.sessionId, turnId: options.turnId, result };
      return { result, messages: options.messages };
    }
    const messages = [...historicalMessages, ...acceptedMessages];
    const prompt = inputToPromptText(options.input);
    // PD-SAAS-FORK P0-3: only the current accepted user input can establish
    // explicit-URL L0 evidence; history/model text cannot forge this list.
    const trustedUserExplicitUrls = extractTrustedUserExplicitUrls(prompt);
    // PD-SAAS-FORK: P0-1 derives file completion from this real input only;
    // historical dialogue/execute intent must not silently create a contract.
    let capabilityCompletionMode: CapabilityCompletionMode | undefined =
      isCapabilityScopeV2EnforcedForSlug(options.capabilityContext?.slug)
        ? resolveCapabilityCompletionMode({
            capabilityContext: options.capabilityContext,
            userText: prompt,
          })
        : undefined;

    const turnInteraction = resolveCurrentIntent({
      userText: prompt,
      capabilityContext: options.capabilityContext,
      promptLanguage: options.promptLanguage,
    });
    const turnInteractionMode: TurnInteractionMode = turnInteraction.mode;

    let sessionDeliverableManifest: SessionDeliverableManifest | undefined;
    let previousSessionDeliverableManifest: SessionDeliverableManifest | undefined;
    let sessionTaskDirectory: SessionTaskDirectory | undefined;
    const trustedExecutionScope = options.trustedExecutionScope ?? {
      tenantScopeId: "local",
      principalScopeId: "local",
    };
    const qualityCanary = resolveQualityCanaryPolicy({
      capabilitySlug: options.capabilityContext?.slug,
      trustedScope: trustedExecutionScope,
    });
    let qualityContractMode: QualityContractMode =
      qualityCanary.effectiveMode;
    let sessionGoalQualityContract: SessionGoalQualityContract | undefined;
    let qualityContractHash: string | undefined;
    let qualityContractShadowDiff: BoundedQualityShadowDiff | undefined;
    if (qualityContractMode !== "off") {
      try {
        const jointBootstrap =
          await bootstrapSessionGoalQualityContract({
            sessionId: options.sessionId,
            turnId: options.turnId,
            acceptedMessages: accepted.messages,
            transcript: this.transcript,
            transcriptPath: this.runtimeContext.transcriptPath,
            capabilityContext: options.capabilityContext,
            capabilityCompletionMode,
            exactCapabilityPolicy: resolveExactCapabilityGoalQualityPolicy({
              capabilitySlug: options.capabilityContext?.slug,
              userGoal: textFromUserMessages(accepted.messages),
            }),
          });
        sessionDeliverableManifest = jointBootstrap.manifest;
        previousSessionDeliverableManifest =
          jointBootstrap.previousManifest;
        capabilityCompletionMode =
          jointBootstrap.completionMode ?? capabilityCompletionMode;
        sessionGoalQualityContract =
          jointBootstrap.qualityContract.contract;
        qualityContractHash = jointBootstrap.qualityContractHash;
        qualityContractShadowDiff = qualityContractMode === "shadow"
          ? buildBoundedQualityShadowDiff(sessionGoalQualityContract)
          : undefined;
        if (
          jointBootstrap.manifestVersionChanged
          && jointBootstrap.manifest
        ) {
          yield {
            type: "session_manifest_updated",
            sessionId: options.sessionId,
            turnId: options.turnId,
            sessionManifest: slimSessionManifestForWire(
              jointBootstrap.manifest,
            ),
          };
        }
      } catch (error) {
        // PD-SAAS-FORK P0-2: persistence/version barrier failure is a
        // recoverable stop before model or tool execution, never best-effort.
        const bootstrapError = agentError(
          "agent_transcript_error",
          "Failed to persist the session quality contract.",
          error,
        );
        const result = this.createErrorResult(options, bootstrapError);
        yield {
          type: "turn_failed",
          sessionId: options.sessionId,
          turnId: options.turnId,
          error: bootstrapError,
        };
        yield {
          type: "turn_completed",
          sessionId: options.sessionId,
          turnId: options.turnId,
          result,
        };
        return { result, messages: options.messages };
      }
    } else {
      try {
        const bootstrapResult = await bootstrapSessionDeliverableManifest({
          sessionId: options.sessionId,
          turnId: options.turnId,
          acceptedMessages: accepted.messages,
          transcript: this.transcript,
          transcriptPath: this.runtimeContext.transcriptPath,
          capabilityContext: options.capabilityContext,
          capabilityCompletionMode,
          sessionKind: options.sessionKind,
        });
        sessionDeliverableManifest = bootstrapResult.manifest;
        previousSessionDeliverableManifest =
          bootstrapResult.previousManifest;
        capabilityCompletionMode =
          bootstrapResult.completionMode ?? capabilityCompletionMode;
        if (bootstrapResult.versionChanged && bootstrapResult.manifest) {
          yield {
            type: "session_manifest_updated",
            sessionId: options.sessionId,
            turnId: options.turnId,
            sessionManifest: slimSessionManifestForWire(
              bootstrapResult.manifest,
            ),
          };
        }
      } catch {
        // Legacy SDM path remains best-effort while the quality canary is off.
      }
    }

    recordCapabilityScopeShadowTelemetry({
      sessionId: options.sessionId,
      turnId: options.turnId,
      capabilitySlug: options.capabilityContext?.slug,
      majorCategory: options.capabilityContext?.majorCategory,
      userText: prompt,
      previousManifest: previousSessionDeliverableManifest,
    });

    try {
      // PD-SAAS-FORK: n2_bot steward never binds STDA task dirs.
      if (options.sessionKind === "n2_bot") {
        sessionTaskDirectory = undefined;
      } else {
      const stdaResult = await bootstrapSessionTaskDirectory({
        sessionId: options.sessionId,
        turnId: options.turnId,
        acceptedMessages: accepted.messages,
        transcript: this.transcript,
        transcriptPath: this.runtimeContext.transcriptPath,
        cwd: this.runtimeContext.cwd,
        capabilityContext: options.capabilityContext,
        sessionDeliverableManifest,
        capabilityCompletionMode,
      });
      sessionTaskDirectory = stdaResult.directory;
      }
    } catch {
      // STDA bootstrap is best-effort
    }

    if (sessionDeliverableManifest && sessionTaskDirectory) {
      const entries = await loadTranscriptEntriesForTurn(this.runtimeContext.transcriptPath);
      const primary = resolvePrimaryTaskArtifactDir({
        entries,
        manifest: sessionDeliverableManifest,
        latestDirectory: sessionTaskDirectory,
        messages: accepted.messages,
      });
      const preserveRoot = isStdaAddPreserveRootEnabled()
        && primary?.taskArtifactDir
        && primary.taskArtifactDir !== sessionTaskDirectory.taskArtifactDir;
      const directoryForAttach = preserveRoot
        ? { ...sessionTaskDirectory, ...primary }
        : sessionTaskDirectory;
      if (preserveRoot && primary) {
        sessionTaskDirectory = {
          ...sessionTaskDirectory,
          taskArtifactDir: primary.taskArtifactDir,
          taskDirKey: primary.taskDirKey,
          goalVersion: sessionDeliverableManifest.goalVersion,
        };
      }
      const patched = attachSessionTaskDirectoryToManifest(
        sessionDeliverableManifest,
        directoryForAttach,
      );
      if (patched) {
        sessionDeliverableManifest = patched;
        try {
          if (typeof this.transcript.recordSessionDeliverableManifest === "function") {
            await this.transcript.recordSessionDeliverableManifest(
              options.sessionId,
              options.turnId,
              patched,
            );
            yield {
              type: "session_manifest_updated",
              sessionId: options.sessionId,
              turnId: options.turnId,
              sessionManifest: slimSessionManifestForWire(patched),
            };
          }
        } catch {
          // STDA→SDM attach is best-effort
        }
      }
    }

    yield { type: "input_accepted", sessionId: options.sessionId, turnId: options.turnId, messages: accepted.messages };

    const userPromptHooks = await this.lifecycle?.dispatch({
      event: "UserPromptSubmit",
      baseInput: {
        sessionId: options.sessionId,
        transcriptPath: this.runtimeContext.transcriptPath,
        cwd: this.runtimeContext.cwd,
      },
      payload: { prompt },
      matchQuery: "UserPromptSubmit",
      signal: options.abortSignal,
    });
    yield { type: "user_prompt_submitted", sessionId: options.sessionId, turnId: options.turnId, prompt };
    if (userPromptHooks?.effects.some((effect) => effect.type === "block")) {
      const result = this.createErrorResult(
        options,
        agentError("agent_unsupported_feature", "UserPromptSubmit hook blocked model execution."),
      );
      yield { type: "turn_completed", sessionId: options.sessionId, turnId: options.turnId, result };
      return { result, messages };
    }
    messages.push(...(userPromptHooks?.messages ?? []));

    if (!accepted.shouldCallModel) {
      const result = this.createErrorResult(
        options,
        agentError("agent_unsupported_feature", "Input was accepted but model execution was not requested."),
      );
      yield { type: "turn_completed", sessionId: options.sessionId, turnId: options.turnId, result };
      return { result, messages };
    }

    try {
      let turnProgressStep = 0;
      const resilience = resolveResilienceConfig();
      const transcriptEntries = await loadTranscriptEntriesForTurn(this.runtimeContext.transcriptPath);
      const knownTaskArtifactDirs = collectSessionKnownTaskDirs({
        entries: transcriptEntries,
        manifest: sessionDeliverableManifest,
      });
      const loopRun = this.loop.run({
        sessionId: options.sessionId,
        turnId: options.turnId,
        messages,
        maxTurns: options.maxTurns,
        permissionMode: options.permissionMode,
        basePermissionMode: options.basePermissionMode,
        permissionRules: options.permissionRules,
        capabilityContext: options.capabilityContext,
        capabilityCompletionMode,
        turnInteractionMode,
        trustedExecutionScope,
        sessionGoalQualityContract,
        qualityContractHash,
        qualityContractMode,
        qualityContractShadowDiff,
        trustedUserExplicitUrls,
        promptLanguage: options.promptLanguage,
        abortSignal: options.abortSignal,
        sessionDeliverableManifest,
        sessionTaskDirectory,
        knownTaskArtifactDirs,
        onDurableMessage: async (msg) => {
          await this.transcript.recordDurableMessage(options.sessionId, options.turnId, msg);
          if (
            resilience.turnProgressEntries
            && typeof this.transcript.recordTurnProgress === "function"
            && isToolResultMessage(msg)
          ) {
            turnProgressStep += 1;
            void this.transcript.recordTurnProgress(options.sessionId, options.turnId, {
              stepIndex: turnProgressStep,
              summaryZh: "工具步骤完成",
            });
          }
        },
        onTurnAcceptanceMeta: async (payload) => {
          await this.transcript.recordTurnAcceptanceMeta?.(options.sessionId, options.turnId, payload);
        },
        onSessionManifestUpdated: async (manifest) => {
          if (typeof this.transcript.recordSessionDeliverableManifest !== "function") return;
          await this.transcript.recordSessionDeliverableManifest(
            options.sessionId,
            options.turnId,
            manifest,
          );
        },
      });
      let recordedTurnResult = false;
      while (true) {
        const step = await loopRun.next();
        if (step.done) {
          const finalResult = attachAcceptedInputReceipt(step.value.result, options);
          if (!recordedTurnResult) {
            await this.transcript.recordTurnResult(options.sessionId, options.turnId, finalResult);
          }
          return { ...step.value, result: finalResult };
        }
        const event = step.value;
        if (event.type === "turn_completed") {
          const result = attachAcceptedInputReceipt(event.result, options);
          await this.transcript.recordTurnResult(options.sessionId, options.turnId, result);
          recordedTurnResult = true;
          yield { ...event, result };
        } else {
          yield event;
        }
      }
    } catch (error) {
      const normalized = normalizeAgentError(error);
      const result = this.createErrorResult(options, normalized);
      if (typeof this.transcript.recordTurnInterrupted === "function") {
        await Promise.resolve(
          this.transcript.recordTurnInterrupted(options.sessionId, options.turnId, {
            reason: normalized.code ?? "turn_failed",
          }),
        ).catch(() => {});
      }
      await Promise.resolve(this.transcript.recordTurnResult(options.sessionId, options.turnId, result)).catch(() => {});
      yield { type: "turn_failed", sessionId: options.sessionId, turnId: options.turnId, error: normalized };
      yield { type: "turn_completed", sessionId: options.sessionId, turnId: options.turnId, result };
      return { result, messages };
    }
  }

  snapshotForRuntimeReload(): TurnRunnerRuntimeReloadSnapshot {
    return {
      runtimeContext: { ...this.runtimeContext },
      transcriptWriterState: this.transcript.snapshotState?.(),
    };
  }

  snapshotFileState(): AgentLoopSeedState {
    return this.loop.snapshotFileState();
  }

  private createErrorResult(options: TurnRunnerOptions, error: ReturnType<typeof agentError>): AgentTurnResult {
    const timestamp = this.now().toISOString();
    return {
      type: "error",
      sessionId: options.sessionId,
      turnId: options.turnId,
      stopReason: error.code === "agent_aborted" ? "aborted_streaming" : "model_error",
      usage: emptyUsage(),
      permissionDenials: [],
      turns: 0,
      startedAt: timestamp,
      completedAt: timestamp,
      errors: [error],
    };
  }
}

function attachAcceptedInputReceipt(
  result: AgentTurnResult,
  options: Pick<TurnRunnerOptions, "acceptedInputRef" | "queueItemId">,
): AgentTurnResult {
  if (result.type !== "success") return result;
  const entryId = options.acceptedInputRef?.entryId;
  const queueItemId = options.queueItemId?.trim() || entryId;
  if (!entryId && !queueItemId) return result;
  return {
    ...result,
    acceptedInputReceipt: {
      version: 1,
      ...(entryId ? { entryId } : {}),
      ...(queueItemId ? { queueItemId } : {}),
    },
  };
}

function emptyUsage(): CanonicalUsage {
  return {};
}

function inputToPromptText(input: AgentInput): string {
  if (input.type === "text") {
    return input.text;
  }
  return input.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function isToolResultMessage(message: CanonicalMessage): boolean {
  return message.role === "user" && message.content.some((block) => block.type === "tool_result");
}

async function loadTranscriptEntriesForTurn(transcriptPath: string): Promise<AgentTranscriptEntry[]> {
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
