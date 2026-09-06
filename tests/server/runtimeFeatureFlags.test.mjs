import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import runtimeFeatureFlagsRouter from '../../ui/server/routes/runtimeFeatureFlags.js';

const FLAG_KEYS = [
  'PILOTDECK_UI_DELIVERABLE_CERTIFICATE',
  'PILOTDECK_UI_DELIVERABLE_QUALITY',
  'PILOTDECK_UI_EXPORT_SNAPSHOT_V2',
  'PILOTDECK_UI_EXPORT_USER_AUDIT_MODES',
  'PILOTDECK_UI_VISUAL_BINDING_AUDIT',
];

let baseUrl;
let server;
const previousValues = new Map();

before(async () => {
  for (const key of FLAG_KEYS) {
    previousValues.set(key, process.env[key]);
    delete process.env[key];
  }
  const app = express();
  app.use('/api/runtime/feature-flags', runtimeFeatureFlagsRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api/runtime/feature-flags`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  for (const key of FLAG_KEYS) {
    const previous = previousValues.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test('runtime export flags default off and accept explicit env enablement', async () => {
  const defaults = await fetch(baseUrl);
  assert.equal(defaults.status, 200);
  assert.equal(defaults.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await defaults.json(), {
    PILOTDECK_UI_DELIVERABLE_CERTIFICATE: false,
    PILOTDECK_UI_DELIVERABLE_QUALITY: false,
    PILOTDECK_UI_EXPORT_SNAPSHOT_V2: false,
    PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: false,
    PILOTDECK_UI_VISUAL_BINDING_AUDIT: false,
  });

  for (const key of FLAG_KEYS) process.env[key] = '1';
  const enabled = await fetch(baseUrl);
  assert.deepEqual(await enabled.json(), {
    PILOTDECK_UI_DELIVERABLE_CERTIFICATE: true,
    PILOTDECK_UI_DELIVERABLE_QUALITY: true,
    PILOTDECK_UI_EXPORT_SNAPSHOT_V2: true,
    PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: true,
    PILOTDECK_UI_VISUAL_BINDING_AUDIT: true,
  });
});

test('runtime feature flag interface remains GET-only', async () => {
  const response = await fetch(baseUrl, { method: 'POST' });
  assert.equal(response.status, 404);
});
