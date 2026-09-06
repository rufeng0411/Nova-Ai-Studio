// PD-SAAS-FORK (P0-D): unified terminal completion gate — block load-time auto-continue on finished sessions.

export type SessionTerminalCompleteReason =
  | 'sidebar'
  | 'user_ack'
  | 'passed'
  | 'circuit'
  | 'certificate';

export type TurnAcceptanceMetaEnvelopeLike = {
  acceptanceStatus?: unknown;
  circuitBreakerTripped?: unknown;
  completionState?: unknown;
};

export type ResolveSessionTerminalCompleteInput = {
  /** When false, terminal gate is bypassed (rollback). */
  gateEnabled?: boolean;
  sessionSidebarCompleted?: boolean;
  /** User explicitly unmarked sidebar「完成」— do not re-terminal from passed/ACK alone. */
  userRevokedSidebarComplete?: boolean;
  /** User satisfaction phrase without sidebar flag (optional split for D4). */
  userDeliverableAcknowledged?: boolean;
  /** Combined sidebar + ACK (ChatInterfaceV2 convenience). */
  userAcknowledgedComplete?: boolean;
  /** Messages API / sessionStore envelope — authoritative over message scan. */
  latestTurnAcceptanceMeta?: TurnAcceptanceMetaEnvelopeLike | null;
  /** Fallback when envelope missing (tail scan). */
  lastAssistantAcceptanceStatus?: string;
  lastAssistantCircuitBreakerTripped?: boolean;
  /** SDM / dock still has required slots pending — do not treat passed as terminal. */
  deliverableProgressIncomplete?: boolean;
};

export type SessionTerminalCompleteResult = {
  terminal: boolean;
  reason: SessionTerminalCompleteReason | null;
  /** D4: auto-write sidebar completed when engine passed or user ACK. */
  shouldAutoMarkSidebarComplete: boolean;
};

function envEnabled(key: string, defaultOn = true): boolean {
  const raw = import.meta.env[key];
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return defaultOn;
}

/** P0-D2: block UI cold-resume / deliverable auto-continue on terminal sessions. */
export function isSessionTerminalGateEnabled(): boolean {
  return envEnabled('VITE_SESSION_TERMINAL_GATE', true);
}

/** P0-D4: persist sidebar completed when engine passes or user ACKs. */
export function isAutoSidebarCompleteOnPassEnabled(): boolean {
  return envEnabled('VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS', true);
}

function readAcceptanceStatus(
  envelope: TurnAcceptanceMetaEnvelopeLike | null | undefined,
  fallback?: string,
): string | undefined {
  const fromEnvelope = envelope?.acceptanceStatus;
  if (typeof fromEnvelope === 'string' && fromEnvelope.trim()) {
    return fromEnvelope.trim();
  }
  return fallback?.trim() || undefined;
}

function readCertificateComplete(envelope: TurnAcceptanceMetaEnvelopeLike | null | undefined): boolean {
  return envelope?.completionState === 'complete';
}

/**
 * Resolve whether a session is in a terminal (no UI auto-continue) state.
 * Priority: envelope meta → user/sidebar signals → message scan fallback (§10.3).
 */
export function resolveSessionTerminalComplete(
  input: ResolveSessionTerminalCompleteInput,
): SessionTerminalCompleteResult {
  const none: SessionTerminalCompleteResult = {
    terminal: false,
    reason: null,
    shouldAutoMarkSidebarComplete: false,
  };
  if (input.gateEnabled === false || !isSessionTerminalGateEnabled()) {
    return none;
  }

  const sidebar = input.sessionSidebarCompleted === true;
  const userRevoked = input.userRevokedSidebarComplete === true;
  const userAck = input.userDeliverableAcknowledged === true
    || (input.userAcknowledgedComplete === true && !sidebar);
  const combinedUserAck = input.userAcknowledgedComplete === true;

  if (sidebar) {
    return { terminal: true, reason: 'sidebar', shouldAutoMarkSidebarComplete: false };
  }

  if (userRevoked) {
    return none;
  }

  const acceptanceStatus = readAcceptanceStatus(
    input.latestTurnAcceptanceMeta,
    input.lastAssistantAcceptanceStatus,
  );
  const certificateComplete = readCertificateComplete(input.latestTurnAcceptanceMeta);

  const enginePassed =
    acceptanceStatus === 'passed' && !input.deliverableProgressIncomplete;
  const engineCertificateComplete =
    certificateComplete && !input.deliverableProgressIncomplete;
  const shouldAutoMarkSidebarComplete = isAutoSidebarCompleteOnPassEnabled()
    && (enginePassed || engineCertificateComplete || combinedUserAck || userAck);

  // PD-SAAS-FORK: engine passed / user ACK → visible sidebar「完成」only (via auto-mark + pause-turn).
  // Do not treat envelope passed as an invisible terminal lock — user may「取消完成」anytime.
  if (shouldAutoMarkSidebarComplete) {
    return {
      terminal: false,
      reason: null,
      shouldAutoMarkSidebarComplete: true,
    };
  }

  return none;
}

/** Convenience for hooks that only need a boolean gate. */
export function isSessionTerminalComplete(
  input: ResolveSessionTerminalCompleteInput,
): boolean {
  return resolveSessionTerminalComplete(input).terminal;
}

export function isDeliverableManifestProgressIncomplete(
  manifest?: { slots?: Array<{ required?: boolean; status?: string }> } | null,
): boolean {
  const slots = manifest?.slots ?? [];
  if (slots.length === 0) return false;
  const required = slots.filter((slot) => slot.required !== false);
  if (required.length === 0) return false;
  const done = required.filter((slot) => slot.status === 'done').length;
  return done < required.length;
}
