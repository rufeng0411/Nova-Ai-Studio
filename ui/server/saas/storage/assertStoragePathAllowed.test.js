// PD-SAAS-FORK: SaaS storage boundary checks (Windows drive-letter casing)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('assertStoragePathAllowed', () => {
  let dataRoot;
  let previousEnv;

  beforeEach(() => {
    previousEnv = { ...process.env };
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-storage-guard-'));
    process.env.PILOTDECK_SAAS_MODE = '1';
    process.env.DATA_ROOT = dataRoot;
  });

  afterEach(() => {
    process.env = previousEnv;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it('allows cloud hub files when drive letter casing differs (Windows)', async () => {
    const { assertStoragePathAllowed } = await import('./fileStorageService.js');
    const { saasRequestStore } = await import('../context.js');
    const { getTenantPilotHome } = await import('../tenant/paths.js');
    const { getCanonicalHubRoot } = await import('./paths.js');

    const tenantId = 'default';
    const userId = 1;
    const tenantHome = getTenantPilotHome(tenantId, process.env);
    const hub = getCanonicalHubRoot(tenantId, userId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    fs.mkdirSync(path.join(hub, 'artifacts', 'images'), { recursive: true });
    const filePath = path.join(hub, 'artifacts', 'images', 'sample.jpg');
    fs.writeFileSync(filePath, 'jpeg-bytes');

    const mismatchedCasePath =
      process.platform === 'win32' && /^[a-z]:/i.test(filePath)
        ? `${filePath[0] === filePath[0].toLowerCase() ? filePath[0].toUpperCase() : filePath[0].toLowerCase()}${filePath.slice(1)}`
        : filePath;

    await saasRequestStore.run({ tenantId, tenantPilotHome: tenantHome, userId }, async () => {
      await expect(assertStoragePathAllowed(mismatchedCasePath)).resolves.toBe(
        path.resolve(mismatchedCasePath),
      );
    });
  });
});
