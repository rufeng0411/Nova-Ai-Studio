#!/usr/bin/env node
/**
 * PD-SAAS-FORK: SaaS data integrity — catalog↔jsonl、联合备份新鲜度、四线对齐快照。
 *
 * Usage:
 *   node scripts/verify-saas-data-integrity.mjs [--gate] [--max-backup-age-hours 168]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataRoot, getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { openControlDatabase, closeControlDatabase } from '../ui/server/saas/db/control.js';
import { normalizeSessionId } from '../ui/server/saas/conversation/normalizeSessionId.js';
import { countJsonlFiles, listJointBackups } from './lib/saasJointBackupLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const gateMode = process.argv.includes('--gate');
const maxBackupAgeHours = Number.parseInt(argValue('--max-backup-age-hours', '168'), 10);
const backupRequired = process.env.SAAS_BACKUP_REQUIRED === '1';

async function scanDiskJsonlByTenant(tenantId) {
  const pilotHome = getTenantPilotHome(tenantId);
  const projectsRoot = path.join(pilotHome, 'projects');
  const onDisk = new Map();
  let entries;
  try {
    entries = await fs.promises.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return onDisk;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(projectsRoot, entry.name, 'chats');
    let files;
    try {
      files = await fs.promises.readdir(chatsDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const sessionId = normalizeSessionId(file.slice(0, -'.jsonl'.length));
      onDisk.set(sessionId, path.join(chatsDir, file));
    }
  }
  return onDisk;
}

async function checkCatalogJsonlAlignment(db) {
  const users = await db.queryAll('SELECT id, tenant_id FROM users WHERE is_active = TRUE');
  const tenantIds = [...new Set(users.map((u) => u.tenant_id))];
  let diskSessions = 0;
  let catalogMissing = 0;
  let catalogOrphans = 0;
  let catalogActive = 0;

  for (const tenantId of tenantIds) {
    const onDisk = await scanDiskJsonlByTenant(tenantId);
    diskSessions += onDisk.size;

    const catalogRows = await db.queryAll(
      `SELECT session_id, transcript_rel_path, deleted_at
       FROM conversation_catalog
       WHERE tenant_id = ?`,
      [tenantId],
    );
    const activeRows = catalogRows.filter((row) => !row.deleted_at);
    catalogActive += activeRows.length;

    const catalogSessionIds = new Set(
      catalogRows.map((row) => normalizeSessionId(String(row.session_id || ''))),
    );
    for (const sessionId of onDisk.keys()) {
      if (!catalogSessionIds.has(sessionId)) catalogMissing += 1;
    }

    const pilotHome = getTenantPilotHome(tenantId);
    for (const row of activeRows) {
      const abs = path.join(pilotHome, String(row.transcript_rel_path || '').replace(/\//g, path.sep));
      if (!fs.existsSync(abs)) catalogOrphans += 1;
    }
  }

  const missingPct = diskSessions > 0 ? (catalogMissing / diskSessions) * 100 : 0;
  return { diskSessions, catalogActive, catalogMissing, catalogOrphans, missingPct };
}

async function fourLineQuickStats(dataRoot) {
  const { spawnSync } = await import('node:child_process');
  const auditScript = path.join(REPO_ROOT, 'scripts', 'audit-four-line-alignment.mjs');
  const result = spawnSync(
    process.execPath,
    [auditScript, '--tenant', 'default', '--limit', '80'],
    {
      env: { ...process.env, DATA_ROOT: dataRoot, PILOTDECK_SAAS_MODE: '1' },
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  const alignedMatch = text.match(/aligned=([\d.]+)%/);
  return {
    ok: result.status === 0 || alignedMatch != null,
    alignedPct: alignedMatch ? Number.parseFloat(alignedMatch[1]) : null,
    exitCode: result.status,
  };
}

async function main() {
  const dataRoot = path.resolve(process.env.DATA_ROOT?.trim() || getDataRoot());
  const tenantsRoot = path.join(dataRoot, 'tenants');
  const report = {
    checkedAt: new Date().toISOString(),
    dataRoot,
    checks: {},
    warnings: [],
    failures: [],
  };

  if (!fs.existsSync(tenantsRoot)) {
    report.failures.push(`tenants root missing: ${tenantsRoot}`);
  } else {
    const jsonl = await countJsonlFiles(tenantsRoot);
    report.checks.jsonl = jsonl;
  }

  const backups = listJointBackups(dataRoot);
  report.checks.backups = {
    count: backups.length,
    latest: backups[0]?.manifest?.createdAt || (backups[0] ? new Date(backups[0].mtimeMs).toISOString() : null),
  };
  if (backups.length === 0) {
    const msg = 'no saas-joint backup found (run npm run backup:saas:joint)';
    if (backupRequired) report.failures.push(msg);
    else report.warnings.push(msg);
  } else {
    const ageHours = (Date.now() - backups[0].mtimeMs) / (1000 * 60 * 60);
    report.checks.backups.latestAgeHours = Math.round(ageHours * 10) / 10;
    if (ageHours > maxBackupAgeHours) {
      const msg = `latest backup is ${report.checks.backups.latestAgeHours}h old (max ${maxBackupAgeHours}h)`;
      if (backupRequired || gateMode) report.failures.push(msg);
      else report.warnings.push(msg);
    }
  }

  const db = await openControlDatabase();
  try {
    try {
      const alignment = await checkCatalogJsonlAlignment(db);
      report.checks.catalogJsonl = alignment;
      if (alignment.diskSessions > 0 && alignment.missingPct > 5) {
        report.warnings.push(
          `catalog missing for ${alignment.catalogMissing}/${alignment.diskSessions} jsonl (${alignment.missingPct.toFixed(1)}%) — run npm run backfill:conversation-catalog`,
        );
      }
      if (alignment.catalogOrphans > 0) {
        report.warnings.push(
          `catalog points to ${alignment.catalogOrphans} missing jsonl file(s) — reconcile or purge`,
        );
      }
    } catch (catalogError) {
      const msg = catalogError instanceof Error ? catalogError.message : String(catalogError);
      report.checks.catalogJsonl = { skipped: true, reason: msg };
      report.warnings.push(`catalog alignment skipped: ${msg}`);
    }
  } finally {
    await closeControlDatabase();
  }

  const fourLine = await fourLineQuickStats(dataRoot);
  report.checks.fourLine = fourLine;
  if (fourLine.alignedPct != null && fourLine.alignedPct < 85) {
    report.warnings.push(
      `four-line aligned ${fourLine.alignedPct}% < 85% (mostly missing_on_disk for deleted artifacts)`,
    );
  }

  const outDir = path.join(REPO_ROOT, 'artifacts', 'saas-data-integrity');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `integrity-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[verify-saas-data-integrity] report →', outPath);
  console.log(JSON.stringify(report.checks, null, 2));
  for (const w of report.warnings) console.warn('[verify-saas-data-integrity] WARN:', w);
  for (const f of report.failures) console.error('[verify-saas-data-integrity] FAIL:', f);

  if (gateMode && report.failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('[verify-saas-data-integrity] FAIL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
