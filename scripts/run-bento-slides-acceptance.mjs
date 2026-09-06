#!/usr/bin/env node
/** PD-SAAS-FORK: bento slides acceptance — splice fixtures + validate + route unit hints */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = path.join(ROOT, 'ui/public/vendor/bento/Bento_Slides.bento.html');
const OUT_ROOT = path.join(ROOT, 'artifacts/bento-acceptance');
const REPORT = path.join(OUT_ROOT, 'report.json');

const CASES = [
  { id: 'pitch-launch', doc: 'skills/nova-bento-slides/templates/full-decks/pitch-launch.json' },
  { id: 'tech-sharing', doc: 'skills/nova-bento-slides/templates/full-decks/tech-sharing.json' },
  { id: 'data-report', doc: 'skills/nova-bento-slides/templates/full-decks/data-report.json' },
];

function runNode(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

async function main() {
  const fast = process.argv.includes('--fast');
  await mkdir(OUT_ROOT, { recursive: true });
  const caseResults = [];

  for (const c of CASES) {
    const dir = path.join(OUT_ROOT, c.id);
    await mkdir(dir, { recursive: true });
    const out = path.join(dir, 'deck.bento.html');
    const splice = runNode('skills/nova-bento-slides/scripts/splice-bento-shell.mjs', [
      '--shell', SHELL, '--doc', path.join(ROOT, c.doc), '--out', out,
    ]);
    const validate = runNode('skills/nova-bento-slides/scripts/validate-bento-doc.mjs', ['--strict', out]);
    caseResults.push({
      id: c.id,
      spliceOk: splice.status === 0,
      validateOk: validate.status === 0,
      ok: splice.status === 0 && validate.status === 0,
    });
  }

  let routeOk = true;
  if (!fast) {
    const vitest = spawnSync('npx', ['vitest', 'run', 'ui/src/shared/resolveExportScope.test.ts', 'ui/src/shared/resolveEditAdapter.test.ts'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    routeOk = vitest.status === 0;
  }

  const report = {
    ts: new Date().toISOString(),
    pass: caseResults.every((c) => c.ok) && routeOk,
    cases: caseResults,
    routeUnitOk: routeOk,
  };
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
