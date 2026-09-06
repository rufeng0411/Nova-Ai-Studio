// PD-SAAS-FORK: Public Markdown share flag off|shadow|enforce

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'off'|'shadow'|'enforce'}
 */
export function getPublicMdShareMode(env = process.env) {
  const raw = String(env.PILOTDECK_PUBLIC_MD_SHARE ?? '').trim().toLowerCase();
  if (!raw) {
    // Fail-closed when unset in production-ish; callers may inject defaults via launcher/pack.
    return 'off';
  }
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'enforce') return 'enforce';
  if (raw === 'shadow') return 'shadow';
  if (raw === '0' || raw === 'false' || raw === 'off') return 'off';
  return 'off';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isPublicMdShareWritable(env = process.env) {
  const mode = getPublicMdShareMode(env);
  return mode === 'shadow' || mode === 'enforce';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isPublicMdShareEnforce(env = process.env) {
  return getPublicMdShareMode(env) === 'enforce';
}
