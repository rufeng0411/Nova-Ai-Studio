/**
 * PD-SAAS-FORK: SaaS backend registration (control DB, auth, tenant middleware).
 */
import { isSaasMode } from './mode.js';
import { bootstrapSaasControlPlane, SAAS_ADMIN_USERNAME } from './auth/bootstrap.js';
import { getDataRoot } from './tenant/paths.js';
import { createCaptchaChallenge } from './billing/captcha.js';
import billingRoutes from './billing/routes.js';
import adminRoutes from './analytics/routes.js';
import platformRoutes from './platform/routes.js';
import usageRoutes from './usage/routes.js';
import preferencesRoutes from './preferences/routes.js';
import storageRoutes from './storage/routes.js';
import avatarRoutes from './account/avatarRoutes.js';
import n2BotRoutes from './n2-bot/routes.js';
import { authenticateToken } from '../middleware/auth.js';
import { recordAnalyticsEvent } from './analytics/store.js';
import { getControlDbBackend, getControlDbPath, pingControlDatabase, closeControlDatabase } from './db/control.js';
import { startCatalogBackgroundJobs } from './conversation/catalogCache.js';
import { isCatalogShadowWriteEnabled } from './conversation/featureFlags.js';
import { registerMarketingRoutes } from './marketing/routes.js';
import userGroupsAdminRoutes from './userGroups/routes.js';
import imNotifyAdminRoutes from './imNotify/routes.js';
import imChannelsAdminRoutes from './imChannels/routes.js';

export { isSaasMode } from './mode.js';
export { getLegacyPilotHome, bootstrapTenantLayout } from './legacyBridge.js';
export {
  getDataRoot,
  getTenantProjectsRoot,
  getTenantPilotHome,
  DEFAULT_TENANT_ID,
} from './tenant/paths.js';
export { controlUserDb, getControlDbPath, getControlDbBackend, pingControlDatabase, closeControlDatabase } from './db/control.js';

function isLocalDevControlDbFallbackEligible() {
  if (process.env.DEV_SAAS_SQLITE === '1') return true;
  const root = getDataRoot().replace(/\\/g, '/');
  return root.includes('.saas-dev-data');
}

/**
 * @param {(line: string) => void} log
 */
async function ensureControlDatabaseReady(log) {
  let dbOk = await pingControlDatabase();
  if (
    !dbOk
    && process.env.SAAS_DATABASE_URL?.trim()
    && isLocalDevControlDbFallbackEligible()
  ) {
    log('[saas] PostgreSQL 不可用，开发环境自动回退 SQLite');
    delete process.env.SAAS_DATABASE_URL;
    await closeControlDatabase();
    dbOk = await pingControlDatabase();
    log(`[saas] Control DB: ${getControlDbBackend()} (${getControlDbPath()})`);
  }
  return dbOk;
}

/**
 * Run once during server startup (before listen).
 * @param {{ log?: (line: string) => void }} [options]
 */
export async function initializeSaasBackend(options = {}) {
  if (!isSaasMode()) {
    return null;
  }

  const log = options.log ?? ((line) => console.log(line));
  log('');
  log('[saas] SaaS mode enabled (PILOTDECK_SAAS_MODE)');
  log(`[saas] DATA_ROOT: ${getDataRoot()}`);
  log(`[saas] Control DB: ${getControlDbBackend()} (${getControlDbBackend() === 'postgres' ? 'SAAS_DATABASE_URL' : getControlDbPath()})`);
  const dbOk = await ensureControlDatabaseReady(log);
  if (!dbOk) {
    throw new Error('[saas] control database ping failed — check SAAS_DATABASE_URL or DATA_ROOT');
  }
  log(`[saas] Platform admin: ${SAAS_ADMIN_USERNAME} (password from SAAS_ADMIN_PASSWORD)`);
  log('');

  if (isCatalogShadowWriteEnabled()) {
    startCatalogBackgroundJobs();
    log('[saas] conversation_catalog shadow write enabled');
  }

  return bootstrapSaasControlPlane({ log });
}

/**
 * @param {import('express').Express} app
 */
export function registerSaas(app) {
  if (!isSaasMode()) {
    return;
  }

  app.get('/api/saas/captcha', async (_req, res) => {
    try {
      res.json(await createCaptchaChallenge());
    } catch (error) {
      console.error('[saas] captcha error:', error);
      res.status(500).json({ error: 'captcha_unavailable' });
    }
  });

  app.get('/api/saas/health', async (_req, res) => {
    const dbOk = await pingControlDatabase();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      backend: getControlDbBackend(),
      db: dbOk ? 'ok' : 'fail',
    });
  });

  // PD-SAAS-FORK (P0-A1): readiness must stay lightweight — never warm project directories here
  // (high load + sync FS can wedged the probe and fail load/soak gates falsely).
  app.get('/api/saas/health/ready', async (_req, res) => {
    const started = Date.now();
    const dbOk = await pingControlDatabase();
    const ms = Date.now() - started;
    if (!dbOk) {
      return res.status(503).json({
        ok: false,
        backend: getControlDbBackend(),
        db: 'fail',
        probe: 'control_db',
        ms,
      });
    }
    return res.json({
      ok: true,
      backend: getControlDbBackend(),
      db: 'ok',
      probe: 'control_db',
      ms,
    });
  });

  app.use('/api/saas/billing', billingRoutes);
  app.use('/api/saas/admin/user-groups', userGroupsAdminRoutes);
  // PD-SAAS-FORK: IM notify MCP + App chat channels (register before /admin catch-all)
  app.use('/api/saas/admin/im-notify', imNotifyAdminRoutes);
  app.use('/api/saas/admin/im-channels', imChannelsAdminRoutes);
  app.use('/api/saas/admin', adminRoutes);
  app.use('/api/saas/platform', platformRoutes);
  app.use('/api/saas/usage', usageRoutes);
  app.use('/api/saas', preferencesRoutes);
  app.use('/api/saas', storageRoutes);
  app.use('/api/saas', avatarRoutes);
  app.use('/api/saas/n2-bot', n2BotRoutes);
  // PD-SAAS-FORK: marketing contact / collect / admin (public + admin)
  registerMarketingRoutes(app);

  app.use('/api/saas/analytics/visit', authenticateToken, async (req, res) => {
    await recordAnalyticsEvent('visit', {
      userId: req.user.id,
      tenantId: req.user.tenant_id,
    });
    res.json({ ok: true });
  });
}
