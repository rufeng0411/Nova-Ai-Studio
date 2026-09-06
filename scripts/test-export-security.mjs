#!/usr/bin/env node
/**
 * PD-SAAS-FORK: export security smoke — exercise real turn-queue idempotency helpers.
 * Export/XSS, GET-only runtime flags, and path traversal run as real test suites
 * from the package script instead of duplicating their production logic here.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  isDuplicateQueuedGoal,
  isQueueStatusInquiry,
} from '../ui/server/saas/concurrency/turnQueueIdempotency.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const exportFlagKeys = [
  'PILOTDECK_EXPORT_SNAPSHOT_V2',
  'PILOTDECK_UI_DELIVERABLE_CERTIFICATE',
  'PILOTDECK_UI_EXPORT_SNAPSHOT_V2',
  'PILOTDECK_UI_EXPORT_USER_AUDIT_MODES',
];

function inspectReleaseFlags(overrides = {}) {
  const env = { ...process.env };
  for (const key of exportFlagKeys) delete env[key];
  const assignments = Object.entries(overrides)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const command = [
    `unset ${exportFlagKeys.join(' ')}`,
    `${assignments} bash scripts/release/apply-cloud-perf-env.sh --print-export-flags`.trim(),
  ].join('; ');
  return spawnSync(
    'bash',
    ['-c', command],
    {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
}

assert.equal(isQueueStatusInquiry('？'), true);
assert.equal(isDuplicateQueuedGoal('  hello  ', 'hello'), true);
assert.equal(isDuplicateQueuedGoal('new task', 'hello'), false);

const defaults = inspectReleaseFlags();
assert.equal(defaults.status, 0, defaults.stderr);
for (const key of exportFlagKeys) {
  assert.match(defaults.stdout, new RegExp(`^${key}=0$`, 'm'));
}

const enabled = inspectReleaseFlags(Object.fromEntries(exportFlagKeys.map((key) => [key, '1'])));
assert.equal(enabled.status, 0, enabled.stderr);
for (const key of exportFlagKeys) {
  assert.match(enabled.stdout, new RegExp(`^${key}=1$`, 'm'));
}

const invalid = inspectReleaseFlags({ PILOTDECK_UI_EXPORT_SNAPSHOT_V2: 'invalid' });
assert.notEqual(invalid.status, 0);

console.log('[export-security] PASS');
