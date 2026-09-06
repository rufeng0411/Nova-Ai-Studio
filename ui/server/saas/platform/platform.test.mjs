import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPilotDeckConfigPath } from '../../services/pilotdeckConfig.js';
import { getLegacyPilotHome } from '../legacyBridge.js';
import { billingDb } from '../billing/store.js';

describe('platform summary data', () => {
  let dataRoot;
  let previousEnv;

  beforeEach(async () => {
    previousEnv = { ...process.env };
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-platform-'));
    process.env.PILOTDECK_SAAS_MODE = '1';
    process.env.DATA_ROOT = dataRoot;
    const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
    await bootstrapSaasControlPlane({ log: () => {} });
  });

  afterEach(async () => {
    const { closeControlDatabase } = await import('../db/control.js');
    await closeControlDatabase();
    process.env = previousEnv;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it('exposes legacy home, config path and seeded plans', async () => {
    const plans = await billingDb.listPlans();
    assert.ok(getLegacyPilotHome());
    assert.ok(getPilotDeckConfigPath());
    assert.ok(plans.length >= 3);
  });
});
