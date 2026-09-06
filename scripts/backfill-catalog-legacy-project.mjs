#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Fix catalog rows with legacy_project_id='general' → tenant pilot-home slug.
 * Usage:
 *   node scripts/backfill-catalog-legacy-project.mjs [--dry-run]
 *   node scripts/backfill-catalog-legacy-project.mjs --apply [--tenant default]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectId } from '../ui/server/utils/pilotPaths.js';
import { getDataRoot, getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { openControlDatabase, closeControlDatabase } from '../ui/server/saas/db/control.js';
import { catalogStore } from '../ui/server/saas/conversation/CatalogStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';
if (!process.env.DATA_ROOT) {
  process.env.DATA_ROOT = getDataRoot();
}

const dryRun = !process.argv.includes('--apply');
const tenantFilter = process.argv.includes('--tenant')
  ? process.argv[process.argv.indexOf('--tenant') + 1]
  : 'default';

async function main() {
  const db = await openControlDatabase();
  const rows = await db.queryAll(
    `SELECT id, tenant_id, user_id, session_id, legacy_project_id, transcript_rel_path
     FROM conversation_catalog
     WHERE tenant_id = ? AND legacy_project_id = 'general' AND deleted_at IS NULL`,
    [tenantFilter],
  );

  const pilotHome = getTenantPilotHome(tenantFilter);
  const expectedSlug = createProjectId(pilotHome);
  let updated = 0;
  let transcriptFixed = 0;
  let missingOnDisk = 0;

  for (const row of rows) {
    const sessionId = String(row.session_id);
    const expectedRel = `projects/${expectedSlug}/chats/${sessionId}.jsonl`;
    const absExpected = path.join(pilotHome, expectedRel.split('/').join(path.sep));
    const exists = fs.existsSync(absExpected);
    if (!exists) missingOnDisk += 1;

    const nextRel = exists ? expectedRel : String(row.transcript_rel_path || expectedRel);
    if (!dryRun) {
      await catalogStore.upsert({
        tenantId: row.tenant_id,
        userId: row.user_id,
        sessionId,
        legacyProjectId: expectedSlug,
        transcriptRelPath: nextRel,
        source: 'legacy-project-backfill',
        lastActivityAt: new Date().toISOString(),
      });
    }
    updated += 1;
    if (nextRel !== row.transcript_rel_path) transcriptFixed += 1;
  }

  await closeControlDatabase();

  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `catalog-legacy-project-backfill-${date}.md`);
  const mismatchRate = rows.length > 0 ? ((rows.length - missingOnDisk) / rows.length) * 100 : 100;

  const body = `# Catalog legacy project backfill (${date})

- Mode: ${dryRun ? 'dry-run' : 'apply'}
- Tenant: \`${tenantFilter}\`
- Rows with legacy_project_id=general: ${rows.length}
- Would update / updated: ${updated}
- Transcript rel path fixed: ${transcriptFixed}
- Expected slug: \`${expectedSlug}\`
- On-disk match rate: ${mismatchRate.toFixed(1)}%
- At: ${new Date().toISOString()}
`;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, body, 'utf8');
  console.log(`[backfill-catalog-legacy] rows=${rows.length} updated=${updated} report=${reportPath}`);
}

main().catch((error) => {
  console.error('[backfill-catalog-legacy] FAIL:', error);
  process.exit(1);
});
