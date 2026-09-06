#!/usr/bin/env node
/** PD-SAAS-FORK: smoke nova-bento splice + validate */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = path.join(ROOT, 'ui/public/vendor/bento/Bento_Slides.bento.html');
const OUT_DIR = path.join(ROOT, 'artifacts/bento-smoke');

const CASES = [
  ['pitch-launch', 'skills/nova-bento-slides/templates/full-decks/pitch-launch.json'],
  ['tech-sharing', 'skills/nova-bento-slides/templates/full-decks/tech-sharing.json'],
  ['data-report', 'skills/nova-bento-slides/templates/full-decks/data-report.json'],
];

function runNode(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stdout || res.stderr);
    throw new Error(`Failed: node ${script} ${args.join(' ')}`);
  }
  return res.stdout;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];
  for (const [id, docRel] of CASES) {
    const out = path.join(OUT_DIR, `${id}.bento.html`);
    runNode('skills/nova-bento-slides/scripts/splice-bento-shell.mjs', [
      '--shell', SHELL,
      '--doc', path.join(ROOT, docRel),
      '--out', out,
    ]);
    runNode('skills/nova-bento-slides/scripts/validate-bento-doc.mjs', ['--strict', out]);
    results.push({ id, out, ok: true });
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
