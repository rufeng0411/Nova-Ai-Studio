#!/usr/bin/env node
/**
 * Record upstream AIGEOTOOLS pin. Headless logic lives in scripts/aigeo-cli.py.
 * Optional: clone into vendor/aigeotools/src for future module imports.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(REPO_ROOT, 'config', 'aigeo-sync.manifest.json');

const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : {
      upstream: 'https://github.com/chnjames/AIGEOTOOLS',
      license: 'MIT',
      pinnedRef: 'main',
    };

manifest.syncedAt = new Date().toISOString();
manifest.note =
  'PilotDeck uses scripts/aigeo-cli.py (headless). Streamlit UI not integrated.';

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[sync-aigeotools] OK manifest → ${MANIFEST}`);
