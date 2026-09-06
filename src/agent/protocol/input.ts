import type { CanonicalContentBlock } from "../../model/index.js";
import type { PermissionMode, PermissionRuleSet } from "../../permission/index.js";
import type { AcceptedInputRef } from "../../session/transcript/acceptedInputDedup.js";
import type { AcceptedInputAttachmentDescriptor } from "../../session/transcript/acceptedInputIdentity.js";
import type { TrustedExecutionScope } from "../../saas/constraints/capabilityScopeContract.js";

export type AgentInput =
  | { type: "text"; text: string; isMeta?: boolean }
  | { type: "blocks"; content: CanonicalContentBlock[]; isMeta?: boolean };

export type CapabilityBindingContext = {
  slug: string;
  /** Falls back to slug in binding prompts when absent. */
  displayName?: string;
  packMemberPrefix?: string;
  majorCategory?: string;
};

export type AgentSubmitOptions = {
  turnId?: string;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
  permissionMode?: PermissionMode;
  /** The user's actual permission preference before plan-mode override. */
  basePermissionMode?: PermissionMode;
  permissionRules?: Partial<PermissionRuleSet>;
  /** PD-SAAS-FORK: Hub「试一下」技能锁定（仅该轮生效） */
  capabilityContext?: CapabilityBindingContext;
  /** PD-SAAS-FORK: UI language for work-language prompt and recovery copy (per turn). */
  promptLanguage?: "en" | "zh-CN";
  /** PD-SAAS-FORK (P0-7): durable Bridge accepted_input identity; not the Gateway run id. */
  acceptedInputRef?: AcceptedInputRef;
  /** PD-SAAS-FORK: Gateway-computed prompt + attachment identity. */
  acceptedInputFingerprint?: string;
  /** PD-SAAS-FORK: safe replay references; excludes base64 and raw content. */
  acceptedInputAttachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  /** PD-SAAS-FORK: stable queue request id for completion acknowledgment. */
  queueItemId?: string;
  /** PD-SAAS-FORK P0-2: authenticated scope supplied by the Gateway. */
  trustedExecutionScope?: TrustedExecutionScope;
};
