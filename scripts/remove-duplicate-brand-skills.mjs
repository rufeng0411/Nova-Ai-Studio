#!/usr/bin/env node
/**
 * Remove mkt-brand-skills-* mirror directories (exact duplicates of mkt-brand-*).
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'skills', 'vendor', 'marketing-ecosystem');

let removed = 0;
if (!existsSync(PACK)) {
  console.log('[remove-duplicate-brand-skills] pack missing, skip');
  process.exit(0);
}

for (const name of readdirSync(PACK)) {
  if (!name.startsWith('mkt-brand-skills-')) continue;
  const dir = path.join(PACK, name);
  rmSync(dir, { recursive: true, force: true });
  removed += 1;
  console.log(`[remove-duplicate-brand-skills] deleted ${name}`);
}

console.log(`[remove-duplicate-brand-skills] done removed=${removed}`);
