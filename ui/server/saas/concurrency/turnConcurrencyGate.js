/**
 * PD-SAAS-FORK: per-user / global parallel AI turn limits (WS layer).
 */

import { resolveGlobalTurnLimit, resolveUserTurnLimit } from './turnQueueConfig.js';
import { normalizeSessionId, sessionKeysMatch } from '../conversation/normalizeSessionId.js';

const CONTINUATION_ONLY = /^(继续|continue|go on|resume|ok)$/i;
const CONTINUATION_RESUME_KINDS = new Set([
  'recovery',
  'auto_continue',
  'cold_resume',
  'deliverable_repair',
  'infra_interrupt',
  'stale_turn',
  'recovery_pause',
  'ui_incomplete_deliverable',
]);

function isContinuationOnlyUserText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  return CONTINUATION_ONLY.test(trimmed);
}

/**
 * @param {{ active: boolean, ownerUserId?: number|null, sessionKey: string }[]} states
 * @param {number|null|undefined} userId
 * @param {string|null|undefined} excludeSessionKey
 */
export function countActiveTurnSessionsForUser(states, userId, excludeSessionKey) {
  if (!userId) return 0;
  const keys = new Set();
  const userIdNum = Number(userId);
  for (const state of states) {
    if (!state.active || Number(state.ownerUserId) !== userIdNum) continue;
    if (excludeSessionKey && sessionKeysMatch(state.sessionKey, excludeSessionKey)) continue;
    keys.add(normalizeSessionId(state.sessionKey) || state.sessionKey);
  }
  return keys.size;
}

/** @param {{ active: boolean, sessionKey: string }[]} states */
export function countGlobalActiveTurnSessions(states) {
  const keys = new Set();
  for (const state of states) {
    if (state.active) keys.add(normalizeSessionId(state.sessionKey) || state.sessionKey);
  }
  return keys.size;
}

function resolveUserLimit(role) {
  return resolveUserTurnLimit(role);
}

/**
 * @param {{
 *   command?: string;
 *   options?: Record<string, unknown>;
 *   resumeKind?: string;
 * }} payload
 */
export function isTurnConcurrencyExempt(payload) {
  const command = typeof payload.command === 'string' ? payload.command : '';
  if (isContinuationOnlyUserText(command)) return true;
  if (command.includes('<task-resume')) return true;
  const resumeKind = payload.options?.resumeKind ?? payload.resumeKind;
  if (typeof resumeKind === 'string' && CONTINUATION_RESUME_KINDS.has(resumeKind)) return true;
  if (payload.options?.isBackgroundTask === true) return true;
  // PD-SAAS-FORK: N2 Bot T0–T2 / steward_chat never occupy worker slots.
  const sessionKind = payload.options?.sessionKind ?? payload.sessionKind;
  const n2Tier = payload.options?.n2BotTier ?? payload.n2BotTier;
  if (sessionKind === 'n2_bot' && n2Tier !== 'T3') return true;
  if (payload.options?.stewardChat === true && sessionKind === 'n2_bot') return true;
  return false;
}

/**
 * @param {{
 *   userId: number|null|undefined;
 *   role?: string|null;
 *   command?: string;
 *   options?: Record<string, unknown>;
 *   sessionStates: { active: boolean, ownerUserId?: number|null, sessionKey: string }[];
 * }} input
 */
export function evaluateTurnConcurrencyGate(input) {
  if (isTurnConcurrencyExempt({ command: input.command, options: input.options })) {
    return { allowed: true, reason: null };
  }

  const sessionKey = typeof input.options?.sessionId === 'string'
    ? input.options.sessionId
    : typeof input.options?.sessionKey === 'string'
      ? input.options.sessionKey
      : null;

  const globalActive = countGlobalActiveTurnSessions(input.sessionStates);
  const globalLimit = resolveGlobalTurnLimit();
  if (Number.isFinite(globalLimit) && globalActive >= globalLimit) {
    const incomingActive = sessionKey
      ? input.sessionStates.some((s) => s.active && sessionKeysMatch(s.sessionKey, sessionKey))
      : false;
    if (!incomingActive) {
      return {
        allowed: false,
        reason: 'platform_busy',
        activeCount: globalActive,
        limit: globalLimit,
      };
    }
  }

  const userLimit = resolveUserLimit(input.role ?? null);
  if (!Number.isFinite(userLimit)) {
    return { allowed: true, reason: null };
  }

  const userActiveOthers = countActiveTurnSessionsForUser(
    input.sessionStates,
    input.userId,
    sessionKey,
  );
  const incomingWasActive = sessionKey
    ? input.sessionStates.some((s) => s.active && sessionKeysMatch(s.sessionKey, sessionKey))
    : false;
  const needsNewSlot = !incomingWasActive;

  if (needsNewSlot && userActiveOthers >= userLimit) {
    return {
      allowed: false,
      reason: 'parallel_limit',
      activeCount: userActiveOthers,
      limit: userLimit,
    };
  }

  return { allowed: true, reason: null };
}
