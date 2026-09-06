/**
 * PD-SAAS-FORK: Idempotent SaaS control DB seed (platform admin).
 * N2-COMMUNITY-OVERLAY: password comes from SAAS_ADMIN_PASSWORD; refuse the historic default.
 */
import bcrypt from 'bcrypt';
import { userDb } from '../../database/db.js';
import { controlTenantDb, controlUserDb, openControlDatabase } from '../db/control.js';
import { bootstrapTenantLayout } from '../legacyBridge.js';
import { DEFAULT_TENANT_ID } from '../tenant/paths.js';
import { seedDefaultPlans } from '../billing/store.js';

export const SAAS_ADMIN_USERNAME = 'admin';
export const SAAS_ADMIN_ROLE = 'super-admin';

export function readSaasAdminPassword(env = process.env) {
  const password = String(env.SAAS_ADMIN_PASSWORD || '').trim();
  if (!password) {
    throw new Error('[saas] SAAS_ADMIN_PASSWORD is required. Copy .env.example to .env and set it.');
  }
  if (password === `admin${123}`) {
    throw new Error('[saas] SAAS_ADMIN_PASSWORD must not use the historic default');
  }
  return password;
}

/**
 * @param {{ log?: (line: string) => void }} [options]
 */
export async function bootstrapSaasControlPlane(options = {}) {
  const log = options.log ?? ((line) => console.log(line));
  const adminPassword = readSaasAdminPassword();

  await openControlDatabase();
  await controlTenantDb.ensureTenant(DEFAULT_TENANT_ID, 'Default Tenant');
  bootstrapTenantLayout(DEFAULT_TENANT_ID);
  await seedDefaultPlans();

  let admin = await controlUserDb.getUserByUsername(SAAS_ADMIN_USERNAME);
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    admin = await controlUserDb.createUser({
      tenantId: DEFAULT_TENANT_ID,
      username: SAAS_ADMIN_USERNAME,
      passwordHash,
      role: SAAS_ADMIN_ROLE,
    });
    log(`[saas] seeded platform admin "${SAAS_ADMIN_USERNAME}" (tenant=${DEFAULT_TENANT_ID})`);
  }

  // Legacy Bridge: mirror admin into auth.db so existing user-scoped routes keep working.
  try {
    if (!userDb.hasUsers()) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      userDb.createUser(SAAS_ADMIN_USERNAME, passwordHash);
      log('[saas] mirrored admin into legacy auth.db');
    }
  } catch (error) {
    log(
      `[saas] legacy auth.db mirror skipped (${error instanceof Error ? error.message : error})`,
    );
  }

  return admin;
}
