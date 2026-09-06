// PD-SAAS-FORK P0-6: bounded tool allowlist for enforced official-only media goals.

import type {
  TrustedExecutionScope,
} from "../constraints/capabilityScopeContract.js";
import type {
  SessionGoalQualityContract,
} from "../constraints/goalQualityContract.js";
import type {
  StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import type { PilotDeckToolKind } from "../../tool/protocol/types.js";
import { guardPolicyAwareToolInput } from "./policyAwarePathGuard.js";

export const OFFICIAL_MEDIA_TOOL_ALLOWLIST = Object.freeze([
  "read_file",
  "read_skill",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "fetch_page_images",
  "fetch_media_asset",
  // PD-SAAS-FORK VAP
  "resolve_session_visual_assets",
  "discover_visual_assets",
  "prepare_visual_asset",
  "ingest_visual_asset",
  "write_file",
  "edit_file",
  "render_local_html_to_image",
  "compose_images_to_document",
  "ocr_to_editable_pptx",
  "export_document",
  "structured_output",
  "todo_write",
  "ask_user_question",
  "agent",
] as const);

export type GoalToolPolicy = {
  readonly mode: StabilityTriStateMode;
  readonly officialMediaRequired: boolean;
  readonly officialMediaPreferred: boolean;
  readonly allowPlaceholders: boolean;
  readonly allowedTools: readonly string[];
  readonly workspaceRoot: string;
  readonly taskArtifactDir: string;
  readonly taskGoalVersion?: number;
  readonly trustedExecutionScope?: TrustedExecutionScope;
};

export type BuildGoalToolPolicyInput = {
  contract?: SessionGoalQualityContract | null;
  mode: StabilityTriStateMode;
  workspaceRoot: string;
  taskArtifactDir?: string;
  taskGoalVersion?: number;
  trustedExecutionScope?: TrustedExecutionScope;
};

export type GoalToolPolicyDecision = {
  allowed: boolean;
  input: unknown;
  reason?: string;
  shadowWouldDeny?: boolean;
};

function normalizeToolName(toolName: string): string {
  return String(toolName ?? "").trim().toLowerCase();
}

function toolWouldBeAllowed(
  toolName: string,
  toolKind: PilotDeckToolKind,
  policy: GoalToolPolicy,
): boolean {
  if (!policy.officialMediaRequired) return true;
  const normalized = normalizeToolName(toolName);
  if (!normalized) return false;
  if (toolKind === "mcp" || normalized.startsWith("mcp__")) return false;
  return policy.allowedTools.includes(normalized);
}

export function buildGoalToolPolicy(
  input: BuildGoalToolPolicyInput,
): GoalToolPolicy {
  const officialMediaPolicy =
    input.contract?.officialMediaPolicy ?? "none";
  const policy: GoalToolPolicy = {
    mode: input.mode,
    officialMediaRequired: officialMediaPolicy === "official_only",
    officialMediaPreferred: officialMediaPolicy === "official_preferred",
    allowPlaceholders: input.contract?.allowPlaceholders === true,
    allowedTools: OFFICIAL_MEDIA_TOOL_ALLOWLIST,
    workspaceRoot: input.workspaceRoot,
    taskArtifactDir: String(input.taskArtifactDir ?? "")
      .trim()
      .replace(/\\/gu, "/")
      .replace(/\/+$/u, ""),
    ...(Number.isSafeInteger(input.taskGoalVersion)
      && (input.taskGoalVersion ?? 0) > 0
      ? { taskGoalVersion: input.taskGoalVersion }
      : {}),
    ...(input.trustedExecutionScope
      ? {
          trustedExecutionScope: {
            ...input.trustedExecutionScope,
          },
        }
      : {}),
  };
  return Object.freeze(policy);
}

export const resolveGoalToolPolicy = buildGoalToolPolicy;

export function isToolAllowedByGoalToolPolicy(
  toolName: string,
  toolKind: PilotDeckToolKind,
  policy: GoalToolPolicy | null | undefined,
): boolean {
  if (
    !policy
    || policy.mode !== "enforce"
    || !policy.officialMediaRequired
  ) {
    return true;
  }
  return toolWouldBeAllowed(toolName, toolKind, policy);
}

export function evaluateGoalToolPolicy(input: {
  toolName: string;
  toolKind: PilotDeckToolKind;
  input: unknown;
  policy?: GoalToolPolicy | null;
  hasBoundedSubagent?: boolean;
}): GoalToolPolicyDecision {
  const policy = input.policy;
  if (!policy || !policy.officialMediaRequired || policy.mode === "off") {
    return { allowed: true, input: input.input };
  }

  const toolAllowed = toolWouldBeAllowed(
    input.toolName,
    input.toolKind,
    policy,
  );
  const unboundSubagent =
    normalizeToolName(input.toolName) === "agent"
    && input.hasBoundedSubagent !== true;
  const wouldDeny = !toolAllowed || unboundSubagent;

  if (policy.mode === "shadow") {
    return {
      allowed: true,
      input: input.input,
      ...(wouldDeny ? { shadowWouldDeny: true } : {}),
    };
  }
  if (!toolAllowed) {
    return {
      allowed: false,
      input: input.input,
      reason: `Tool ${input.toolName} is blocked by the official media goal tool policy.`,
    };
  }
  if (unboundSubagent) {
    return {
      allowed: false,
      input: input.input,
      reason: "The official media goal tool policy blocks an unbound subagent escape.",
    };
  }

  const pathDecision = guardPolicyAwareToolInput({
    toolName: input.toolName,
    input: input.input,
    policy,
  });
  return {
    allowed: pathDecision.allowed,
    input: pathDecision.input,
    ...(pathDecision.reason ? { reason: pathDecision.reason } : {}),
  };
}
