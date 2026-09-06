#!/usr/bin/env node
/**
 * Phase 0: verify SaaS design sketch HTML artifacts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'docs', 'saas-design-artifacts.manifest.json');

const fallbackRequired = [
  'artifacts/saas-design/README.md',
  'artifacts/saas-design/v1-native-slate/login.html',
  'artifacts/saas-design/v1-native-slate/admin-users.html',
  'artifacts/saas-design/v2-linear-product/login.html',
  'artifacts/saas-design/v2-linear-product/admin-users.html',
  'artifacts/saas-design/v3-cloud-admin/login.html',
  'artifacts/saas-design/v3-cloud-admin/admin-users.html',
  'artifacts/saas-design/chosen/tokens.css',
  'artifacts/saas-design/chosen/login.html',
  'artifacts/saas-design/chosen/admin-users.html',
];

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readText(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function assertHtml(rel, rules) {
  const text = readText(rel);
  for (const fragment of rules.mustInclude ?? []) {
    if (!text.includes(fragment)) {
      throw new Error(`${rel}: missing required fragment "${fragment}"`);
    }
  }
  for (const fragment of rules.mustNotInclude ?? []) {
    if (text.includes(fragment)) {
      throw new Error(`${rel}: forbidden fragment "${fragment}"`);
    }
  }
}

if (!fs.existsSync(manifestPath)) {
  console.error('[saas-design] FAIL manifest missing:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const required = manifest.required ?? fallbackRequired;
const missing = required.filter((rel) => !fs.existsSync(path.join(repoRoot, rel)));

if (missing.length) {
  console.error('[saas-design] FAIL missing artifacts:');
  for (const rel of missing) {
    console.error(`  - ${rel}`);
  }
  process.exit(1);
}

const brand = manifest.contentChecks?.brandMustInclude ?? 'Nova Ai-Studio';
const forbidden = manifest.contentChecks?.brandMustNotInclude ?? 'PilotDeck';

const htmlFiles = required.filter((rel) => rel.endsWith('.html'));
for (const rel of htmlFiles) {
  assertHtml(rel, { mustInclude: [brand], mustNotInclude: [forbidden] });
}

for (const rel of htmlFiles.filter((f) => f.includes('/login.html'))) {
  assertHtml(rel, { mustInclude: ['登录', '注册'] });
}

for (const rel of htmlFiles.filter((f) => f.includes('/admin-users.html'))) {
  assertHtml(rel, { mustInclude: ['用户'] });
}

const chosenPairs = [
  ['artifacts/saas-design/v1-native-slate/login.html', 'artifacts/saas-design/chosen/login.html'],
  ['artifacts/saas-design/v1-native-slate/admin-users.html', 'artifacts/saas-design/chosen/admin-users.html'],
];

for (const [src, dest] of chosenPairs) {
  const a = sha256(path.join(repoRoot, src));
  const b = sha256(path.join(repoRoot, dest));
  if (a !== b) {
    console.error(`[saas-design] FAIL chosen copy mismatch: ${dest} should match ${src}`);
    process.exit(1);
  }
}

if (!readText('artifacts/saas-design/README.md').includes('CHOSEN')) {
  console.error('[saas-design] FAIL README must mark chosen version');
  process.exit(1);
}

if ((manifest.chosen ?? 'v1-native-slate') !== 'v1-native-slate') {
  console.error('[saas-design] FAIL manifest chosen must be v1-native-slate');
  process.exit(1);
}

console.log(`[saas-design] OK ${required.length} artifacts present (chosen: ${manifest.chosen})`);
