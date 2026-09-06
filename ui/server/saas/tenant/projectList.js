/**
 * PD-SAAS-FORK: Tenant-scoped project disk scan (no gateway dependency).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function countChatsInProjectDir(projectDir) {
  const chatsDir = path.join(projectDir, 'chats');
  try {
    const files = await fs.readdir(chatsDir);
    return files.filter((name) => name.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}

export async function readMarkedProjectPathsForHome(pilotHome) {
  const projectsDir = path.join(pilotHome, 'projects');
  const result = new Map();
  let entries = [];
  try {
    entries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cwdFile = path.join(projectsDir, entry.name, '.cwd');
    try {
      const raw = await fs.readFile(cwdFile, 'utf8');
      const cwd = raw.trim();
      if (cwd) result.set(entry.name, cwd);
    } catch {
      // skip
    }
  }
  return result;
}

/**
 * @param {string} pilotHome
 * @returns {Promise<Array<{ fullPath: string, projectKey: string, sessionCount: number }>>}
 */
export async function listTenantDiskProjects(pilotHome) {
  const projectsDir = path.join(pilotHome, 'projects');
  const marked = await readMarkedProjectPathsForHome(pilotHome);
  const entries = [];
  for (const [id, cwd] of marked) {
    entries.push({
      fullPath: cwd,
      projectKey: cwd,
      sessionCount: await countChatsInProjectDir(path.join(projectsDir, id)),
    });
  }
  let dirEntries = [];
  try {
    dirEntries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    if (marked.has(entry.name)) continue;
    const projectDir = path.join(projectsDir, entry.name);
    const cwdFile = path.join(projectDir, '.cwd');
    let fullPath = null;
    try {
      const raw = await fs.readFile(cwdFile, 'utf8');
      fullPath = raw.trim() || null;
    } catch {
      fullPath = null;
    }
    if (!fullPath) continue;
    entries.push({
      fullPath,
      projectKey: fullPath,
      sessionCount: await countChatsInProjectDir(projectDir),
    });
  }
  return entries;
}
