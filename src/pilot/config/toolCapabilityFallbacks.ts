// PD-SAAS-FORK: execute tool capability chains (primary + up to 2 fallbacks)

import { PilotDeckToolRuntimeError } from "../../tool/protocol/errors.js";
import { MAX_TOOL_CAPABILITY_FALLBACKS } from "../../model/config/providerApiKeys.js";

export function clampToolCapabilityFallbacks<T>(raw: T[] | undefined): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_TOOL_CAPABILITY_FALLBACKS);
}

export function isCapabilityFallbackEligible(error: unknown): boolean {
  if (!(error instanceof PilotDeckToolRuntimeError)) {
    return true;
  }
  if (error.code === "invalid_tool_input" || error.code === "tool_cancelled") {
    return false;
  }
  return true;
}

export async function executeWithCapabilityFallbacks<T>(
  attempts: Array<() => Promise<T>>,
): Promise<T> {
  if (attempts.length === 0) {
    throw new PilotDeckToolRuntimeError("unsupported_tool", "No capability attempts configured.");
  }
  let lastError: unknown;
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      return await attempts[index]!();
    } catch (error) {
      lastError = error;
      const hasNext = index < attempts.length - 1;
      if (!hasNext || !isCapabilityFallbackEligible(error)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
