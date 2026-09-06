/**
 * PD-SAAS-FORK: cross-process session queue/catalog mutation lock.
 */
import path from 'node:path';
import { withTranscriptFileLock } from '../../../../src/session/transcript/lockedTranscriptAppend.js';
import { normalizeSessionId } from '../conversation/normalizeSessionId.js';

export function withTurnQueueSessionFileLock(input, operation) {
  const sessionId = normalizeSessionId(input.sessionId);
  if (!sessionId || !input.tenantPilotHome) return operation();
  const lockTarget = path.join(
    input.tenantPilotHome,
    'projects',
    '.turn-accept-locks',
    `${sessionId}.accept`,
  );
  return withTranscriptFileLock(lockTarget, operation, {
    maxWaitMs: 10_000,
    staleAfterMs: 30_000,
  });
}
