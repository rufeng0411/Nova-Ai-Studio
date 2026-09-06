#!/usr/bin/env node
/**
 * PD-SAAS-FORK: capture host OS baseline for pre-production reports.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'pre-production-test');
const OUT_FILE = path.join(OUT_DIR, 'os-compat-smoke.json');

const snapshot = {
  capturedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  cwd: process.cwd(),
  pathSep: path.sep,
  tmpdir: os.tmpdir(),
  homedir: os.homedir(),
  cpus: os.cpus().length,
  totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
  saasDatabaseUrl: Boolean(process.env.SAAS_DATABASE_URL?.trim()),
  dataRoot: process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data'),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`[os-compat-smoke] ${snapshot.platform}/${snapshot.arch} → ${OUT_FILE}`);
