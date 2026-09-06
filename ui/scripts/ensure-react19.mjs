#!/usr/bin/env node
/**
 * Prevent nested React 18 under ui/node_modules (breaks vitest with duplicate React).
 * Hoisted React 19 from the workspace root is the single source of truth.
 */
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = dirname(fileURLToPath(new URL('..', import.meta.url)));

for (const pkg of ['react', 'react-dom']) {
  const pkgJson = join(uiRoot, 'node_modules', pkg, 'package.json');
  if (!existsSync(pkgJson)) continue;
  try {
    const version = JSON.parse(readFileSync(pkgJson, 'utf8')).version || '';
    const major = Number.parseInt(version.split('.')[0], 10);
    if (major < 19) {
      rmSync(join(uiRoot, 'node_modules', pkg), { recursive: true, force: true });
      console.log(`[ensure-react19] removed ui/node_modules/${pkg}@${version}`);
    }
  } catch {
    // ignore
  }
}
