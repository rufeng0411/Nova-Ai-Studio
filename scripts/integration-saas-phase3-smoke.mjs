#!/usr/bin/env node
/**
 * Phase 3 SaaS smoke: analytics events + dashboard aggregation.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`[saas-phase3-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-p3-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;

  const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
  const { recordAnalyticsEvent, aggregateDashboardStats } = await import(
    '../ui/server/saas/analytics/store.js',
  );
  const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');

  await bootstrapSaasControlPlane({ log: () => {} });

  await recordAnalyticsEvent('visit', { userId: 1, tenantId: 'default' });
  await recordAnalyticsEvent('register', { userId: 1, tenantId: 'default' });
  await recordAnalyticsEvent('login', { userId: 1, tenantId: 'default' });

  const stats = await aggregateDashboardStats({ routerStats: null });
  if (typeof stats.visits.total !== 'number') fail('visits.total missing');
  if (!Array.isArray(stats.users.series)) fail('users.series missing');
  if (!Array.isArray(stats.aiUsage.series)) fail('aiUsage.series missing');
  if (stats.users.total < 1) fail('expected at least admin user');

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.log('[saas-phase3-smoke] OK');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
