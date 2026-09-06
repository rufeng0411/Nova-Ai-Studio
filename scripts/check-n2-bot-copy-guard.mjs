#!/usr/bin/env node
/**
 * PD-SAAS-FORK: N2 Bot copy guard — user-facing HUD/i18n must not say Jarvis / Steward / PilotDeck / 交付物.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [
  join(root, 'ui/src/i18n'),
  join(root, 'ui/src/saas/n2-bot'),
];
const forbidden = [
  { re: /贾维斯/, id: '贾维斯' },
  { re: /\bJarvis\b/i, id: 'Jarvis' },
  { re: /\bSteward\b/, id: 'Steward' },
  { re: /\bPilotDeck\b/, id: 'PilotDeck' },
  { re: /交付物/, id: '交付物' },
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else if (/\.(ts|tsx|js|json|css)$/.test(extname(name))) acc.push(abs);
  }
  return acc;
}

let failed = false;
const files = dirs.flatMap((d) => walk(d));
const combined = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const text = stripComments(raw);
  combined.push(text);
  for (const rule of forbidden) {
    if (rule.re.test(text)) {
      console.error(`[n2-bot-copy] ${rule.id} in ${file}`);
      failed = true;
    }
  }
}

const blob = combined.join('\n');
for (const must of ['N2 Bot', 'β', 'Nova']) {
  if (!blob.includes(must)) {
    console.error(`[n2-bot-copy] missing required token: ${must}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`[n2-bot-copy] OK — scanned ${files.length} files`);
