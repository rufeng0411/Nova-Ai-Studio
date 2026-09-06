#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { spawnSync } = require('node:child_process');

const dir = mkdtempSync(join(tmpdir(), 'mineru-cache-'));
const file = join(dir, 'slide.png');
writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

const script = `
import sys
sys.path.insert(0, ${JSON.stringify(join(process.cwd(), 'scripts', 'lib').replace(/\\/g, '/'))})
from mineru_cache import cache_key_for_files
k1 = cache_key_for_files([${JSON.stringify(file)}])
k2 = cache_key_for_files([${JSON.stringify(file)}], extra='layout-v1')
assert k1 != k2, 'extra should change cache key'
print('ok')
`;
const result = spawnSync('python', ['-c', script], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}
console.log('[mineru_cache.test] OK');
