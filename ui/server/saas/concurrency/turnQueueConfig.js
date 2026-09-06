/**
 * PD-SAAS-FORK: Turn queue feature flag and concurrency limits.
 */

/** @param {NodeJS.ProcessEnv} [env] */
export function isTurnQueueEnabled(env = process.env) {
  const raw = env.PILOTDECK_TURN_QUEUE;
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  // dev:saas default on when unset
  return env.PILOTDECK_SAAS_MODE === '1' || env.NODE_ENV !== 'production';
}

const USER_LIMIT_DEFAULT = Number(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS || 7);
const USER_LIMIT_ADMIN = Number(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS_ADMIN || 7);
const GLOBAL_LIMIT = Number(process.env.PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS || 7);

/**
 * @param {string | null | undefined} role
 */
export function resolveUserTurnLimit(role) {
  const userLimitDefault = Number(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS || USER_LIMIT_DEFAULT);
  const userLimitAdmin = Number(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS_ADMIN || USER_LIMIT_ADMIN);
  if (userLimitDefault <= 0) return Infinity;
  if (role === 'super-admin' || role === 'admin') {
    return userLimitAdmin > 0 ? userLimitAdmin : userLimitDefault;
  }
  return userLimitDefault;
}

export function resolveGlobalTurnLimit() {
  const globalLimit = Number(process.env.PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS || GLOBAL_LIMIT);
  return globalLimit > 0 ? globalLimit : Infinity;
}
