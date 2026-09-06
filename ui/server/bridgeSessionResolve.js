/**
 * PD-SAAS-FORK: Resolve bridge sessionState / gateway keys across web:s_ / web-s_ aliases.
 */
import { sessionIdVariants } from './saas/conversation/normalizeSessionId.js';

export function isPilotDeckSessionKey(value) {
    return typeof value === 'string' && /^web[:_-]s_/.test(value);
}

/**
 * @param {Map<string, {
 *   sessionKey?: string;
 *   runId?: string;
 *   active?: boolean;
 * }>} sessionState
 * @param {string | null | undefined} sessionId
 * @returns {{ state: object; sessionKey: string } | null}
 */
export function resolveBridgeSessionState(sessionState, sessionId) {
    if (!isPilotDeckSessionKey(sessionId)) return null;
    const variants = sessionIdVariants(sessionId);
    for (const variant of variants) {
        const state = sessionState.get(variant);
        if (state) {
            return {
                state,
                sessionKey: typeof state.sessionKey === 'string' ? state.sessionKey : variant,
            };
        }
    }
    for (const state of sessionState.values()) {
        const key = typeof state.sessionKey === 'string' ? state.sessionKey : '';
        if (!key) continue;
        if (variants.some((variant) => variant === key)) {
            return { state, sessionKey: key };
        }
    }
    return null;
}

/**
 * @param {Map<string, object>} sessionState
 * @param {string | null | undefined} sessionId
 * @returns {string[]}
 */
export function bridgeAbortSessionKeys(sessionState, sessionId) {
    if (!isPilotDeckSessionKey(sessionId)) return [];
    const resolved = resolveBridgeSessionState(sessionState, sessionId);
    return [...new Set([
        ...(resolved ? [resolved.sessionKey] : []),
        ...sessionIdVariants(sessionId),
    ])];
}
