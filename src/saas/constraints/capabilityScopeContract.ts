import type { SessionGoalQualityContract } from "./goalQualityContract.js";
import type { QualityContractMode } from "./qualityCanaryPolicy.js";

/**
 * PD-SAAS-FORK: Quality enforcement consumes only server-derived execution
 * scope. User prompt text and launch context must never construct this value.
 */
export type TrustedExecutionScope = {
  tenantScopeId: string;
  principalScopeId: string;
};

export type ResolveTrustedExecutionScopeInput = {
  pilotHomeTenantId?: string | null;
  authenticatedPrincipalId?: string | null;
  claimedScope?: TrustedExecutionScope | null;
};

function normalizeScopePart(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 160) return null;
  return normalized;
}

export function resolveTrustedExecutionScope(
  input: ResolveTrustedExecutionScopeInput,
): TrustedExecutionScope {
  const pilotHomeTenantId = normalizeScopePart(input.pilotHomeTenantId);
  const principalId =
    normalizeScopePart(input.authenticatedPrincipalId) ?? "local";
  const claimedTenantId = normalizeScopePart(
    input.claimedScope?.tenantScopeId,
  );
  const claimedPrincipalId = normalizeScopePart(
    input.claimedScope?.principalScopeId,
  );

  if (!pilotHomeTenantId) {
    if (
      claimedTenantId
      && claimedTenantId !== "local"
    ) {
      throw new Error(
        "trusted tenant scope cannot be claimed without a tenant pilotHome",
      );
    }
    if (
      claimedPrincipalId
      && claimedPrincipalId !== "local"
    ) {
      throw new Error(
        "trusted principal scope cannot be claimed in standalone mode",
      );
    }
    return {
      tenantScopeId: "local",
      principalScopeId: "local",
    };
  }

  if (claimedTenantId && claimedTenantId !== pilotHomeTenantId) {
    throw new Error(
      "trusted tenant scope does not match the tenant pilotHome",
    );
  }
  if (
    claimedPrincipalId
    && claimedPrincipalId !== principalId
  ) {
    throw new Error(
      "trusted principal scope does not match the authenticated principal",
    );
  }
  return {
    tenantScopeId: pilotHomeTenantId,
    principalScopeId: principalId,
  };
}

export function isToolAllowedByQualityContract(
  toolName: string,
  contract: SessionGoalQualityContract | null | undefined,
  mode: QualityContractMode,
): boolean {
  if (!contract || mode !== "enforce") return true;
  const normalizedToolName = String(toolName ?? "").trim();
  if (!normalizedToolName) return false;
  if (contract.toolPolicy?.deny?.includes(normalizedToolName)) {
    return false;
  }
  const allow = contract.toolPolicy?.allow;
  if (allow && allow.length > 0) {
    return allow.includes(normalizedToolName);
  }
  return true;
}
