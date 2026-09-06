#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Joint backup — control DB (PG dump or SQLite) + tenants/ (JSONL + cloud-storage).
 *
 * Usage:
 *   node scripts/backup-saas-joint.mjs [--output DIR] [--retain 7]
 *   node scripts/backup-saas-joint.mjs --list
 *
 * Output: {DATA_ROOT}/backups/saas-joint-{timestamp}/manifest.json + artifacts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataRoot } from '../ui/server/saas/tenant/paths.js';
import {
  countJsonlFiles,
  fileStatSafe,
  listJointBackups,
  parsePgUrl,
  pruneOldBackups,
  resolvePgDump,
  runCommand,
} from './lib/saasJointBackupLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const listMode = process.argv.includes('--list');
const retain = Number.parseInt(argValue('--retain', '7'), 10);
const dataRoot = path.resolve(process.env.DATA_ROOT?.trim() || getDataRoot());
const tenantsRoot = path.join(dataRoot, 'tenants');
const saasDbUrl = process.env.SAAS_DATABASE_URL?.trim() || '';

async function main() {
  if (listMode) {
    const backups = listJointBackups(dataRoot);
    if (backups.length === 0) {
      console.log('[backup-saas-joint] no joint backups found');
      return;
    }
    for (const b of backups) {
      const when = b.manifest?.createdAt || new Date(b.mtimeMs).toISOString();
      const jsonl = b.manifest?.jsonlCount ?? '?';
      console.log(`${b.name}  created=${when}  jsonl=${jsonl}`);
    }
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(argValue('--output', path.join(dataRoot, 'backups', `saas-joint-${stamp}`)));
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(tenantsRoot)) {
    throw new Error(`tenants root missing: ${tenantsRoot}`);
  }

  const jsonlStats = await countJsonlFiles(tenantsRoot);
  const tenantsTar = path.join(outDir, 'tenants.tar.gz');
  console.log(`[backup-saas-joint] tar tenants → ${tenantsTar}`);
  runCommand('tar', ['-czf', tenantsTar, '-C', dataRoot, 'tenants']);

  const dbArtifacts = [];
  if (saasDbUrl) {
    const pg = parsePgUrl(saasDbUrl);
    const pgDump = resolvePgDump();
    const dumpPath = path.join(outDir, 'postgres.dump');
    console.log(`[backup-saas-joint] pg_dump → ${dumpPath}`);
    runCommand(
      pgDump,
      ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-Fc', '-f', dumpPath],
      { PGPASSWORD: pg.password },
    );
    dbArtifacts.push({ kind: 'postgres', path: 'postgres.dump', ...fileStatSafe(dumpPath) });
  } else {
    const controlDb = path.join(dataRoot, 'control.db');
    if (!fs.existsSync(controlDb)) {
      throw new Error(`control.db missing and SAAS_DATABASE_URL unset: ${controlDb}`);
    }
    const dest = path.join(outDir, 'control.db');
    await fs.promises.copyFile(controlDb, dest);
    dbArtifacts.push({ kind: 'sqlite', path: 'control.db', ...fileStatSafe(dest) });
    for (const suffix of ['-wal', '-shm']) {
      const src = controlDb + suffix;
      if (fs.existsSync(src)) {
        const name = `control.db${suffix}`;
        await fs.promises.copyFile(src, path.join(outDir, name));
        dbArtifacts.push({ kind: 'sqlite', path: name, ...fileStatSafe(src) });
      }
    }
  }

  const manifest = {
    kind: 'saas-joint-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    dataRoot,
    dbBackend: saasDbUrl ? 'postgres' : 'sqlite',
    jsonlCount: jsonlStats.count,
    jsonlBytes: jsonlStats.bytes,
    artifacts: [
      { kind: 'tenants', path: 'tenants.tar.gz', ...fileStatSafe(tenantsTar) },
      ...dbArtifacts,
    ],
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const removed = pruneOldBackups(dataRoot, retain);
  console.log(`[backup-saas-joint] done → ${outDir}`);
  console.log(`[backup-saas-joint] jsonl=${jsonlStats.count} files (${jsonlStats.bytes} bytes)`);
  if (removed.length > 0) {
    console.log(`[backup-saas-joint] pruned ${removed.length} old backup(s): ${removed.join(', ')}`);
  }
}

main().catch((error) => {
  console.error('[backup-saas-joint] FAIL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
