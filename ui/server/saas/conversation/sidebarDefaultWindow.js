/**
 * PD-SAAS-FORK: default sidebar catalog time window (days).
 */
export function resolveSidebarDefaultSinceMs(includeOlder = false) {
  if (includeOlder) return undefined;
  const days = Number(process.env.SAAS_SIDEBAR_DEFAULT_DAYS ?? 7);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}
