// PD-SAAS-FORK P0-6: cross-turn official-media fallback budget and deterministic FSM.

import { createHash } from "node:crypto";
import path from "node:path";

import { isOfficialMediaPlaceholderContent } from "./officialMediaPlaceholder.js";

export type OfficialMediaFallbackState =
  | "official_discovery"
  | "official_localize"
  | "official_ready"
  | "placeholder_required"
  | "placeholder_ready"
  | "blocked";

export type OfficialMediaBudgetAction =
  | "discover"
  | "localize"
  | "placeholder";

export type OfficialMediaFallbackStateMachineOptions = {
  allowPlaceholders: boolean;
  maxDiscoveryAttempts?: number;
  maxLocalizationAttempts?: number;
  maxPlaceholderAttempts?: number;
  maxTotalAttempts?: number;
};

export type OfficialMediaBudgetScope = {
  tenantScopeId: string;
  principalScopeId: string;
  workspaceRoot: string;
  sessionId: string;
  taskRoot: string;
  goalVersion: number;
};

export type OfficialMediaAttemptPermit = {
  readonly id: number;
  readonly action: OfficialMediaBudgetAction;
  readonly toolName: string;
};

export type OfficialMediaBeginDecision = {
  allowed: boolean;
  reason?: string;
  permit?: OfficialMediaAttemptPermit;
};

export type OfficialMediaToolOutcome = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type OfficialMediaBudgetSnapshot = {
  state: OfficialMediaFallbackState;
  discoveryAttempts: number;
  localizationAttempts: number;
  placeholderAttempts: number;
  totalAttempts: number;
  maxDiscoveryAttempts: number;
  maxLocalizationAttempts: number;
  maxPlaceholderAttempts: number;
  maxTotalAttempts: number;
  allowPlaceholders: boolean;
};

const DEFAULT_DISCOVERY_ATTEMPTS = 2;
const DEFAULT_LOCALIZATION_ATTEMPTS = 3;
const DEFAULT_PLACEHOLDER_ATTEMPTS = 1;
const DEFAULT_TOTAL_ATTEMPTS = 6;
const MAX_SHARED_STATE_MACHINES = 1_024;

function boundedLimit(
  value: number | undefined,
  fallback: number,
): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) return fallback;
  return Math.min(value!, 32);
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function officialMediaActionForTool(
  toolName: string,
  input: unknown,
): OfficialMediaBudgetAction | null {
  const normalized = String(toolName ?? "").trim().toLowerCase();
  if (normalized === "fetch_page_images") return "discover";
  if (normalized === "fetch_media_asset") return "localize";
  if (normalized === "write_file") {
    const content = recordFromUnknown(input)?.content;
    return isOfficialMediaPlaceholderContent(content) ? "placeholder" : null;
  }
  return null;
}

function hasOfficialCandidates(data: unknown): boolean {
  const record = recordFromUnknown(data);
  if (!record) return false;
  const candidates = record.candidates;
  return Array.isArray(candidates) && candidates.length > 0;
}

export class OfficialMediaFallbackStateMachine {
  private state: OfficialMediaFallbackState = "official_discovery";
  private discoveryAttempts = 0;
  private localizationAttempts = 0;
  private placeholderAttempts = 0;
  private totalAttempts = 0;
  private nextPermitId = 1;
  private readonly activePermits =
    new Map<number, OfficialMediaAttemptPermit>();
  private placeholderRecoveryIssued = false;
  private readonly allowPlaceholders: boolean;
  private readonly maxDiscoveryAttempts: number;
  private readonly maxLocalizationAttempts: number;
  private readonly maxPlaceholderAttempts: number;
  private readonly maxTotalAttempts: number;

  constructor(options: OfficialMediaFallbackStateMachineOptions) {
    this.allowPlaceholders = options.allowPlaceholders === true;
    this.maxDiscoveryAttempts = boundedLimit(
      options.maxDiscoveryAttempts,
      DEFAULT_DISCOVERY_ATTEMPTS,
    );
    this.maxLocalizationAttempts = boundedLimit(
      options.maxLocalizationAttempts,
      DEFAULT_LOCALIZATION_ATTEMPTS,
    );
    this.maxPlaceholderAttempts = boundedLimit(
      options.maxPlaceholderAttempts,
      DEFAULT_PLACEHOLDER_ATTEMPTS,
    );
    this.maxTotalAttempts = boundedLimit(
      options.maxTotalAttempts,
      DEFAULT_TOTAL_ATTEMPTS,
    );
  }

  beginToolAttempt(
    toolName: string,
    input: unknown,
  ): OfficialMediaBeginDecision {
    const action = officialMediaActionForTool(toolName, input);
    if (!action) return { allowed: true };

    const blockedReason = this.blockedReason(action);
    if (blockedReason) {
      return { allowed: false, reason: blockedReason };
    }

    if (action === "discover") this.discoveryAttempts += 1;
    if (action === "localize") this.localizationAttempts += 1;
    if (action === "placeholder") this.placeholderAttempts += 1;
    this.totalAttempts += 1;

    const permit: OfficialMediaAttemptPermit = Object.freeze({
      id: this.nextPermitId,
      action,
      toolName: String(toolName ?? "").trim().toLowerCase(),
    });
    this.nextPermitId += 1;
    this.activePermits.set(permit.id, permit);
    return { allowed: true, permit };
  }

  recordToolResult(
    permit: OfficialMediaAttemptPermit,
    outcome: OfficialMediaToolOutcome,
  ): void {
    const active = this.activePermits.get(permit.id);
    if (!active || active !== permit) return;
    this.activePermits.delete(permit.id);

    if (permit.action === "discover") {
      if (outcome.ok && hasOfficialCandidates(outcome.data)) {
        this.state = "official_localize";
        return;
      }
      if (
        this.discoveryAttempts >= this.maxDiscoveryAttempts
        || this.totalAttempts >= this.maxTotalAttempts
      ) {
        this.enterFallback();
      } else {
        this.state = "official_discovery";
      }
      return;
    }

    if (permit.action === "localize") {
      if (outcome.ok) {
        this.state = "official_ready";
        return;
      }
      if (
        this.localizationAttempts >= this.maxLocalizationAttempts
        || this.totalAttempts >= this.maxTotalAttempts
      ) {
        this.enterFallback();
      } else {
        this.state = "official_localize";
      }
      return;
    }

    if (outcome.ok) {
      this.state = "placeholder_ready";
      return;
    }
    if (
      this.placeholderAttempts >= this.maxPlaceholderAttempts
      || this.totalAttempts >= this.maxTotalAttempts
    ) {
      this.state = "blocked";
    } else {
      this.state = "placeholder_required";
    }
  }

  shouldIssuePlaceholderRecovery(): boolean {
    return (
      this.state === "placeholder_required"
      && this.allowPlaceholders
      && !this.placeholderRecoveryIssued
    );
  }

  markPlaceholderRecoveryIssued(): void {
    if (this.state === "placeholder_required") {
      this.placeholderRecoveryIssued = true;
    }
  }

  snapshot(): OfficialMediaBudgetSnapshot {
    return {
      state: this.state,
      discoveryAttempts: this.discoveryAttempts,
      localizationAttempts: this.localizationAttempts,
      placeholderAttempts: this.placeholderAttempts,
      totalAttempts: this.totalAttempts,
      maxDiscoveryAttempts: this.maxDiscoveryAttempts,
      maxLocalizationAttempts: this.maxLocalizationAttempts,
      maxPlaceholderAttempts: this.maxPlaceholderAttempts,
      maxTotalAttempts: this.maxTotalAttempts,
      allowPlaceholders: this.allowPlaceholders,
    };
  }

  private blockedReason(
    action: OfficialMediaBudgetAction,
  ): string | undefined {
    if (
      [...this.activePermits.values()]
        .some((permit) => permit.action === action)
    ) {
      return `Official media ${action} already has an in-flight attempt.`;
    }
    if (
      this.state === "official_ready"
      || this.state === "placeholder_ready"
      || this.state === "blocked"
    ) {
      return `Official media ${action} is blocked by FSM state ${this.state}.`;
    }
    if (this.totalAttempts >= this.maxTotalAttempts) {
      return "Official media total attempt budget is exhausted.";
    }
    if (action === "discover") {
      if (this.state !== "official_discovery") {
        return `Official media discovery is blocked by FSM state ${this.state}.`;
      }
      if (this.discoveryAttempts >= this.maxDiscoveryAttempts) {
        return "Official media discovery budget is exhausted.";
      }
    }
    if (action === "localize") {
      if (this.state !== "official_localize") {
        return `Official media localization is blocked by FSM state ${this.state}.`;
      }
      if (this.localizationAttempts >= this.maxLocalizationAttempts) {
        return "Official media localization budget is exhausted.";
      }
    }
    if (action === "placeholder") {
      if (!this.allowPlaceholders) {
        return "Official media placeholders are forbidden by the goal contract.";
      }
      if (this.state !== "placeholder_required") {
        return `Official media placeholder is blocked by FSM state ${this.state}.`;
      }
      if (this.placeholderAttempts >= this.maxPlaceholderAttempts) {
        return "Official media placeholder budget is exhausted.";
      }
    }
    return undefined;
  }

  private enterFallback(): void {
    this.state = this.allowPlaceholders
      ? "placeholder_required"
      : "blocked";
  }
}

/** Context-facing name: the FSM itself owns the cross-turn attempt budget. */
export type OfficialMediaBudget = OfficialMediaFallbackStateMachine;

const sharedStateMachines =
  new Map<string, OfficialMediaFallbackStateMachine>();

function normalizeScopePart(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 512) {
    throw new Error(`Official media budget ${label} is invalid.`);
  }
  return normalized;
}

export function buildOfficialMediaBudgetScopeKey(
  scope: OfficialMediaBudgetScope,
): string {
  const goalVersion = scope.goalVersion;
  if (!Number.isSafeInteger(goalVersion) || goalVersion < 1) {
    throw new Error("Official media budget goalVersion is invalid.");
  }
  const workspace = path.resolve(
    normalizeScopePart(scope.workspaceRoot, "workspaceRoot"),
  );
  return createHash("sha256").update(JSON.stringify([
    normalizeScopePart(scope.tenantScopeId, "tenantScopeId"),
    normalizeScopePart(scope.principalScopeId, "principalScopeId"),
    process.platform === "win32" ? workspace.toLowerCase() : workspace,
    normalizeScopePart(scope.sessionId, "sessionId"),
    normalizeScopePart(scope.taskRoot, "taskRoot")
      .replace(/\\/gu, "/")
      .replace(/\/+$/u, ""),
    goalVersion,
  ])).digest("hex");
}

export function getOfficialMediaFallbackStateMachine(
  scope: OfficialMediaBudgetScope,
  options: OfficialMediaFallbackStateMachineOptions,
): OfficialMediaFallbackStateMachine {
  const key = buildOfficialMediaBudgetScopeKey(scope);
  const existing = sharedStateMachines.get(key);
  if (existing) {
    sharedStateMachines.delete(key);
    sharedStateMachines.set(key, existing);
    return existing;
  }
  while (sharedStateMachines.size >= MAX_SHARED_STATE_MACHINES) {
    const oldest = sharedStateMachines.keys().next().value;
    if (oldest === undefined) break;
    sharedStateMachines.delete(oldest);
  }
  const created = new OfficialMediaFallbackStateMachine(options);
  sharedStateMachines.set(key, created);
  return created;
}

export function resetOfficialMediaFallbackStateMachinesForTests(): void {
  sharedStateMachines.clear();
}
