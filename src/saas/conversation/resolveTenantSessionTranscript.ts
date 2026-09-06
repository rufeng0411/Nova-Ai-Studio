/**
 * PD-SAAS-FORK: locate session jsonl under tenant pilot home (mirrors ui/server resolveSessionTranscriptPath).
 */
import { access, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { sanitizeSessionIdForPath } from "../../session/storage/ProjectSessionStorage.js";

/** @param {string} sessionId */
export function sessionTranscriptBasenames(sessionId: string): string[] {
  const trimmed = String(sessionId || "").trim();
  if (!trimmed) return [];
  const names = new Set([trimmed, sanitizeSessionIdForPath(trimmed)]);
  if (trimmed.includes("web:s_")) {
    names.add(trimmed.replace(/web:s_/g, "web-s_"));
  }
  if (trimmed.includes("web-s_")) {
    names.add(trimmed.replace(/web-s_/g, "web:s_"));
  }
  return [...names];
}

export async function findTenantSessionTranscriptPaths(
  tenantPilotHome: string,
  basenameCandidates: string[],
): Promise<Set<string>> {
  const matches = new Set<string>();
  const projectsRoot = path.join(tenantPilotHome, "projects");
  let entries;
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return matches;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(projectsRoot, entry.name, "chats");
    for (const base of basenameCandidates) {
      const candidate = path.join(chatsDir, `${base}.jsonl`);
      try {
        await access(candidate);
        matches.add(candidate);
      } catch {
        // not in this chats dir
      }
    }
  }
  return matches;
}

export async function resolveTenantSessionTranscriptAbsPath(input: {
  sessionId: string;
  tenantPilotHome: string;
  /** PD-SAAS-FORK: server-persisted relative transcript path; authoritative when present. */
  transcriptRelPath?: string;
}): Promise<string | null> {
  const { sessionId, tenantPilotHome, transcriptRelPath } = input;
  if (!sessionId || !tenantPilotHome) return null;

  const basenames = sessionTranscriptBasenames(sessionId);
  if (transcriptRelPath !== undefined) {
    const normalized = transcriptRelPath.replace(/\\/g, "/").trim();
    if (
      !normalized
      || normalized.includes("\0")
      || normalized.startsWith("/")
      || /^[A-Za-z]:\//.test(normalized)
    ) {
      return null;
    }
    const projectsRoot = path.resolve(tenantPilotHome, "projects");
    const candidate = path.resolve(tenantPilotHome, normalized);
    const relativeToProjects = path.relative(projectsRoot, candidate);
    const candidateBase = path.basename(candidate, ".jsonl");
    if (
      !relativeToProjects
      || relativeToProjects.startsWith("..")
      || path.isAbsolute(relativeToProjects)
      || path.basename(path.dirname(candidate)) !== "chats"
      || path.extname(candidate).toLowerCase() !== ".jsonl"
      || !basenames.includes(candidateBase)
    ) {
      return null;
    }
    try {
      await access(candidate);
      const [realProjectsRoot, realCandidate] = await Promise.all([
        realpath(projectsRoot),
        realpath(candidate),
      ]);
      const realRelative = path.relative(realProjectsRoot, realCandidate);
      if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        return null;
      }
      return candidate;
    } catch {
      return null;
    }
  }

  const matches = await findTenantSessionTranscriptPaths(tenantPilotHome, basenames);
  if (matches.size === 0) return null;

  let bestPath: string | null = null;
  let bestMtime = 0;
  for (const candidate of matches) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.mtimeMs >= bestMtime) {
        bestMtime = fileStat.mtimeMs;
        bestPath = candidate;
      }
    } catch {
      // skip
    }
  }
  return bestPath;
}
