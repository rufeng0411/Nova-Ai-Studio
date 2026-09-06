/**
 * PD-SAAS-FORK: decide scroll behavior when returning to a session.
 */
export type SessionScrollDecision =
  | { action: 'restore'; scrollTop: number }
  | { action: 'scrollBottom' }
  | { action: 'keep' };

export function resolveSessionScrollDecision(input: {
  enabled: boolean;
  uiScrollTop?: number;
  uiScrollCapturedAt?: number;
  hasEverVisited: boolean;
  wasNearBottomAtLeave: boolean;
  searchScrollActive: boolean;
  isLoadingSessionMessages: boolean;
  messageCount: number;
  pendingScrollRestore: boolean;
}): SessionScrollDecision {
  if (input.searchScrollActive || input.pendingScrollRestore) {
    return { action: 'keep' };
  }

  if (input.isLoadingSessionMessages) {
    return { action: 'keep' };
  }

  if (!input.enabled || input.messageCount === 0) {
    return { action: 'scrollBottom' };
  }

  if (!input.hasEverVisited) {
    return { action: 'scrollBottom' };
  }

  if (input.wasNearBottomAtLeave) {
    return { action: 'scrollBottom' };
  }

  if (typeof input.uiScrollTop === 'number' && Number.isFinite(input.uiScrollTop)) {
    return { action: 'restore', scrollTop: input.uiScrollTop };
  }

  return { action: 'scrollBottom' };
}
