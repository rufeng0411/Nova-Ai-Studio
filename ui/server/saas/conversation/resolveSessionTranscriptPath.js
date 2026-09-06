/**
 * PD-SAAS-FORK: locate session jsonl under tenant pilot home (multi chat dirs).
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { sanitizeSessionIdForPath } from '../../utils/pilotPaths.js';

const TRANSCRIPT_PATH_CACHE_MS = 60_000;
/** @type {Map<string, { path: string, atMs: number }>} */
const transcriptPathCache = new Map();

/** @param {string} sessionId */
export function sessionTranscriptBasenames(sessionId) {
  const trimmed = String(sessionId || '').trim();
  if (!trimmed) return [];
  const names = new Set([trimmed, sanitizeSessionIdForPath(trimmed)]);
  if (trimmed.includes('web:s_')) {
    names.add(trimmed.replace(/web:s_/g, 'web-s_'));
  }
  if (trimmed.includes('web-s_')) {
    names.add(trimmed.replace(/web-s_/g, 'web:s_'));
  }
  return [...names];
}

/**
 * @param {string} pilotHome
 * @param {string[]} basenameCandidates
 * @returns {Promise<Set<string>>}
 */
export async function findTenantSessionTranscriptPaths(pilotHome, basenameCandidates) {
  const matches = new Set();
  const projectsRoot = path.join(pilotHome, 'projects');
  let entries;
  try {
    entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return matches;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(projectsRoot, entry.name, 'chats');
    for (const base of basenameCandidates) {
      const candidate = path.join(chatsDir, `${base}.jsonl`);
      try {
        await fs.access(candidate);
        matches.add(candidate);
      } catch {
        // not in this chats dir
      }
    }
  }
  return matches;
}

/**
 * @param {{
 *   sessionId: string;
 *   tenantPilotHome: string;
 *   catalogTranscriptRel?: string | null;
 * }} input
 * @returns {Promise<string | null>}
 */
export async function resolveSessionTranscriptAbsPath(input) {
  const { sessionId, tenantPilotHome, catalogTranscriptRel } = input;
  if (!sessionId || !tenantPilotHome) return null;

  if (catalogTranscriptRel) {
    const fromCatalog = path.join(
      tenantPilotHome,
      ...catalogTranscriptRel.split('/').filter(Boolean),
    );
    try {
      await fs.access(fromCatalog);
      return fromCatalog;
    } catch {
      // catalog path stale — scan tenant tree
    }
  }

  const basenames = sessionTranscriptBasenames(sessionId);
  const cacheKey = `${tenantPilotHome}::${basenames.join('|')}`;
  const cached = transcriptPathCache.get(cacheKey);
  if (cached && Date.now() - cached.atMs < TRANSCRIPT_PATH_CACHE_MS) {
    try {
      await fs.access(cached.path);
      return cached.path;
    } catch {
      transcriptPathCache.delete(cacheKey);
    }
  }

  const matches = await findTenantSessionTranscriptPaths(tenantPilotHome, basenames);
  if (matches.size === 0) return null;

  let bestPath = null;
  let bestMtime = 0;
  for (const candidate of matches) {
    try {
      const fileStat = await fs.stat(candidate);
      if (fileStat.mtimeMs >= bestMtime) {
        bestMtime = fileStat.mtimeMs;
        bestPath = candidate;
      }
    } catch {
      // skip
    }
  }
  if (bestPath) {
    transcriptPathCache.set(cacheKey, { path: bestPath, atMs: Date.now() });
  }
  return bestPath;
}

export function clearSessionTranscriptPathCache() {
  transcriptPathCache.clear();
}
