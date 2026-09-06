// Ensure unified YAML config is applied before reading flags.
import '../load-env.js';

/**
 * Environment Flag: Is Platform
 * Indicates if the app is running in Platform mode (hosted) or OSS mode (self-hosted)
 */
export const IS_PLATFORM = process.env.VITE_IS_PLATFORM === 'true';

/**
 * When true, skip JWT login/register in the web UI (single-user local mode).
 * Set PILOTDECK_DISABLE_LOCAL_AUTH=0 or false to require username/password again.
 * @type {boolean}
 */
export const DISABLE_LOCAL_AUTH =
  process.env.PILOTDECK_DISABLE_LOCAL_AUTH !== '0' &&
  process.env.PILOTDECK_DISABLE_LOCAL_AUTH !== 'false';

/**
 * PD-SAAS-FORK: Multi-tenant SaaS mode — forces JWT auth; do not use IS_PLATFORM for this.
 * @type {boolean}
 */
export const IS_SAAS_MODE =
  process.env.PILOTDECK_SAAS_MODE === '1' ||
  process.env.PILOTDECK_SAAS_MODE === 'true';
