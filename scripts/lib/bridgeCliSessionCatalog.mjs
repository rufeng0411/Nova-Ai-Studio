/**
 * PD-SAAS-FORK: Upsert conversation_catalog for a CLI/Gateway session after jsonl exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openControlDatabase, closeControlDatabase } from '../../ui/server/saas/db/control.js';
import { catalogStore } from '../../ui/server/saas/conversation/CatalogStore.js';
import { normalizeSessionId } from '../../ui/server/saas/conversation/normalizeSessionId.js';
import { sessionTranscriptBasenames } from '../../ui/server/saas/conversation/resolveSessionTranscriptPath.js';
import { getTenantPilotHome } from '../../ui/server/saas/tenant/paths.js';
import { resolvePilotHome } from '../../ui/server/utils/pilotPaths.js';

process.env.PILOTDECK_SAAS_MODE = '1';
process.env.SAAS_CONVERSATION_CATALOG_SHADOW = '1';

/**
 * @param {{ sessionKey: string, tenantId?: string, userId?: number, projectName?: string }} opts
 */
export async function bridgeCliSessionToCatalog(opts) {
  const tenantId = opts.tenantId || 'default';
  const sessionId = normalizeSessionId(opts.sessionKey);
  if (!sessionId) return { ok: false, reason: 'empty sessionKey' };

  const pilotHomes = [getTenantPilotHome(tenantId)];
  const globalPilotHome = resolvePilotHome(process.env);
  if (tenantId === 'default' && !pilotHomes.includes(globalPilotHome)) {
    pilotHomes.push(globalPilotHome);
  }
  const basenameCandidates = sessionTranscriptBasenames(sessionId);

  let foundAbs = null;
  let legacyProjectId = null;
  let pilotHome = pilotHomes[0];
  for (const candidatePilotHome of pilotHomes) {
    const projectsRoot = path.join(candidatePilotHome, 'projects');
    if (!fs.existsSync(projectsRoot)) continue;
    for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const chatsDir = path.join(projectsRoot, entry.name, 'chats');
      for (const base of basenameCandidates) {
        const candidate = path.join(chatsDir, `${base}.jsonl`);
        if (fs.existsSync(candidate)) {
          foundAbs = candidate;
          legacyProjectId = entry.name;
          pilotHome = candidatePilotHome;
          break;
        }
      }
      if (foundAbs) break;
    }
    if (foundAbs) break;
  }

  if (!foundAbs) {
    return { ok: false, reason: 'transcript not found on disk' };
  }

  const relPath = path.relative(pilotHome, foundAbs).split(path.sep).join('/');
  const stat = fs.statSync(foundAbs);

  const db = await openControlDatabase();
  let userId = opts.userId;
  if (!userId) {
    const row = await db.queryOne(
      'SELECT id FROM users WHERE tenant_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
      [tenantId],
    );
    userId = row?.id;
  }
  await closeControlDatabase();

  if (!userId) {
    return { ok: false, reason: 'no active user for tenant' };
  }

  await catalogStore.upsert({
    tenantId,
    userId,
    sessionId,
    legacyProjectId: legacyProjectId || 'general',
    transcriptRelPath: relPath,
    lastActivityAt: new Date(stat.mtimeMs).toISOString(),
    status: 'active',
    source: 'cli-bridge',
  });

  return { ok: true, sessionId, transcriptRelPath: relPath };
}
