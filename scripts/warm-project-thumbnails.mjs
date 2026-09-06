#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 低优先级预热项目图片缩略图磁盘缓存（与线上一致：DATA_ROOT/.cache/thumbnails）。
 *
 * 用法:
 *   node scripts/warm-project-thumbnails.mjs
 *   node scripts/warm-project-thumbnails.mjs --dry-run --limit 50
 *   node scripts/warm-project-thumbnails.mjs --tenant default --min-kb 50 --concurrency 3
 *   node scripts/warm-project-thumbnails.mjs --max-age-days 7
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProjectThumbnail,
  isSupportedThumbnailSource,
} from '../ui/server/utils/projectThumbnail.js';
import { getDataRoot } from '../ui/server/saas/tenant/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'build',
  '.nova-cache',
  '.cache',
  '.tmp',
]);

const DEFAULTS = {
  tenant: 'all',
  limit: 500,
  concurrency: 3,
  minKb: 50,
  maxAgeDays: 0,
  maxThumb: 320,
  quality: 75,
  dryRun: false,
};

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--tenant') opts.tenant = argv[++i] ?? 'all';
    else if (arg === '--limit') opts.limit = Number.parseInt(argv[++i] ?? '', 10) || DEFAULTS.limit;
    else if (arg === '--concurrency') opts.concurrency = Number.parseInt(argv[++i] ?? '', 10) || DEFAULTS.concurrency;
    else if (arg === '--min-kb') opts.minKb = Number.parseInt(argv[++i] ?? '', 10) || DEFAULTS.minKb;
    else if (arg === '--max-age-days') opts.maxAgeDays = Number.parseInt(argv[++i] ?? '', 10) || 0;
    else if (arg === '--max') opts.maxThumb = Number.parseInt(argv[++i] ?? '', 10) || DEFAULTS.maxThumb;
    else if (arg === '--q') opts.quality = Number.parseInt(argv[++i] ?? '', 10) || DEFAULTS.quality;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/warm-project-thumbnails.mjs [options]

Options:
  --tenant <id|all>     Tenant id under DATA_ROOT/tenants (default: all)
  --limit <n>           Max images to warm (default: 500)
  --concurrency <n>     Parallel sharp jobs (default: 3)
  --min-kb <n>          Skip files smaller than n KB (default: 50)
  --max-age-days <n>    Only files modified within n days (0 = all)
  --max <px>            Thumbnail max edge (default: 320)
  --q <1-95>            WebP quality (default: 75)
  --dry-run             Scan only, do not generate
`);
      process.exit(0);
    }
  }
  return opts;
}

async function listTenantIds(dataRoot, tenantFilter) {
  const tenantsDir = path.join(dataRoot, 'tenants');
  let names;
  try {
    names = await readdir(tenantsDir);
  } catch {
    return [];
  }
  const ids = names.filter((name) => name && !name.startsWith('.'));
  if (tenantFilter === 'all') return ids;
  return ids.filter((id) => id === tenantFilter);
}

async function walkImages(rootDir, opts, bucket, depth = 0) {
  if (bucket.length >= opts.limit || depth > 12) return;
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (bucket.length >= opts.limit) break;
    const abs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      await walkImages(abs, opts, bucket, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isSupportedThumbnailSource(abs)) continue;

    let fileStat;
    try {
      fileStat = await stat(abs);
    } catch {
      continue;
    }
    if (!fileStat.isFile()) continue;
    if (fileStat.size < opts.minKb * 1024) continue;
    if (opts.maxAgeDays > 0) {
      const ageMs = Date.now() - fileStat.mtimeMs;
      if (ageMs > opts.maxAgeDays * 86_400_000) continue;
    }

    bucket.push({ path: abs, size: fileStat.size, mtimeMs: fileStat.mtimeMs });
  }
}

async function collectCandidateImages(dataRoot, opts) {
  const tenantIds = await listTenantIds(dataRoot, opts.tenant);
  const images = [];

  for (const tenantId of tenantIds) {
    const cloudUsersRoot = path.join(dataRoot, 'tenants', tenantId, 'cloud-storage', 'users');
    let userIds;
    try {
      userIds = await readdir(cloudUsersRoot);
    } catch {
      continue;
    }
    for (const userId of userIds) {
      const workspacesRoot = path.join(cloudUsersRoot, userId, 'workspaces');
      let workspaceIds;
      try {
        workspaceIds = await readdir(workspacesRoot);
      } catch {
        continue;
      }
      for (const workspaceId of workspaceIds) {
        await walkImages(path.join(workspacesRoot, workspaceId), opts, images);
        if (images.length >= opts.limit) break;
      }
      if (images.length >= opts.limit) break;
    }
    if (images.length >= opts.limit) break;
  }

  images.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return images.slice(0, opts.limit);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dataRoot = getDataRoot();
  const cacheRoot = path.join(dataRoot, '.cache', 'thumbnails');

  console.log('[thumbnails:warm] DATA_ROOT:', dataRoot);
  console.log('[thumbnails:warm] cache:', cacheRoot);
  console.log('[thumbnails:warm] options:', opts);

  const candidates = await collectCandidateImages(dataRoot, opts);
  console.log(`[thumbnails:warm] candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('[thumbnails:warm] nothing to warm');
    return;
  }

  if (opts.dryRun) {
    for (const item of candidates.slice(0, 10)) {
      console.log(`  dry-run ${item.path} (${Math.round(item.size / 1024)} KB)`);
    }
    if (candidates.length > 10) {
      console.log(`  ... and ${candidates.length - 10} more`);
    }
    return;
  }

  const startedAt = Date.now();
  let generated = 0;
  let cached = 0;
  let failed = 0;

  await mapWithConcurrency(candidates, opts.concurrency, async (item) => {
    try {
      const result = await createProjectThumbnail({
        sourcePath: item.path,
        cacheRoot,
        options: { max: opts.maxThumb, q: opts.quality, format: 'webp' },
      });
      if (result.fromCache) cached += 1;
      else generated += 1;
    } catch (error) {
      failed += 1;
      console.warn('[thumbnails:warm] skip', item.path, error?.message || error);
    }
  });

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('[thumbnails:warm] done', {
    total: candidates.length,
    generated,
    cached,
    failed,
    elapsedSec,
  });

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[thumbnails:warm] fatal:', error);
  process.exit(1);
});
