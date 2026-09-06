import type { TrustedExecutionScope } from "./capabilityScopeContract.js";
import type { SessionGoalQualityContract } from "./goalQualityContract.js";
import { goalQualityContractMode } from "../resilience/stabilityFlags.js";

/**
 * PD-SAAS-FORK: Exact capability and tenant allowlists select quality-contract
 * rollout. Empty allowlists deliberately select nobody.
 */
export type QualityContractMode = "off" | "shadow" | "enforce";

export type QualityCanaryPolicy = {
  configuredMode: QualityContractMode;
  effectiveMode: QualityContractMode;
  selected: boolean;
  exactCapabilityMatch: boolean;
  exactTenantMatch: boolean;
};

export type ResolveQualityCanaryPolicyInput = {
  capabilitySlug?: string | null;
  trustedScope: TrustedExecutionScope;
  env?: Record<string, string | undefined>;
};

export type BoundedQualityShadowDiff = {
  changed: boolean;
  fields: Array<
    | "subject_anchor"
    | "exact_quantity"
    | "official_media"
    | "placeholder_policy"
    | "tool_policy"
  >;
  exactAssertionCount: number;
  allowedSourceTierCount: number;
  toolAllowCount: number;
  toolDenyCount: number;
};

export type QualityAcceptanceMeta = {
  qualityContractHash: string;
  qualityContractMode: QualityContractMode;
  qualityContractShadowDiff?: BoundedQualityShadowDiff;
};

function parseMode(value: unknown): QualityContractMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "shadow" || normalized === "enforce") {
    return normalized;
  }
  return "off";
}

function parseExactAllowlist(
  value: unknown,
  normalizeCase: boolean,
): Set<string> {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeCase ? item.toLowerCase() : item);
  return new Set(items);
}

export function resolveQualityCanaryPolicy(
  input: ResolveQualityCanaryPolicyInput,
): QualityCanaryPolicy {
  const env = input.env ?? process.env;
  const configuredMode = input.env
    ? parseMode(env.PILOTDECK_GOAL_QUALITY_CONTRACT)
    : goalQualityContractMode();
  const capabilityAllowlist = parseExactAllowlist(
    env.PILOTDECK_GOAL_QUALITY_CANARY_SLUGS,
    true,
  );
  const tenantAllowlist = parseExactAllowlist(
    env.PILOTDECK_GOAL_QUALITY_CANARY_TENANTS,
    false,
  );
  const capabilitySlug = String(input.capabilitySlug ?? "")
    .trim()
    .toLowerCase();
  const tenantScopeId = String(input.trustedScope.tenantScopeId ?? "").trim();
  const exactCapabilityMatch =
    capabilityAllowlist.size > 0 && capabilityAllowlist.has(capabilitySlug);
  const exactTenantMatch =
    tenantAllowlist.size > 0 && tenantAllowlist.has(tenantScopeId);
  const selected =
    configuredMode !== "off"
    && exactCapabilityMatch
    && exactTenantMatch;

  return {
    configuredMode,
    effectiveMode: selected ? configuredMode : "off",
    selected,
    exactCapabilityMatch,
    exactTenantMatch,
  };
}

export function buildBoundedQualityShadowDiff(
  contract: SessionGoalQualityContract,
): BoundedQualityShadowDiff {
  const fields: BoundedQualityShadowDiff["fields"] = [];
  if (contract.subjectAnchor || contract.subjectAliases.length > 0) {
    fields.push("subject_anchor");
  }
  if (contract.exactQuantityAssertions.length > 0) {
    fields.push("exact_quantity");
  }
  if (
    contract.officialMediaPolicy !== "none"
    || contract.allowedSourceTiers.length > 0
  ) {
    fields.push("official_media");
  }
  if (!contract.allowPlaceholders) {
    fields.push("placeholder_policy");
  }
  if (
    contract.forbidGenerateImage
    || (contract.toolPolicy?.allow?.length ?? 0) > 0
    || (contract.toolPolicy?.deny?.length ?? 0) > 0
  ) {
    fields.push("tool_policy");
  }
  return {
    changed: fields.length > 0,
    fields,
    exactAssertionCount: Math.min(
      contract.exactQuantityAssertions.length,
      8,
    ),
    allowedSourceTierCount: Math.min(
      contract.allowedSourceTiers.length,
      3,
    ),
    toolAllowCount: Math.min(contract.toolPolicy?.allow?.length ?? 0, 16),
    toolDenyCount: Math.min(contract.toolPolicy?.deny?.length ?? 0, 16),
  };
}

export function buildQualityAcceptanceMeta(input: {
  qualityContractHash: string;
  effectiveMode: QualityContractMode;
  shadowDiff?: BoundedQualityShadowDiff;
}): QualityAcceptanceMeta {
  return {
    qualityContractHash: input.qualityContractHash,
    qualityContractMode: input.effectiveMode,
    ...(input.effectiveMode === "shadow" && input.shadowDiff
      ? { qualityContractShadowDiff: input.shadowDiff }
      : {}),
  };
}
