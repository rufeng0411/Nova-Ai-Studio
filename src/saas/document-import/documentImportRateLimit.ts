// PD-SAAS-FORK: in-memory tenant rate limit for document import (SaaS)
const buckets = new Map<string, { tokens: number; updatedAt: number }>();

const LIMIT_PER_MINUTE = 5;
const WINDOW_MS = 60_000;

export function checkDocumentImportRateLimit(tenantId: string | undefined): { allowed: boolean; retryAfterMs?: number } {
  if (!tenantId || tenantId === "local") {
    return { allowed: true };
  }
  const now = Date.now();
  const bucket = buckets.get(tenantId) ?? { tokens: LIMIT_PER_MINUTE, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  if (elapsed >= WINDOW_MS) {
    bucket.tokens = LIMIT_PER_MINUTE;
    bucket.updatedAt = now;
  }
  if (bucket.tokens <= 0) {
    const retryAfterMs = WINDOW_MS - elapsed;
    buckets.set(tenantId, bucket);
    return { allowed: false, retryAfterMs: Math.max(1000, retryAfterMs) };
  }
  bucket.tokens -= 1;
  buckets.set(tenantId, bucket);
  return { allowed: true };
}

export function resetDocumentImportRateLimitForTests(): void {
  buckets.clear();
}
