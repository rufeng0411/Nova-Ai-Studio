#!/usr/bin/env node
/**
 * PD-SAAS-FORK: one-time migration to Phase 2 cloud-only storage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function copyMissingNewer(sourceRoot, targetRoot) {
  let bytes = 0;
  try {
    await fs.promises.access(sourceRoot);
  } catch {
    return bytes;
  }
  await fs.promises.mkdir(targetRoot, { recursive: true });

  async function walk(dir, base = dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, base);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(base, full);
      const dest = path.join(targetRoot, rel);
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      let copy = true;
      try {
        const [srcStat, destStat] = await Promise.all([
          fs.promises.stat(full),
          fs.promises.stat(dest),
        ]);
        if (destStat.mtimeMs >= srcStat.mtimeMs) {
          copy = false;
        }
      } catch {
        copy = true;
      }
      if (copy) {
        await fs.promises.copyFile(full, dest);
        bytes += (await fs.promises.stat(full)).size;
      }
    }
  }

  await walk(sourceRoot);
  return bytes;
}

async function main() {
  const dataRoot = process.env.DATA_ROOT;
  if (!dataRoot) {
    console.error('DATA_ROOT is required');
    process.exitCode = 1;
    return;
  }

  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;

  const { listAllWorkspaces, promoteWorkspaceToCloudOnly } = await import(
    '../ui/server/saas/storage/workspaceStore.js'
  );
  const { ensureTranscriptMarkerForWorkspace, migrateLooseTenantArtifacts } = await import(
    '../ui/server/saas/storage/ensureWorkspaces.js'
  );
  const { updateUserPreferences, getUserPreferences } = await import(
    '../ui/server/saas/userPreferences.js'
  );
  const { getTenantRoot } = await import('../ui/server/saas/tenant/paths.js');
  const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');

  const workspaces = await listAllWorkspaces();
  const report = { migratedFiles: 0, promoted: 0, markers: 0, users: 0 };

  for (const ws of workspaces) {
    if (ws.localRootPath && ws.canonicalProjectKey) {
      const bytes = await copyMissingNewer(ws.localRootPath, ws.canonicalProjectKey);
      report.migratedFiles += bytes;
    }
    await promoteWorkspaceToCloudOnly(ws.id);
    report.promoted += 1;

    const tenantPilotHome = path.join(getTenantRoot(ws.tenantId), '');
    const tenantHome = path.join(dataRoot, 'tenants', ws.tenantId);
    await ensureTranscriptMarkerForWorkspace(tenantHome, {
      legacyProjectId: ws.legacyProjectId,
      canonicalProjectKey: ws.canonicalProjectKey,
    });
    report.markers += 1;

    await migrateLooseTenantArtifacts({
      userId: ws.userId,
      tenantId: ws.tenantId,
      tenantPilotHome: tenantHome,
    });

    const prefs = await getUserPreferences(ws.userId);
    await updateUserPreferences(ws.userId, {
      fileStorage: {
        ...prefs.fileStorage,
        cloudOnly: true,
        migrationVersion: 2,
      },
    });
    report.users += 1;
  }

  const archiveRoot = path.join(dataRoot, '_archive_local-bindings');
  const localBindings = path.join(dataRoot, 'tenants');
  for (const tenantId of fs.readdirSync(localBindings, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const lb = path.join(localBindings, tenantId, 'local-bindings');
    if (!fs.existsSync(lb)) continue;
    const dest = path.join(archiveRoot, tenantId, 'local-bindings');
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.promises.rename(lb, dest);
      console.log(`Archived ${lb} -> ${dest}`);
    } catch (error) {
      console.warn(`Could not archive ${lb}:`, error.message);
    }
  }

  await closeControlDatabase();

  const reportPath = path.join(__dirname, '..', 'docs', 'cloud-only-migration-report-2026-06-11.md');
  const lines = [
    '# Cloud-only migration report',
    '',
    `> DATA_ROOT: ${dataRoot}`,
    '',
    `- Workspaces promoted: ${report.promoted}`,
    `- Transcript markers refreshed: ${report.markers}`,
    `- Bytes copied local→hub: ${report.migratedFiles}`,
    `- User prefs updated: ${report.users}`,
    '',
  ];
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log('Migration complete:', report);
  console.log('Report:', reportPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
