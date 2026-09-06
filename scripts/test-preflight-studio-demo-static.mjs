#!/usr/bin/env node
/** PD-SAAS-FORK: static demo pages still exist */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'artifacts/saas-design/preflight-studio');
const pages = [
  'index.html',
  'open-design/v3-split-workbench.html',
  'ppt-master/v2-three-stage.html',
  'multi-slot/index.html',
];
let ok = true;
for (const p of pages) {
  const abs = path.join(DEMO, p);
  if (!existsSync(abs)) {
    console.error(`[preflight:demo-static] missing ${p}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log(`[preflight:demo-static] OK (${pages.length} pages)`);
