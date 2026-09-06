/** PD-SAAS-FORK: matches server CONVERSATION_ORPHAN_ERROR */
export const CONVERSATION_ORPHAN_ERROR = 'conversation_orphan';

export type SessionLoadFailureKind = 'orphan' | 'generic';

export function resolveSessionLoadFailureKind(error: unknown): SessionLoadFailureKind {
  if (error instanceof Error && error.message === CONVERSATION_ORPHAN_ERROR) {
    return 'orphan';
  }
  if (typeof error === 'string' && error === CONVERSATION_ORPHAN_ERROR) {
    return 'orphan';
  }
  return 'generic';
}

export function isConversationOrphanError(message: string | null | undefined): boolean {
  return message === CONVERSATION_ORPHAN_ERROR;
}
