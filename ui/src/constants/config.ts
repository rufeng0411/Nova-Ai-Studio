/**
 * Environment Flag: Is Platform
 * Indicates if the app is running in Platform mode (hosted) or OSS mode (self-hosted)
 */
export const IS_PLATFORM = import.meta.env.VITE_IS_PLATFORM === 'true';

/**
 * Matches server PILOTDECK_DISABLE_LOCAL_AUTH (injected in vite.config.js).
 */
export const DISABLE_LOCAL_AUTH = import.meta.env.VITE_DISABLE_LOCAL_AUTH === 'true';

/** PD-SAAS-FORK: Multi-tenant SaaS — requires login; never use fake local user. */
export const IS_SAAS_MODE = import.meta.env.VITE_PILOTDECK_SAAS_MODE === 'true';

/** Tail-first history paging (backward API). Default off; dev:saas enables via env. */
export const TAIL_MESSAGE_PAGINATION = import.meta.env.VITE_TAIL_MESSAGE_PAGINATION === 'true';