import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const preloadDir = join(import.meta.dirname, '../dist-preload/preload');
const from = join(preloadDir, 'index.js');
const to = join(preloadDir, 'index.cjs');

if (existsSync(to)) unlinkSync(to);
if (!existsSync(from)) {
  console.error('[nova-launcher] preload build missing:', from);
  process.exit(1);
}
renameSync(from, to);

// 清理旧方案残留，避免混淆
const legacyPkg = join(import.meta.dirname, '../dist-preload/package.json');
if (existsSync(legacyPkg)) unlinkSync(legacyPkg);
