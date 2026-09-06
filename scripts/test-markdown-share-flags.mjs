#!/usr/bin/env node
// PD-SAAS-FORK: assert PILOTDECK_PUBLIC_MD_SHARE wired in pack / apply / devLauncher
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { getPublicMdShareMode } from '../ui/server/saas/share/publicMdShareFlag.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function mustInclude(rel, needle) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, 'utf8');
  assert.ok(text.includes(needle), `${rel} missing ${needle}`);
}

mustInclude('scripts/lib/devLauncherCore.mjs', 'PILOTDECK_PUBLIC_MD_SHARE');
mustInclude('scripts/release/pack.mjs', 'PILOTDECK_PUBLIC_MD_SHARE');
mustInclude('scripts/release/apply-cloud-perf-env.sh', 'PILOTDECK_PUBLIC_MD_SHARE=shadow');
mustInclude('scripts/release/verify-cloud-perf.sh', 'PILOTDECK_PUBLIC_MD_SHARE');
mustInclude('deploy/nginx-nova-locations.conf', 'location ^~ /s/');
mustInclude('ui/vite.config.js', "'/s/'");

assert.equal(getPublicMdShareMode({}), 'off');
assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'shadow' }), 'shadow');
assert.equal(getPublicMdShareMode({ PILOTDECK_PUBLIC_MD_SHARE: 'enforce' }), 'enforce');

console.log('test-markdown-share-flags: OK');
