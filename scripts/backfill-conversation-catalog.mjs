#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Backfill conversation_catalog from tenant jsonl transcripts.
 * Usage:
 *   node scripts/backfill-conversation-catalog.mjs [--verify-only] [--tenant TENANT] [--user USER_ID]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSessionLite, parseSessionInfoFromLite } from '../src/session/index.js';
import { getDataRoot, getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { openControlDatabase, closeControlDatabase } from '../ui/server/saas/db/control.js';
import { catalogStore } from '../ui/server/saas/conversation/CatalogStore.js';
import { normalizeSessionId } from '../ui/server/saas/conversation/normalizeSessionId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verifyOnly = process.argv.includes('--verify-only');
const tenantFilter = process.argv.includes('--tenant')
  ? process.argv[process.argv.indexOf('--tenant') + 1]
  : null;

process.env.PILOTDECK_SAAS_MODE = '1';
process.env.SAAS_CONVERSATION_CATALOG_SHADOW = '1';

async function listUsers(db) {
  if (tenantFilter) {
    return db.queryAll('SELECT id, tenant_id FROM users WHERE tenant_id = ? AND is_active = TRUE', [tenantFilter]);
  }
  return db.queryAll('SELECT id, tenant_id FROM users WHERE is_active = TRUE');
}

async function scanTenantUser(user) {
  const pilotHome = getTenantPilotHome(user.tenant_id);
  const projectsRoot = path.join(pilotHome, 'projects');
  let entries;
  try {
    entries = await fs.promises.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return { scanned: 0, upserted: 0, missing: 0 };
  }

  let scanned = 0;
  let upserted = 0;
  let missing = 0;

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
      scanned += 1;
      const sessionId = normalizeSessionId(file.slice(0, -'.jsonl'.length));
      const absPath = path.join(chatsDir, file);
      const relPath = path.relative(pilotHome, absPath).split(path.sep).join('/');

      const pgRow = await catalogStore.getBySessionId({
        tenantId: user.tenant_id,
        userId: user.id,
        sessionId,
        includeDeleted: true,
      });

      if (verifyOnly) {
        if (!pgRow) missing += 1;
        continue;
      }

      const lite = await readSessionLite(absPath);
      const info = lite ? parseSessionInfoFromLite(sessionId, lite) : null;
      await catalogStore.upsert({
        tenantId: user.tenant_id,
        userId: user.id,
        sessionId,
        legacyProjectId: entry.name,
        transcriptRelPath: relPath,
        summary: info?.summary ?? null,
        aiTitle: info?.aiTitle ?? null,
        customTitle: info?.customTitle ?? null,
        firstPrompt: info?.firstPrompt ?? null,
        tag: info?.tag ?? null,
        title: info?.summary ?? null,
        lastActivityAt: info ? new Date(info.lastModified).toISOString() : new Date().toISOString(),
        source: 'backfill',
      });
      upserted += 1;
    }
  }

  return { scanned, upserted, missing };
}

async function main() {
  if (!process.env.DATA_ROOT) {
    process.env.DATA_ROOT = path.join(getDataRoot());
  }
  const db = await openControlDatabase();
  const users = await listUsers(db);
  let totalScanned = 0;
  let totalUpserted = 0;
  let totalMissing = 0;

  for (const user of users) {
    const result = await scanTenantUser(user);
    totalScanned += result.scanned;
    totalUpserted += result.upserted;
    totalMissing += result.missing;
    console.log(`[backfill] tenant=${user.tenant_id} user=${user.id} scanned=${result.scanned} upserted=${result.upserted} missing=${result.missing}`);
  }

  const reportDir = path.join(__dirname, '..', 'docs');
  const reportPath = path.join(reportDir, `conversation-catalog-backfill-${new Date().toISOString().slice(0, 10)}.md`);
  const matchRate = totalScanned > 0 ? ((totalScanned - totalMissing) / totalScanned * 100).toFixed(1) : '100.0';
  const body = `# Conversation catalog backfill report

- Mode: ${verifyOnly ? 'verify-only' : 'upsert'}
- Scanned jsonl: ${totalScanned}
- Upserted: ${totalUpserted}
- Missing PG rows: ${totalMissing}
- Match rate: ${matchRate}%
- At: ${new Date().toISOString()}
`;
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, body, 'utf8');
  console.log(`[backfill] report → ${reportPath}`);

  await closeControlDatabase();
  if (verifyOnly && totalMissing > 0 && totalScanned > 0) {
    const rate = (totalScanned - totalMissing) / totalScanned;
    if (rate < 0.99) {
      console.error(`[backfill] FAIL match rate ${(rate * 100).toFixed(1)}% < 99%`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('[backfill] FAIL:', error);
  process.exit(1);
});
