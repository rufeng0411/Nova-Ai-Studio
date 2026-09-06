/**
 * Shared transient network error detection for tools and model streaming.
 */

const TRANSIENT_NETWORK_PATTERN =
  /(?:fetch failed|network|econnreset|econnrefused|etimedout|socket hang up|epipe|timeout|aborted|temporar|rate limit|too many requests)/i;

export function isTransientNetworkError(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  return TRANSIENT_NETWORK_PATTERN.test(message);
}

export function isTransientNetworkErrorFromUnknown(error: unknown): boolean {
  if (error instanceof Error) {
    return isTransientNetworkError(error.message);
  }
  return isTransientNetworkError(String(error));
}
