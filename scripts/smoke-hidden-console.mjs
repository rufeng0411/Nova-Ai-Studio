#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Smoke — patched spawn hides shell/npm on Windows.
 */
import { spawn, spawnSync } from './lib/childProcessShim.mjs';

if (process.platform !== 'win32') {
  console.log('[smoke-hidden-console] skip (not win32)');
  process.exit(0);
}

let ok = true;

function check(name, fn) {
  try {
    fn();
    console.log(`[smoke-hidden-console] PASS ${name}`);
  } catch (err) {
    ok = false;
    console.error(`[smoke-hidden-console] FAIL ${name}:`, err instanceof Error ? err.message : err);
  }
}

check('shell:true echo', () => {
  const r = spawnSync('echo', ['nova-hidden-test'], { shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`status ${r.status}`);
});

check('npm.cmd -v via node', () => {
  const r = spawnSync('npm.cmd', ['-v'], { encoding: 'utf8', shell: false });
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout));
});

check('async spawn cmd host', () => {
  const child = spawn('echo', ['async-ok'], { shell: true, stdio: 'ignore' });
  child.on('error', (e) => {
    throw e;
  });
});

if (!ok) process.exit(1);
console.log('[smoke-hidden-console] ALL PASSED');
