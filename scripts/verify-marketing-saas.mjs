#!/usr/bin/env node
/**
 * 一键验收：gen → install-smoke → hub → aigeo → deep
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args) {
  console.log(`\n[verify:marketing-saas] >>> ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[verify:marketing-saas] FAIL at ${label}`);
    process.exit(r.status || 1);
  }
}

run('capabilities:gen', ['scripts/generate-capabilities-catalog.mjs']);
run('capabilities:i18n', ['scripts/generate-capabilities-i18n.mjs']);
run('check:i18n-zh', ['scripts/check-capabilities-i18n-zh.mjs']);
run('smoke:marketing-install', ['scripts/integration-marketing-install-smoke.mjs']);
run('smoke:capabilities', ['scripts/integration-capabilities-smoke.mjs']);
run('smoke:capability-hub', ['scripts/audit-capability-taxonomy.mjs']);
spawnSync(process.execPath, ['scripts/integration-capability-hub-taxonomy-check.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});
run('smoke:aigeo', ['scripts/integration-aigeo-smoke.mjs']);
run('marketing-saas-deep', ['scripts/integration-marketing-saas-deep.mjs']);

console.log('\n[verify:marketing-saas] OK');
console.log('[verify:marketing-saas] 缺项表格: docs/marketing-install-readiness.zh-CN.md');
