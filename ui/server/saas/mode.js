/**
 * PD-SAAS-FORK: SaaS mode flag — use PILOTDECK_SAAS_MODE, not IS_PLATFORM.
 */

/**
 * @returns {boolean} True when multi-tenant SaaS auth and tenant paths are active.
 */
export function isSaasMode(env = process.env) {
  const raw = env.PILOTDECK_SAAS_MODE;
  return raw === '1' || raw === 'true';
}
