#!/usr/bin/env node
/**
 * PD-SAAS-FORK: offline migration — register legacy .cwd workspaces for cloud sync.
 *
 * Usage:
 *   node scripts/migrate-user-workspaces-to-cloud.mjs --tenant=default --userId=1 [--enable-sync]
 */
import { createSqliteDriver } from '../ui/server/saas/db/sqliteDriver.js';
import { getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { migrateLegacyWorkspacesForUser } from '../ui/server/saas/storage/migrateLegacyWorkspaces.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const tenantId = String(args.tenant || 'default');
const userId = Number(args.userId || 1);
const enableSync = args['enable-sync'] === true || args.enableSync === 'true';

process.env.PILOTDECK_SAAS_MODE = '1';

const driver = await createSqliteDriver();
globalThis.__saasControlDriverOverride = driver;

const { getControlDriver } = await import('../ui/server/saas/db/control.js');
await getControlDriver();

const result = await migrateLegacyWorkspacesForUser({
  userId,
  tenantId,
  tenantPilotHome: getTenantPilotHome(tenantId),
  enableSync,
});

console.log(JSON.stringify(result, null, 2));
await driver.close();
