#!/usr/bin/env node
/**
 * Verify the "Nova Ai-Studio" rebrand is intact across user-visible brand
 * surfaces. Run this after EVERY upstream/core merge:
 *
 *   npm run brand:check
 *
 * It checks three things from config/nova-brand.manifest.json:
 *   1. assets      — every brand image exists and is non-empty.
 *   2. textGuards  — exact visible strings are present (expect) / gone (forbid).
 *   3. i18n values — no brand token leaked back into locale string VALUES
 *                    (JSON keys and allow-listed paths are ignored).
 *
 * On failure it prints exactly what to fix, then exits non-zero. To repair:
 *   - assets:     node scripts/generate-nova-brand-assets.mjs
 *   - capabilities: node scripts/generate-capabilities-catalog.mjs && node scripts/generate-capabilities-i18n.mjs
 *   - textGuards: re-apply the listed string in the listed file (NEVER accept
 *                 the upstream PilotDeck branding for these surfaces).
 *
 * REDLINE — never changed by the rebrand and never flagged here:
 *   provider slug `pilotdeck`, config path `~/.pilotdeck`, CLI command name,
 *   code identifiers (PilotDeckConfig, getPilotDeck*, PilotDeckWorkStatus…),
 *   backend usage-limit regex, and JSON keys.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'config', 'nova-brand.manifest.json');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const failures = [];

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

// 1. assets exist & non-empty
for (const asset of manifest.assets || []) {
  const abs = path.join(ROOT, asset);
  try {
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0) {
      failures.push(`[asset] empty or not a file: ${asset}`);
    }
  } catch {
    failures.push(`[asset] missing: ${asset} — run \`${manifest.brand.regenerateAssets}\``);
  }
}

// 2. text guards
for (const guard of manifest.textGuards || []) {
  const abs = path.join(ROOT, guard.path);
  let content;
  try {
    content = readFileSync(abs, 'utf8');
  } catch {
    failures.push(`[guard] missing file: ${guard.path}`);
    continue;
  }
  for (const needle of guard.expect || []) {
    if (!content.includes(needle)) {
      failures.push(`[guard] ${guard.path} — MISSING expected: ${JSON.stringify(needle)}`);
    }
  }
  for (const needle of guard.forbid || []) {
    if (content.includes(needle)) {
      failures.push(`[guard] ${guard.path} — FOUND forbidden (upstream leaked back): ${JSON.stringify(needle)}`);
    }
  }
}

// 3. i18n locale string VALUES must not contain the brand token
const localesDir = path.join(ROOT, manifest.i18nLocalesGlob || 'ui/src/i18n/locales');
const forbidTokens = manifest.i18nForbidInValues || [];
const allow = manifest.i18nValueAllow || [];

function walkJsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJsonFiles(full));
    else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function flaggedValue(value) {
  for (const token of forbidTokens) {
    let idx = value.indexOf(token);
    while (idx !== -1) {
      // Skip occurrences that are part of an allow-listed substring (e.g. ~/.pilotdeck).
      const allowed = allow.some((a) => {
        const start = value.lastIndexOf(a, idx);
        return start !== -1 && start <= idx && start + a.length >= idx + token.length;
      });
      if (!allowed) return token;
      idx = value.indexOf(token, idx + 1);
    }
  }
  return null;
}

function walkValues(node, jsonPath, file) {
  if (typeof node === 'string') {
    const hit = flaggedValue(node);
    if (hit) {
      failures.push(`[i18n] ${rel(file)} ${jsonPath} — value contains "${hit}": ${JSON.stringify(node.slice(0, 80))}`);
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => walkValues(v, `${jsonPath}[${i}]`, file));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walkValues(v, `${jsonPath}.${k}`, file);
  }
}

for (const file of walkJsonFiles(localesDir)) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    failures.push(`[i18n] ${rel(file)} — invalid JSON: ${err.message}`);
    continue;
  }
  walkValues(data, '$', file);
}

// report
if (failures.length === 0) {
  const guards = (manifest.textGuards || []).length;
  const assets = (manifest.assets || []).length;
  console.log(`[brand:check] OK — brand "${manifest.brand.name}" intact (${assets} assets, ${guards} text guards, i18n values clean).`);
  process.exit(0);
}

console.error(`[brand:check] FAILED — ${failures.length} brand issue(s) found:\n`);
for (const f of failures) console.error('  - ' + f);
console.error(`\nThe brand must stay "${manifest.brand.name}". Repair guidance is in config/nova-brand.manifest.json and docs/nova-brand-guard.md.`);
process.exit(1);
