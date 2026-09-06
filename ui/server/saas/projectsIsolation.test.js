import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
describe('SaaS tenant project isolation', () => {
  let dataRoot;
  let previousEnv;

  beforeEach(() => {
    previousEnv = { ...process.env };
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-proj-'));
    process.env.PILOTDECK_SAAS_MODE = '1';
    process.env.DATA_ROOT = dataRoot;
  });

  afterEach(() => {
    process.env = previousEnv;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it('resolveEffectivePilotHome uses tenant ALS context', async () => {
    const { resolveEffectivePilotHome } = await import('./context.js');
    const { resolvePilotHome } = await import('../utils/pilotPaths.js');
    const { getTenantPilotHome, DEFAULT_TENANT_ID } = await import('./tenant/paths.js');
    const { saasRequestStore } = await import('./context.js');

    const legacy = resolvePilotHome(process.env);
    const tenantHome = getTenantPilotHome(DEFAULT_TENANT_ID, process.env);

    expect(resolveEffectivePilotHome(resolvePilotHome, process.env)).toBe(legacy);

    const scoped = saasRequestStore.run(
      { tenantId: DEFAULT_TENANT_ID, tenantPilotHome: tenantHome },
      () => resolveEffectivePilotHome(resolvePilotHome, process.env),
    );
    expect(scoped).toBe(tenantHome);
    expect(scoped).not.toBe(legacy);
  });
});
