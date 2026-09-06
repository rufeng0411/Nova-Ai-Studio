// PD-SAAS-FORK P0-9: exact-canary gating for CONTENT_QUALITY_V2 enforcement.

import {
  contentQualityV2Mode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import type { TrustedExecutionScope } from "./capabilityScopeContract.js";

export type ContentQualityCanaryPolicy = {
  configuredMode: StabilityTriStateMode;
  effectiveMode: StabilityTriStateMode;
  selected: boolean;
  exactCapabilityMatch: boolean;
  exactTenantMatch: boolean;
};

export type ResolveContentQualityCanaryPolicyInput = {
  capabilitySlug?: string | null;
  trustedScope?: TrustedExecutionScope | null;
  env?: Record<string, string | undefined>;
};

function parseExactAllowlist(
  value: unknown,
  normalizeCase: boolean,
): Set<string> {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (normalizeCase ? item.toLowerCase() : item));
  return new Set(items);
}

export function resolveContentQualityCanaryPolicy(
  input: ResolveContentQualityCanaryPolicyInput,
): ContentQualityCanaryPolicy {
  const env = input.env ?? process.env;
  const configuredMode = contentQualityV2Mode();
  const capabilityAllowlist = parseExactAllowlist(
    env.PILOTDECK_QUALITY_CANARY_SLUGS,
    true,
  );
  const tenantAllowlist = parseExactAllowlist(
    env.PILOTDECK_QUALITY_CANARY_TENANTS,
    false,
  );
  const capabilitySlug = String(input.capabilitySlug ?? "")
    .trim()
    .toLowerCase();
  const tenantScopeId = String(input.trustedScope?.tenantScopeId ?? "").trim();
  const exactCapabilityMatch =
    capabilityAllowlist.size > 0 && capabilityAllowlist.has(capabilitySlug);
  const exactTenantMatch =
    tenantAllowlist.size === 0
    || (tenantScopeId.length > 0 && tenantAllowlist.has(tenantScopeId));
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

export function shouldEnforceContentQualityChecks(
  policy: ContentQualityCanaryPolicy,
): boolean {
  return policy.effectiveMode === "enforce" && policy.selected;
}
