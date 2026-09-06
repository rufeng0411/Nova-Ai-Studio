/**
 * PD-SAAS-FORK: Shared helpers for SaaS joint backup (PG/SQLite + tenants/).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function parsePgUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    host: u.hostname,
    port: u.port || '5432',
  };
}

export function resolvePgDump() {
  const candidates = [
    process.env.PG_DUMP,
    process.platform === 'win32' ? 'D:\\pgsql\\bin\\pg_dump.exe' : null,
    'pg_dump',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || 'pg_dump';
}

export function runCommand(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} exited ${result.status ?? 'unknown'}`);
  }
}

export function fileStatSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, bytes: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { exists: false, bytes: 0, mtimeMs: 0 };
  }
}

export async function countJsonlFiles(tenantsRoot) {
  let count = 0;
  let bytes = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith('.jsonl')) {
        count += 1;
        const st = await fs.promises.stat(full);
        bytes += st.size;
      }
    }
  }
  await walk(tenantsRoot);
  return { count, bytes };
}

export function listJointBackups(dataRoot) {
  const backupsRoot = path.join(dataRoot, 'backups');
  if (!fs.existsSync(backupsRoot)) return [];
  return fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('saas-joint-'))
    .map((d) => {
      const dir = path.join(backupsRoot, d.name);
      const manifestPath = path.join(dir, 'manifest.json');
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        manifest = null;
      }
      return { name: d.name, dir, manifest, mtimeMs: fs.statSync(dir).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function pruneOldBackups(dataRoot, retain) {
  const backups = listJointBackups(dataRoot);
  const toRemove = backups.slice(Math.max(1, retain));
  for (const item of toRemove) {
    fs.rmSync(item.dir, { recursive: true, force: true });
  }
  return toRemove.map((b) => b.name);
}
