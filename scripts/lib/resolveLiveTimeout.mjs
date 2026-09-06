/**
 * PD-SAAS-FORK: Central live harness timeout resolver for Gateway acceptance runs.
 */

/** @type {Record<string, { timeoutMs: number; maxTurns: number; waitAcceptanceMs?: number }>} */
const PROFILE_DEFAULTS = {
  'video-mp4': { timeoutMs: 2_400_000, maxTurns: 18 },
  'nova-slide-deck': { timeoutMs: 3_600_000, maxTurns: 16 },
  'brand-campaign-full': { timeoutMs: 2_400_000, maxTurns: 20 },
  'md-html-office-pack': { timeoutMs: 2_400_000, maxTurns: 14 },
  'saas-growth-full': { timeoutMs: 3_600_000, maxTurns: 24 },
};

/** @type {Record<string, { profileId?: string; timeoutMs: number; maxTurns: number }>} */
const CASE_DEFAULTS = {
  'video-3-step': { profileId: 'video-mp4', timeoutMs: 2_400_000, maxTurns: 18 },
  '10-page-slides': { profileId: 'nova-slide-deck', timeoutMs: 3_600_000, maxTurns: 16 },
  'campaign-6-slot': { profileId: 'brand-campaign-full', timeoutMs: 2_400_000, maxTurns: 20 },
  'case3-four-format-vap': { profileId: 'md-html-office-pack', timeoutMs: 2_400_000, maxTurns: 14 },
  'case1-saas-growth-full': { profileId: 'saas-growth-full', timeoutMs: 3_600_000, maxTurns: 24 },
  'market-add-html': { timeoutMs: 600_000, maxTurns: 12 },
  'geo-competitor-4-slot': { timeoutMs: 900_000, maxTurns: 20 },
  'blackcloak-matrix': { timeoutMs: 900_000, maxTurns: 16 },
  'geo-brand-full': { timeoutMs: 1_800_000, maxTurns: 24 },
  'spongebob-us-research': { timeoutMs: 600_000, maxTurns: 12 },
};

const ENV_CASE_KEYS = {
  'video-3-step': 'LIVE_0717_VIDEO',
  '10-page-slides': 'LIVE_0717_SLIDES',
  'campaign-6-slot': 'LIVE_0717_CAMPAIGN',
  'case3-four-format-vap': 'LIVE_ES9_FOUR_FORMAT',
  'case1-saas-growth-full': 'LIVE_ES9_SAAS_GROWTH',
  'market-add-html': 'LIVE_0717_ADD_HTML',
  'geo-competitor-4-slot': 'LIVE_0717_GEO',
  'blackcloak-matrix': 'LIVE_THREE_CASE_BLACKCLOAK',
  'geo-brand-full': 'LIVE_THREE_CASE_GEO',
  'spongebob-us-research': 'LIVE_THREE_CASE_SPONGEBOB',
};

function readEnvMs(prefix, field) {
  const direct = process.env[`${prefix}_${field}_MS`];
  if (direct != null && direct !== '') {
    const n = Number(direct);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function readEnvTurns(prefix) {
  const v = process.env[`${prefix}_MAX_TURNS`];
  if (v != null && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function readProfileEnv(profileId, field) {
  if (!profileId) return undefined;
  const kind = profileId.replace(/-/g, '_').toUpperCase();
  const v = process.env[`LIVE_TIMEOUT_${kind}_${field}_MS`] ?? process.env[`LIVE_${kind}_${field}_MS`];
  if (v != null && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * @param {{ profileId?: string; caseId?: string; waitAcceptanceMs?: number }} opts
 * @returns {{ timeoutMs: number; maxTurns: number; waitAcceptanceMs: number; profileId?: string }}
 */
export function resolveLiveTimeout(opts = {}) {
  const { caseId, profileId: explicitProfileId } = opts;
  const caseDef = caseId ? CASE_DEFAULTS[caseId] : undefined;
  const profileId = explicitProfileId ?? caseDef?.profileId;
  const profileDef = profileId ? PROFILE_DEFAULTS[profileId] : undefined;

  const envPrefix = caseId ? ENV_CASE_KEYS[caseId] : undefined;

  const timeoutMs =
    (envPrefix ? readEnvMs(envPrefix, 'TIMEOUT') : undefined)
    ?? readProfileEnv(profileId, 'TIMEOUT')
    ?? caseDef?.timeoutMs
    ?? profileDef?.timeoutMs
    ?? 900_000;

  const maxTurns =
    (envPrefix ? readEnvTurns(envPrefix) : undefined)
    ?? caseDef?.maxTurns
    ?? profileDef?.maxTurns
    ?? 16;

  const waitAcceptanceMs =
    opts.waitAcceptanceMs
    ?? profileDef?.waitAcceptanceMs
    ?? 120_000;

  return { timeoutMs, maxTurns, waitAcceptanceMs, profileId };
}

export { PROFILE_DEFAULTS, CASE_DEFAULTS };
