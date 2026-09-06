#!/usr/bin/env node
/** Rename fal-fal-* skill dirs to fal-* (vendor double-prefix fix). */
import { existsSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'vendor', 'creation-ecosystem');
let renamed = 0;

if (!existsSync(PACK)) {
  console.log('[rename-fal-double-prefix] pack missing, skip');
  process.exit(0);
}

for (const name of readdirSync(PACK)) {
  if (!name.startsWith('fal-fal-')) continue;
  const target = name.replace(/^fal-fal-/, 'fal-');
  const from = path.join(PACK, name);
  const to = path.join(PACK, target);
  if (existsSync(to)) {
    console.warn(`[rename-fal-double-prefix] skip ${name} → ${target} (target exists)`);
    continue;
  }
  renameSync(from, to);
  renamed += 1;
  console.log(`[rename-fal-double-prefix] ${name} → ${target}`);
}

console.log(`[rename-fal-double-prefix] done renamed=${renamed}`);
