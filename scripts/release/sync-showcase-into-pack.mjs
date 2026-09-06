#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Merge local marketing-showcase overlay into deploy/marketing/showcase
 * before slim upgrade packs, so Docker image has demo case media (thumbs, fullcases, etc.).
 *
 * Default overlay: DATA_ROOT/marketing-showcase or .saas-dev-data/marketing-showcase
 * Does not touch tenants / conversation JSONL — showcase only.
 *
 * Usage:
 *   node scripts/release/sync-showcase-into-pack.mjs
 *   node scripts/release/sync-showcase-into-pack.mjs --dry-run
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const DEPLOY_SHOWCASE = join(REPO_ROOT, 'deploy', 'marketing', 'showcase');

function loadEnvLocalSync() {
  const p = join(REPO_ROOT, 'deploy', 'env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function walkFiles(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(abs, base, acc);
    else if (ent.isFile()) acc.push(abs);
  }
  return acc;
}

function resolveOverlayRoot() {
  const env = loadEnvLocalSync();
  const fromEnv = (env.DATA_ROOT || process.env.DATA_ROOT || '').trim();
  const candidates = [
    fromEnv ? join(fromEnv, 'marketing-showcase') : '',
    join(REPO_ROOT, '.saas-dev-data', 'marketing-showcase'),
    join(homedir(), '.pilotdeck', 'marketing-showcase'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return join(REPO_ROOT, '.saas-dev-data', 'marketing-showcase');
}

/** @returns {{ copied: number, skipped: number, overlayRoot: string, deployRoot: string }} */
export function syncShowcaseIntoPack(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const overlayRoot = opts.overlayRoot || resolveOverlayRoot();
  const deployRoot = opts.deployRoot || DEPLOY_SHOWCASE;

  if (!existsSync(overlayRoot)) {
    console.warn(`[sync-showcase] overlay 不存在，跳过: ${overlayRoot}`);
    return { copied: 0, skipped: 0, overlayRoot, deployRoot };
  }
  if (!existsSync(deployRoot)) {
    mkdirSync(deployRoot, { recursive: true });
  }

  let copied = 0;
  let skipped = 0;
  for (const src of walkFiles(overlayRoot)) {
    const rel = relative(overlayRoot, src).split('\\').join('/');
    if (rel.startsWith('.') || rel.includes('/.') || rel.endsWith('.tmp')) {
      skipped += 1;
      continue;
    }
    const dest = join(deployRoot, rel);
    const srcStat = statSync(src);
    let need = true;
    if (existsSync(dest)) {
      const destStat = statSync(dest);
      if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
        need = false;
      }
    }
    if (!need) {
      skipped += 1;
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    copied += 1;
  }
  console.log(
    `[sync-showcase] ${dryRun ? 'dry-run ' : ''}overlay→deploy: copied=${copied} skipped=${skipped}\n` +
      `  overlay: ${overlayRoot}\n` +
      `  deploy:  ${deployRoot}`,
  );
  return { copied, skipped, overlayRoot, deployRoot };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  syncShowcaseIntoPack({ dryRun: process.argv.includes('--dry-run') });
}
