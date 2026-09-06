#!/usr/bin/env node
/**
 * PD-SAAS-FORK: HyperFrames Studio acceptance orchestrator
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiRoot = path.join(root, 'ui');
const tierArg = process.argv.find((a) => a.startsWith('--tier='));
const tier = tierArg?.split('=')[1] || 'fast';
const date = new Date().toISOString().slice(0, 10);
const reportPath = path.join(root, `docs/hf-studio-acceptance-report-${date}.md`);

const unitPatterns = [
  'src/shared/hfStudioSupport.test.ts',
  'src/shared/hfStudioGate.test.ts',
  'src/shared/resolveEditAdapter.test.ts',
  'src/shared/hfStudioPathResolve.test.ts',
  'src/shared/hfStudioI18n.test.ts',
];

const serverPatterns = [
  'server/saas/storage/hfStudioWritePolicy.test.js',
  'server/saas/hyperframes/hfStudioRenderPathGuard.test.js',
];

function run(cmd, cmdArgs, cwd = uiRoot) {
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status ?? 1;
}

const results = [];

for (const pattern of unitPatterns) {
  const code = run('npx', ['vitest', 'run', pattern]);
  results.push({ name: pattern, ok: code === 0 });
}

for (const pattern of serverPatterns) {
  const code = run('npx', ['vitest', 'run', pattern]);
  results.push({ name: pattern, ok: code === 0 });
}

if (tier === 'full') {
  const license = spawnSync('npm', ['ls', '@hyperframes/player', '@hyperframes/studio', '--json'], {
    cwd: uiRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const ok = license.status === 0 && license.stdout.includes('@hyperframes/player');
  results.push({ name: 'license npm ls @hyperframes/*', ok });
}

const allOk = results.every((row) => row.ok);
const lines = [
  `# HyperFrames Studio Acceptance (${tier})`,
  '',
  `Date: ${new Date().toISOString()}`,
  '',
  '| Check | Result |',
  '|-------|--------|',
  ...results.map((row) => `| ${row.name} | ${row.ok ? 'PASS' : 'FAIL'} |`),
  '',
  allOk ? '**Overall: PASS**' : '**Overall: FAIL**',
  '',
];

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`Report: ${reportPath}`);
process.exit(allOk ? 0 : 1);
