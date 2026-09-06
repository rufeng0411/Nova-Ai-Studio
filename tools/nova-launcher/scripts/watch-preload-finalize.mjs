import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const preloadJs = join(import.meta.dirname, '../dist-preload/preload/index.js');

function finalize() {
  const child = spawn('node', ['scripts/finalize-preload.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', (err) => console.error('[nova-launcher] finalize-preload:', err));
}

watch(preloadJs, { persistent: true }, () => finalize());
