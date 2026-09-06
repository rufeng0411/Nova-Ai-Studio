// PD-SAAS-FORK: silent single retry for transient tool failures before AgentLoop recovery
import type { PilotDeckToolErrorCode } from "./protocol/errors.js";
import { isTransientNetworkError } from "./networkErrors.js";

/** One extra attempt after the first failure (total 2 tries). */
export const TRANSIENT_TOOL_RETRY_ATTEMPTS = 1;
export const TRANSIENT_TOOL_RETRY_DELAY_MS = 800;

export function isTransientToolRetryable(
  code: PilotDeckToolErrorCode,
  message: string,
  options?: { isReadOnly?: boolean },
): boolean {
  const readOnly = options?.isReadOnly === true;
  if (code === "tool_timeout") {
    return readOnly;
  }
  if (code === "tool_execution_failed" && isTransientNetworkError(message)) {
    return readOnly;
  }
  return false;
}

export async function delayForTransientToolRetry(
  ms: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (ms <= 0) return;
  if (abortSignal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (abortSignal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
