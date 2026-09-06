import { PermissionRuntime } from "../../permission/index.js";
import type { LifecycleRuntime, PilotDeckHookEffect } from "../../lifecycle/index.js";
import { toolError } from "../protocol/errors.js";
import type { PilotDeckToolErrorCode } from "../protocol/errors.js";
import {
  applyResultSizeLimit,
  type PilotDeckToolErrorResult,
  type PilotDeckToolResult,
  type PilotDeckToolSuccessResult,
} from "../protocol/result.js";
import type { PilotDeckToolCall, PilotDeckToolRuntimeContext } from "../protocol/types.js";
import type { ToolRegistry } from "../registry/ToolRegistry.js";
import { validateToolInput } from "./validateToolInput.js";
import { formatValidationError } from "./formatValidationError.js";
import { normalizeToolError } from "../protocol/errors.js";
import { appendToolRecoveryHint } from "../recoveryHints.js";
import {
  delayForTransientToolRetry,
  isTransientToolRetryable,
  TRANSIENT_TOOL_RETRY_ATTEMPTS,
  TRANSIENT_TOOL_RETRY_DELAY_MS,
} from "../transientToolRetry.js";
import type { AgentEventEmitter } from "../../agent/protocol/events.js";
import { isToolAllowedByQualityContract } from "../../saas/constraints/capabilityScopeContract.js";
import { evaluateGoalToolPolicy } from "../../saas/media/goalToolPolicy.js";
import {
  deliverableSubagentBlockedMessage,
  isDeliverableSubagentToolName,
  shouldBlockDeliverableSubagent,
} from "../../saas/deliverables/shouldBlockDeliverableSubagent.js";
import { isOfficialMediaPlaceholderContent } from "../../saas/media/officialMediaPlaceholder.js";
import {
  officialAssetsFromManifest,
} from "../../saas/media/visualAssetPlatform/deliverableVisualBindingAudit.js";
import { matchPathToSequentialGate } from "../../saas/taskState/sequentialDeliverableGate.js";
import {
  loadVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import {
  evaluateVapBindBeforeWrite,
  formatBindBeforeWriteBlockedMessage,
} from "../../saas/media/visualAssetPlatform/vapBindBeforeWrite.js";
import {
  applyVapManifestRewriteBeforeWrite,
} from "../../saas/media/visualAssetPlatform/vapManifestRewrite.js";
import {
  visualAssetPlatformMode,
  visualBindingAuditMode,
} from "../../saas/resilience/stabilityFlags.js";
import type { OfficialMediaAttemptPermit } from "../../saas/media/officialMediaFallbackStateMachine.js";

export class ToolRuntime {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissionRuntime: PermissionRuntime,
    private readonly lifecycle?: LifecycleRuntime,
    private readonly eventEmitter?: AgentEventEmitter,
  ) {}

  async execute(call: PilotDeckToolCall, context: PilotDeckToolRuntimeContext): Promise<PilotDeckToolResult> {
    const startedAtDate = now(context);
    const startedAt = startedAtDate.toISOString();
    const tool = this.registry.get(call.name);
    const toolName = tool?.name ?? call.name;

    if (context.abortSignal?.aborted) {
      return this.errorResult(call.id, toolName, "tool_aborted", "Tool execution was aborted.", startedAt, context);
    }

    if (!tool) {
      return this.errorResult(
        call.id,
        call.name,
        "tool_not_found",
        `Tool ${call.name} does not exist.`,
        startedAt,
        context,
      );
    }

    if (
      isDeliverableSubagentToolName(tool.name)
      && shouldBlockDeliverableSubagent({
        userGoal: context.sessionDeliverableManifest?.sessionGoalAnchor,
        sessionManifest: context.sessionDeliverableManifest,
      })
    ) {
      return this.errorResult(
        call.id,
        tool.name,
        "permission_denied",
        deliverableSubagentBlockedMessage("zh-CN"),
        startedAt,
        context,
      );
    }

    const goalPolicyDecision = evaluateGoalToolPolicy({
      toolName: tool.name,
      toolKind: tool.kind,
      input: call.input,
      policy: context.goalToolPolicy,
      hasBoundedSubagent: Boolean(
        context.subagent
        && context.goalToolPolicy
        && context.officialMediaBudget,
      ),
    });
    if (!goalPolicyDecision.allowed) {
      // PD-SAAS-FORK P0-6: hard goal policy is authoritative before schema
      // validation, lifecycle hooks, and permission prompts.
      return this.errorResult(
        call.id,
        tool.name,
        "permission_denied",
        goalPolicyDecision.reason
          ?? `Tool ${tool.name} is blocked by the official media goal tool policy.`,
        startedAt,
        context,
        undefined,
        call.input,
      );
    }
    const policyInput = goalPolicyDecision.input ?? call.input;
    let effectivePolicyInput: unknown = policyInput;
    if (
      tool.name === "write_file"
      && containsOfficialMediaPlaceholder(effectivePolicyInput)
      && isEnforcedOfficialMediaPolicy(context)
      && context.officialMediaBudget?.snapshot().state !== "placeholder_required"
    ) {
      return this.errorResult(
        call.id,
        tool.name,
        "permission_denied",
        "Official media placeholders are allowed only after the official media budget is exhausted.",
        startedAt,
        context,
        undefined,
        effectivePolicyInput,
      );
    }

    if (tool.name === "write_file") {
      const writeRecord = recordFromUnknown(policyInput);
      const filePath = String(
        writeRecord?.file_path ?? writeRecord?.filePath ?? "",
      ).trim();
      if (filePath && context.sessionDeliverableManifest) {
        const stageGate = matchPathToSequentialGate(
          filePath,
          context.sessionDeliverableManifest,
          { toolName: "write_file" },
        );
        if (!stageGate.allowed) {
          return this.errorResult(
            call.id,
            tool.name,
            "permission_denied",
            stageGate.reason
              ?? "Sequential deliverable gate blocked this write.",
            startedAt,
            context,
            undefined,
            effectivePolicyInput,
          );
        }
      }
    }

    if (tool.name === "write_file") {
      const writeRecord = recordFromUnknown(policyInput);
      const filePath = String(
        writeRecord?.file_path ?? writeRecord?.filePath ?? "",
      ).trim();
      const officialRequired = Boolean(context.goalToolPolicy?.officialMediaRequired);
      if (filePath && (officialRequired || /placeholder/iu.test(filePath))) {
        const bindDecision = await evaluateVapBindBeforeWrite({
          workspaceRoot: context.cwd,
          taskArtifactDir: context.taskArtifactDir ?? context.goalToolPolicy?.taskArtifactDir,
          sessionId: context.sessionId,
          goalVersion: context.taskGoalVersion ?? context.goalToolPolicy?.taskGoalVersion,
          filePath,
          content: writeRecord?.content,
          officialMediaRequired: officialRequired,
        });
        const enforceBindGate =
          context.goalToolPolicy?.mode === "enforce"
          || visualBindingAuditMode() === "enforce"
          || Boolean(bindDecision.blocked && /placeholder/iu.test(filePath));
        if (bindDecision.blocked && enforceBindGate) {
          return this.errorResult(
            call.id,
            tool.name,
            "permission_denied",
            formatBindBeforeWriteBlockedMessage(bindDecision),
            startedAt,
            context,
            undefined,
            effectivePolicyInput,
          );
        }

        if (officialRequired) {
          const rewriteDecision = await applyVapManifestRewriteBeforeWrite({
            workspaceRoot: context.cwd,
            taskArtifactDir: context.taskArtifactDir
              ?? context.goalToolPolicy?.taskArtifactDir,
            sessionId: context.sessionId,
            goalVersion: context.taskGoalVersion
              ?? context.goalToolPolicy?.taskGoalVersion,
            filePath,
            content: writeRecord?.content,
            officialMediaRequired: true,
          });
          if (!rewriteDecision.ok && enforceBindGate) {
            return this.errorResult(
              call.id,
              tool.name,
              "permission_denied",
              rewriteDecision.message
                ?? "Visual deliverable write blocked until manifest paths exist on disk.",
              startedAt,
              context,
              undefined,
              effectivePolicyInput,
            );
          }
          if (
            writeRecord
            && typeof rewriteDecision.content === "string"
            && rewriteDecision.content !== writeRecord.content
          ) {
            effectivePolicyInput = {
              ...writeRecord,
              content: rewriteDecision.content,
            };
          }
        }
      }
    }

    // PD-SAAS-FORK VAP P0-D: explicit official_only short-circuit before schema work.
    if (
      tool.name === "generate_image"
      && context.sessionGoalQualityContract?.forbidGenerateImage === true
      && (
        context.qualityContractMode === "enforce"
        || context.goalToolPolicy?.mode === "enforce"
      )
    ) {
      return this.errorResult(
        call.id,
        tool.name,
        "permission_denied",
        "generate_image is forbidden for official/website product imagery. Use resolve_session_visual_assets or fetch_page_images→fetch_media_asset.",
        startedAt,
        context,
        undefined,
        call.input,
      );
    }

    if (
      tool.name === "generate_image"
      && context.goalToolPolicy?.officialMediaRequired
      && visualAssetPlatformMode() !== "off"
    ) {
      const taskDir = context.taskArtifactDir ?? context.goalToolPolicy.taskArtifactDir;
      if (taskDir) {
        try {
          const manifest = await loadVisualAssetManifest({
            workspaceRoot: context.cwd,
            taskArtifactDir: taskDir,
            sessionId: context.sessionId,
            goalVersion: context.taskGoalVersion ?? context.goalToolPolicy.taskGoalVersion,
          });
          if (officialAssetsFromManifest(manifest).length > 0) {
            const enforceGenerateBlock =
              context.goalToolPolicy.mode === "enforce"
              || visualBindingAuditMode() === "enforce";
            if (enforceGenerateBlock) {
              return this.errorResult(
                call.id,
                tool.name,
                "permission_denied",
                "generate_image is blocked while official manifest assets are available. Bind manifest paths into deliverables instead.",
                startedAt,
                context,
                undefined,
                call.input,
              );
            }
          }
        } catch {
          // fail-open on manifest read errors
        }
      }
    }

    if (
      !isToolAllowedByQualityContract(
        tool.name,
        context.sessionGoalQualityContract,
        context.qualityContractMode ?? "off",
      )
    ) {
      // PD-SAAS-FORK P0-2: runtime defense remains authoritative even if a
      // model emits a tool name absent from its filtered schema.
      return this.errorResult(
        call.id,
        tool.name,
        "tool_execution_failed",
        `Tool ${tool.name} is blocked by the session quality contract.`,
        startedAt,
        context,
      );
    }

    const validation = validateToolInput(effectivePolicyInput, tool.inputSchema);
    if (!validation.ok) {
      return this.errorResult(
        call.id,
        tool.name,
        "invalid_tool_input",
        formatValidationError(tool.name, validation.issues, {
          maxOutputTokens: context.maxOutputTokens,
          outputTruncated: context.outputTruncated,
        }),
        startedAt,
        context,
        { issues: validation.issues },
        effectivePolicyInput,
      );
    }

    let executeInput = effectivePolicyInput;
    let inputRewrittenAfterPolicy = false;
    const preToolResult = await this.dispatchLifecycle("PreToolUse", tool.name, call.id, executeInput, context);
    this.eventEmitter?.({ type: "pre_tool_execute", sessionId: context.sessionId, turnId: context.turnId, toolCallId: call.id, toolName: tool.name });
    const preBlock = findEffect(preToolResult.effects, "block");
    const prePermission = findEffect(preToolResult.effects, "permission_decision");
    const preDeny = prePermission?.behavior === "deny" ? prePermission : undefined;
    if (preBlock || preDeny) {
      return this.errorResult(
        call.id,
        tool.name,
        "permission_denied",
        preBlock?.reason ?? preDeny?.reason ?? `PreToolUse hook denied ${tool.name}.`,
        startedAt,
        context,
      );
    }
    const updatedInput = findEffect(preToolResult.effects, "updated_tool_input");
    if (updatedInput) {
      executeInput = updatedInput.input;
      inputRewrittenAfterPolicy = true;
      const updatedValidation = validateToolInput(executeInput, tool.inputSchema);
      if (!updatedValidation.ok) {
        return this.errorResult(
          call.id,
          tool.name,
          "invalid_tool_input",
          `PreToolUse hook produced invalid input for ${tool.name}.`,
          startedAt,
          context,
          { issues: updatedValidation.issues },
        );
      }
    }

    const toolValidation = await tool.validateInput?.(executeInput, context);
    if (toolValidation && !toolValidation.ok) {
      return this.errorResult(
        call.id,
        tool.name,
        "invalid_tool_input",
        `Tool ${tool.name} rejected the input.`,
        startedAt,
        context,
        { issues: toolValidation.issues },
      );
    }

    const todoGateMessage = context.planTodo?.blockingMessageFor(
      tool.name,
      tool.isReadOnly(executeInput),
    );
    if (todoGateMessage) {
      return this.errorResult(
        call.id,
        tool.name,
        "tool_execution_failed",
        todoGateMessage,
        startedAt,
        context,
      );
    }

    let decision = await this.permissionRuntime.decide(tool, executeInput, context, call.id);
    if (decision.type === "ask") {
      const permissionHookResult = await this.dispatchLifecycle("PermissionRequest", tool.name, call.id, executeInput, context, {
        permissionSuggestions: decision.request.options,
      });
      this.eventEmitter?.({ type: "permission_requested", sessionId: context.sessionId, turnId: context.turnId, toolCallId: call.id, toolName: tool.name });
      const permissionRequestResult = findEffect(permissionHookResult.effects, "permission_request_result");
      if (permissionRequestResult?.result.behavior === "allow") {
        decision = {
          type: "allow",
          reason: { type: "runtime", message: `PermissionRequest hook allowed ${tool.name}.` },
          updatedInput: permissionRequestResult.result.updatedInput,
        };
      } else if (permissionRequestResult?.result.behavior === "deny") {
        decision = {
          type: "deny",
          reason: { type: "runtime", message: permissionRequestResult.result.message ?? `PermissionRequest hook denied ${tool.name}.` },
          message: permissionRequestResult.result.message ?? `PermissionRequest hook denied ${tool.name}.`,
        };
      }
    }
    await context.auditRecorder?.recordPermission({
      type: "permission",
      sessionId: context.sessionId,
      turnId: context.turnId,
      toolCallId: call.id,
      toolName: tool.name,
      mode: context.permissionContext.mode,
      decision: decision.type,
      reason: decision.reason,
      createdAt: now(context).toISOString(),
    });

    if (decision.type === "deny") {
      await this.dispatchLifecycle("PermissionDenied", tool.name, call.id, executeInput, context, {
        reason: decision.message,
      });
      this.eventEmitter?.({ type: "permission_denied", sessionId: context.sessionId, turnId: context.turnId, toolName: tool.name, reason: decision.message });
      const code: PilotDeckToolErrorCode =
        decision.reason.type === "runtime" && decision.reason.message.includes("prompt") ?
          "permission_required" :
          "permission_denied";
      return this.errorResult(call.id, tool.name, code, decision.message, startedAt, context);
    }

    if (decision.type === "cancel") {
      return this.errorResult(call.id, tool.name, "permission_cancelled", decision.message, startedAt, context);
    }

    if (decision.type === "ask") {
      return this.errorResult(
        call.id,
        tool.name,
        "permission_required",
        `Permission is required to run ${tool.name}.`,
        startedAt,
        context,
        { request: decision.request },
      );
    }

    if (decision.updatedInput !== undefined) {
      executeInput = decision.updatedInput;
      inputRewrittenAfterPolicy = true;
    }
    if (inputRewrittenAfterPolicy) {
      const executionPolicyDecision = evaluateGoalToolPolicy({
        toolName: tool.name,
        toolKind: tool.kind,
        input: executeInput,
        policy: context.goalToolPolicy,
        hasBoundedSubagent: Boolean(
          context.subagent
          && context.goalToolPolicy
          && context.officialMediaBudget,
        ),
      });
      if (!executionPolicyDecision.allowed) {
        // A lifecycle or permission hook may rewrite input after the initial
        // pre-permission check; never let that create a path-policy escape.
        return this.errorResult(
          call.id,
          tool.name,
          "permission_denied",
          executionPolicyDecision.reason
            ?? `Tool ${tool.name} input is blocked by the official media goal tool policy.`,
          startedAt,
          context,
          undefined,
          executeInput,
        );
      }
      executeInput = executionPolicyDecision.input;
      const executionValidation = validateToolInput(
        executeInput,
        tool.inputSchema,
      );
      if (!executionValidation.ok) {
        return this.errorResult(
          call.id,
          tool.name,
          "invalid_tool_input",
          `Permission processing produced invalid input for ${tool.name}.`,
          startedAt,
          context,
          { issues: executionValidation.issues },
          executeInput,
        );
      }
      const executionToolValidation = await tool.validateInput?.(
        executeInput,
        context,
      );
      if (executionToolValidation && !executionToolValidation.ok) {
        return this.errorResult(
          call.id,
          tool.name,
          "invalid_tool_input",
          `Tool ${tool.name} rejected permission-updated input.`,
          startedAt,
          context,
          { issues: executionToolValidation.issues },
          executeInput,
        );
      }
    }
    const mediaAttempt = beginOfficialMediaAttempt(
      tool.name,
      executeInput,
      context,
    );
    if (!mediaAttempt.allowed) {
      return this.errorResult(
        call.id,
        tool.name,
        "tool_execution_failed",
        mediaAttempt.reason,
        startedAt,
        context,
        undefined,
        executeInput,
      );
    }
    const executeContext: PilotDeckToolRuntimeContext = {
      ...context,
      toolCallId: call.id,
      ...(context.progress
        ? {
            progress: (event) =>
              context.progress!({
                ...event,
                toolCallId: event.toolCallId || call.id,
                toolName: event.toolName || tool.name,
              }),
          }
        : {}),
    };
    // PD-SAAS-FORK: one silent retry for read-only transient timeouts/network blips
    const toolIsReadOnly = tool.isReadOnly(executeInput);
    let lastNormalizedError: ReturnType<typeof normalizeToolError> | null = null;
    for (let attempt = 0; attempt <= TRANSIENT_TOOL_RETRY_ATTEMPTS; attempt += 1) {
      if (context.abortSignal?.aborted) {
        const aborted = await this.errorResult(
          call.id,
          tool.name,
          "tool_aborted",
          "Tool execution was aborted.",
          startedAt,
          context,
        );
        recordOfficialMediaOutcome(
          aborted,
          context,
          mediaAttempt.permit,
        );
        return aborted;
      }
      if (attempt > 0) {
        await delayForTransientToolRetry(TRANSIENT_TOOL_RETRY_DELAY_MS, context.abortSignal);
        if (context.abortSignal?.aborted) {
          const aborted = await this.errorResult(
            call.id,
            tool.name,
            "tool_aborted",
            "Tool execution was aborted.",
            startedAt,
            context,
          );
          recordOfficialMediaOutcome(
            aborted,
            context,
            mediaAttempt.permit,
          );
          return aborted;
        }
      }
      try {
        const output = await tool.execute(executeInput, executeContext);
        const maxResultBytes = tool.maxResultBytes ?? context.maxResultBytes;
        const limited = applyResultSizeLimit(output.content, maxResultBytes);
        const completedAt = now(context).toISOString();
        const postToolLifecycle = await this.dispatchLifecycle(
          "PostToolUse",
          tool.name,
          call.id,
          executeInput,
          context,
          { toolResponse: output.data ?? output.content },
        );
        this.eventEmitter?.({ type: "post_tool_execute", sessionId: context.sessionId, turnId: context.turnId, toolCallId: call.id, toolName: tool.name, success: true });
        const result: PilotDeckToolSuccessResult = {
          type: "success",
          toolCallId: call.id,
          toolName: tool.name,
          content: limited.content,
          supplementalMessages: output.supplementalMessages,
          data: output.data,
          metadata: mergeMetadata(
            output.metadata,
            mergeMetadata(limited.metadata, lifecycleMetadata(postToolLifecycle)),
          ),
          startedAt,
          completedAt,
        };
        if (!toolIsReadOnly && tool.name !== "todo_write") {
          context.planTodo?.markToolProgressChanged(tool.name);
        }
        recordOfficialMediaOutcome(result, context, mediaAttempt.permit);
        await this.recordToolAudit(result, context, startedAtDate);
        return result;
      } catch (error) {
        const normalized = normalizeToolError(error);
        lastNormalizedError = normalized;
        const canRetry = attempt < TRANSIENT_TOOL_RETRY_ATTEMPTS
          && isTransientToolRetryable(normalized.code, normalized.message, { isReadOnly: toolIsReadOnly });
        if (canRetry) {
          continue;
        }
        await this.dispatchLifecycle("PostToolUseFailure", tool.name, call.id, executeInput, context, {
          error: normalized.message,
          isInterrupt: normalized.code === "tool_aborted",
        });
        this.eventEmitter?.({ type: "post_tool_execute", sessionId: context.sessionId, turnId: context.turnId, toolCallId: call.id, toolName: tool.name, success: false });
        const result = this.createErrorResult(
          call.id,
          tool.name,
          normalized.code,
          normalized.message,
          startedAt,
          context,
          { details: normalized.details },
          executeInput,
        );
        recordOfficialMediaOutcome(result, context, mediaAttempt.permit);
        await this.recordToolAudit(result, context, startedAtDate);
        return result;
      }
    }
    const fallback = lastNormalizedError ?? toolError("tool_execution_failed", "Tool execution failed.");
    const result = await this.errorResult(
      call.id,
      tool.name,
      fallback.code,
      fallback.message,
      startedAt,
      context,
      { details: fallback.details },
      executeInput,
    );
    recordOfficialMediaOutcome(result, context, mediaAttempt.permit);
    return result;
  }

  private async errorResult(
    toolCallId: string,
    toolName: string,
    code: PilotDeckToolErrorCode,
    message: string,
    startedAt: string,
    context: PilotDeckToolRuntimeContext,
    details?: Record<string, unknown>,
    toolInput?: unknown,
  ): Promise<PilotDeckToolErrorResult> {
    const startedAtDate = new Date(startedAt);
    const result = this.createErrorResult(toolCallId, toolName, code, message, startedAt, context, details, toolInput);
    await this.recordToolAudit(result, context, startedAtDate);
    return result;
  }

  private createErrorResult(
    toolCallId: string,
    toolName: string,
    code: PilotDeckToolErrorCode,
    message: string,
    startedAt: string,
    context: PilotDeckToolRuntimeContext,
    details?: Record<string, unknown>,
    toolInput?: unknown,
  ): PilotDeckToolErrorResult {
    const completedAt = now(context).toISOString();
    const enrichedMessage = appendToolRecoveryHint(toolName, code, message, toolInput);
    return {
      type: "error",
      toolCallId,
      toolName,
      error: toolError(code, enrichedMessage, details),
      content: [{ type: "text", text: enrichedMessage }],
      startedAt,
      completedAt,
    };
  }

  private async recordToolAudit(
    result: PilotDeckToolResult,
    context: PilotDeckToolRuntimeContext,
    startedAt: Date,
  ): Promise<void> {
    await context.auditRecorder?.recordTool({
      type: "tool",
      sessionId: context.sessionId,
      turnId: context.turnId,
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      status: result.type === "success" ? "success" : "error",
      errorCode: result.type === "error" ? result.error.code : undefined,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: new Date(result.completedAt).getTime() - startedAt.getTime(),
    });
  }

  private async dispatchLifecycle(
    event: "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PermissionRequest" | "PermissionDenied",
    toolName: string,
    toolCallId: string,
    toolInput: unknown,
    context: PilotDeckToolRuntimeContext,
    extraPayload: Record<string, unknown> = {},
  ) {
    return this.lifecycle?.dispatch({
      event,
      baseInput: {
        sessionId: context.sessionId,
        transcriptPath: "",
        cwd: context.cwd,
        permissionMode: context.permissionMode,
      },
      matchQuery: toolName,
      payload: {
        toolName,
        toolInput,
        toolUseId: toolCallId,
        ...extraPayload,
      },
      signal: context.abortSignal,
      env: context.env,
    }) ?? {
      effects: [],
      messages: [],
      events: [],
      blockingErrors: [],
      nonBlockingErrors: [],
    };
  }
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function containsOfficialMediaPlaceholder(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const content = (input as Record<string, unknown>).content;
  return typeof content === "string"
    && isOfficialMediaPlaceholderContent(content);
}

function beginOfficialMediaAttempt(
  toolName: string,
  input: unknown,
  context: PilotDeckToolRuntimeContext,
):
  | { allowed: true; permit?: OfficialMediaAttemptPermit }
  | { allowed: false; reason: string } {
  const budget = context.officialMediaBudget;
  if (!budget) return { allowed: true };
  const decision = budget.beginToolAttempt(toolName, input);
  if (!decision.allowed && isEnforcedOfficialMediaPolicy(context)) {
    return {
      allowed: false,
      reason: decision.reason
        ?? "Official media attempt is blocked by the shared fallback budget.",
    };
  }
  return { allowed: true, permit: decision.permit };
}

function isEnforcedOfficialMediaPolicy(
  context: PilotDeckToolRuntimeContext,
): boolean {
  return (
    context.goalToolPolicy?.mode === "enforce"
    && context.goalToolPolicy.officialMediaRequired
  );
}

function recordOfficialMediaOutcome(
  result: PilotDeckToolResult,
  context: PilotDeckToolRuntimeContext,
  permit: OfficialMediaAttemptPermit | undefined,
): void {
  const budget = context.officialMediaBudget;
  if (!budget || !permit) return;
  budget.recordToolResult(permit, {
    ok: result.type === "success" && result.metadata?.softFailed !== true,
    data: result.type === "success" ? result.data : undefined,
    error: result.type === "error" ? result.error.message : undefined,
  });
}

function findEffect<Type extends PilotDeckHookEffect["type"]>(
  effects: PilotDeckHookEffect[],
  type: Type,
): Extract<PilotDeckHookEffect, { type: Type }> | undefined {
  return effects.find((effect): effect is Extract<PilotDeckHookEffect, { type: Type }> => effect.type === type);
}

function lifecycleMetadata(result: { effects: PilotDeckHookEffect[] }): Record<string, unknown> | undefined {
  const blocking = result.effects.find((effect) => effect.type === "block");
  const additionalContext = result.effects.filter((effect) => effect.type === "additional_context");
  const updatedMcpOutput = result.effects.find((effect) => effect.type === "updated_mcp_tool_output");
  if (!blocking && additionalContext.length === 0 && !updatedMcpOutput) {
    return undefined;
  }
  return {
    lifecycle: {
      blocked: blocking ? { reason: blocking.reason, stopReason: blocking.stopReason } : undefined,
      additionalContext: additionalContext.map((effect) => effect.content),
      updatedMcpToolOutput: updatedMcpOutput?.output,
    },
  };
}

function now(context: PilotDeckToolRuntimeContext): Date {
  return context.now?.() ?? new Date();
}

function mergeMetadata(
  first: Record<string, unknown> | undefined,
  second: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!first && !second) {
    return undefined;
  }

  return {
    ...(first ?? {}),
    ...(second ?? {}),
  };
}
