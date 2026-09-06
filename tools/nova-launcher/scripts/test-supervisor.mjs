/**
 * Headless supervisor / repoRoot regression tests (no Electron UI).
 */
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProcessSupervisor } from '../dist-main/main/supervisor.js';
import { findRepoRoot, checkPrerequisites } from '../dist-main/main/repoRoot.js';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const launcherRoot = resolve(scriptDir, '..');
const repoRoot = resolve(launcherRoot, '../..');

process.env.NOVA_REPO_ROOT = repoRoot;

function section(name) {
  console.log(`[test-supervisor] · ${name}`);
}

section('findRepoRoot');
const found = findRepoRoot(launcherRoot);
assert.equal(found, repoRoot);

section('checkPrerequisites');
const prereq = checkPrerequisites(repoRoot);
assert.ok(prereq.nodeVersion.startsWith('v'));
if (!prereq.ok) {
  console.warn('[test-supervisor] prerequisites warn:', prereq.messages.join('; '));
}

section('init + snapshot');
const supervisor = new ProcessSupervisor(repoRoot);
await supervisor.init();
for (let i = 0; i < 100 && !supervisor.isSlowInitDone(); i += 1) {
  await new Promise((r) => setTimeout(r, 50));
}
assert.equal(supervisor.isStackRunning(), false, 'init should clear external stack');
assert.equal(supervisor.isManagedByLauncher(), false);

const snap = supervisor.buildSnapshot();
assert.equal(snap.services.length, 6);
assert.equal(snap.stackRunning, false);
assert.equal(snap.stackExternal, false);
assert.ok(Array.isArray(snap.logs));
assert.ok(snap.logs.some((l) => l.line.includes('仓库根目录')));

section('log filter');
supervisor.setLogFilter('gateway');
const filtered = supervisor.filterLogs();
assert.ok(filtered.every((l) => l.channel === 'gateway' || l.channel === 'system'));
supervisor.setLogFilter('all');

section('idle shutdown');
await supervisor.shutdownAll();
assert.equal(supervisor.isStackRunning(), false);

section('getRuntime when idle');
assert.equal(supervisor.getRuntime(), null);

console.log('[test-supervisor] OK');
