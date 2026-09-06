#!/usr/bin/env node
/**
 * Phase 1 SaaS smoke: control-plane bootstrap + optional live login probe.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPorts } from './lib/devPortSync.mjs';
import { getConnectableHost } from '../ui/shared/networkHosts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`[saas-phase1-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function runStaticChecks() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-smoke-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  process.env.PILOTDECK_DISABLE_LOCAL_AUTH = '0';

  const { isSaasMode } = await import('../ui/server/saas/mode.js');
  const { getTenantProjectsRoot, DEFAULT_TENANT_ID } = await import('../ui/server/saas/tenant/paths.js');
  const { bootstrapSaasControlPlane, SAAS_ADMIN_USERNAME } = await import('../ui/server/saas/auth/bootstrap.js');
  const { controlUserDb, getControlDbBackend, getControlDbPath, closeControlDatabase } = await import('../ui/server/saas/db/control.js');

  if (!isSaasMode()) {
    fail('isSaasMode() should be true when PILOTDECK_SAAS_MODE=1');
  }

  const projectsRoot = getTenantProjectsRoot(DEFAULT_TENANT_ID);
  if (!projectsRoot.includes('tenants')) {
    fail(`unexpected tenant projects path: ${projectsRoot}`);
  }

  await bootstrapSaasControlPlane({ log: () => {} });

  if (getControlDbBackend() === 'sqlite' && !fs.existsSync(getControlDbPath())) {
    fail('control.db was not created');
  }

  const admin = await controlUserDb.getUserByUsername(SAAS_ADMIN_USERNAME);
  if (!admin || admin.role !== 'super-admin') {
    fail('platform admin was not seeded');
  }

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.log('[saas-phase1-smoke] static bootstrap OK');
}

async function probeLogin() {
  const ports = mapPorts();
  const host = getConnectableHost(process.env.HOST || '0.0.0.0');
  const base = `http://${host}:${ports.serverPort}`;

  try {
    const statusRes = await fetch(`${base}/api/auth/status`, { signal: AbortSignal.timeout(8_000) });
    if (!statusRes.ok) {
      console.warn(`[saas-phase1-smoke] WARN: auth status ${statusRes.status} — is dev:saas running?`);
      return;
    }
    const status = await statusRes.json();
    if (!status.saasMode) {
      console.warn(
        `[saas-phase1-smoke] WARN: live probe skipped — ${base} is OSS mode (start npm run dev:saas for live login)`,
      );
      return;
    }
    if (status.authDisabled) {
      fail('SaaS auth/status must not report authDisabled');
    }

    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!loginRes.ok) {
      fail(`login failed with status ${loginRes.status}`);
    }
    const payload = await loginRes.json();
    if (!payload.token || !payload.user?.tenantId) {
      fail('login response missing token or tenantId');
    }
    console.log(`[saas-phase1-smoke] live login OK (${base})`);
  } catch (error) {
    console.warn(
      `[saas-phase1-smoke] WARN: live probe skipped (${error instanceof Error ? error.message : error}) — start npm run dev:saas first`,
    );
  }
}

await runStaticChecks();
if (process.env.PILOTDECK_SAAS_SMOKE_SKIP_PROBE !== '1') {
  await probeLogin();
}
console.log('[saas-phase1-smoke] OK');
