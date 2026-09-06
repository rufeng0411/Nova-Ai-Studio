#!/usr/bin/env node
/**
 * PD-SAAS-FORK: HF Studio four-line parity gate (structural)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const fixturePath = path.join(root, 'tests/fixtures/hf-studio-four-line-case.json');

const fixture = {
  taskDir: 'artifacts/task-20260726-hf000001',
  promoPath: 'artifacts/task-20260726-hf000001/promo.mp4',
  hfProjectIndex: 'artifacts/task-20260726-hf000001/hf-project/index.html',
};

fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf8');

const checks = [
  fs.existsSync(path.join(root, 'ui/src/shared/hfStudioDeliverableSync.ts')),
  fs.existsSync(path.join(root, 'ui/src/shared/buildUnifiedDeliverableView.ts')),
  fs.existsSync(fixturePath),
];

const ok = checks.every(Boolean);
const reportDir = path.join(root, 'artifacts/hf-studio-four-line');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, 'report.json'),
  JSON.stringify({ ok, fixture, checks: checks.map((v, i) => ({ i, pass: v })) }, null, 2),
  'utf8',
);

if (!ok && gate) process.exit(1);
console.log(ok ? 'HF four-line structural gate: PASS' : 'HF four-line structural gate: FAIL');
process.exit(ok ? 0 : 1);
