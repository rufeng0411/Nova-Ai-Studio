/**
 * PD-SAAS-FORK: Bridge sessionState LRU eviction — testable helper.
 * @param {Map<string, { active?: boolean, lastActiveAt?: number }>} sessionState
 * @param {number} cap
 */
export function evictColdBridgeSessionStates(sessionState, cap) {
  if (cap <= 0 || sessionState.size <= cap) return;
  const candidates = [];
  for (const [key, state] of sessionState.entries()) {
    if (state.active) continue;
    candidates.push({ key, lastActiveAt: state.lastActiveAt ?? 0 });
  }
  candidates.sort((a, b) => a.lastActiveAt - b.lastActiveAt);
  for (const candidate of candidates) {
    if (sessionState.size <= cap) break;
    const state = sessionState.get(candidate.key);
    if (state?.active) continue;
    sessionState.delete(candidate.key);
  }
}
