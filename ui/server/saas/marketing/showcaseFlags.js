// PD-SAAS-FORK: Showcase site / admin / i18n flags

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'off'|'on'}
 */
export function getShowcaseSiteMode(env = process.env) {
  const raw = String(env.PILOTDECK_SHOWCASE_SITE ?? 'on').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return 'off';
  return 'on';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'off'|'shadow'|'enforce'}
 */
export function getShowcaseAdminMode(env = process.env) {
  const raw = String(env.PILOTDECK_SHOWCASE_ADMIN ?? 'shadow').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return 'off';
  if (raw === 'enforce') return 'enforce';
  return 'shadow';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isMarketingI18nEnabled(env = process.env) {
  const raw = env.PILOTDECK_MARKETING_I18N;
  if (raw === undefined || raw === '') return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [dataRoot]
 */
export function resolveShowcaseDataRoot(env = process.env, dataRoot) {
  const fromEnv = env.PILOTDECK_SHOWCASE_DATA_ROOT?.trim();
  if (fromEnv) return fromEnv;
  const root = dataRoot || env.DATA_ROOT?.trim();
  if (root) return `${root.replace(/[\\/]+$/, '')}/marketing-showcase`;
  return null;
}

/**
 * @param {string} rel relative path under marketing root e.g. showcase/shared/catalog.js
 */
export function isShowcaseCatalogPath(rel) {
  const base = String(rel || '').replace(/\\/g, '/').split('/').pop() || '';
  return (
    base === 'catalog.js' ||
    base === 'fullcases.js' ||
    base === 'copy-packs.js' ||
    base === 'copy-reader.js' ||
    base === 'site.js'
  );
}
