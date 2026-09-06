import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isSyntheticSessionTitlePrompt } from "../../agent/errors/userFacingErrors.js";
import { getPilotProjectChatDir } from "../../pilot/index.js";
import { readSessionLite, type SessionLiteFile } from "./SessionLiteReader.js";

const ALWAYS_ON_AUXILIARY_PREFIXES = [
  "always-on-discovery:",
  "always-on-workspace:",
  "always-on-report:",
];

function isInternalSession(sessionId: string): boolean {
  return ALWAYS_ON_AUXILIARY_PREFIXES.some((p) => sessionId.startsWith(p));
}

export type SessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
  fileSize?: number;
  customTitle?: string;
  aiTitle?: string;
  firstPrompt?: string;
  cwd?: string;
  tag?: string;
  createdAt?: number;
};

export type ListProjectSessionsOptions = {
  projectRoot: string;
  pilotHome: string;
  limit?: number;
  offset?: number;
  includeInternal?: boolean;
};

export type ListProjectSessionsFromChatDirsOptions = {
  chatDirs: string[];
  pilotHome: string;
  projectRoot?: string;
  limit?: number;
  offset?: number;
  includeInternal?: boolean;
};

type SessionFileCandidate = {
  name: string;
  sessionId: string;
  path: string;
  mtime: number;
  size: number;
};

export async function listProjectSessions(options: ListProjectSessionsOptions): Promise<SessionInfo[]> {
  const chatDir = getPilotProjectChatDir(options.projectRoot, options.pilotHome);
  // PD-SAAS-FORK: list/count are split so a 5-item sidebar page does not lite-read every transcript.
  const candidates = await listSessionFileCandidates(chatDir, options.includeInternal);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? candidates.length;
  const wanted = limit === 0 ? Number.POSITIVE_INFINITY : offset + limit;
  const sessions: SessionInfo[] = [];

  for (const candidate of candidates) {
    if (sessions.length >= wanted) break;
    const lite = await readSessionLite(candidate.path);
    if (!lite) continue;
    const info = parseSessionInfoFromLite(candidate.sessionId, lite, options.projectRoot);
    if (info) {
      sessions.push(info);
    }
  }

  return sessions.slice(offset, limit === 0 ? undefined : offset + limit);
}

export async function countProjectSessions(options: ListProjectSessionsOptions): Promise<number> {
  const chatDir = getPilotProjectChatDir(options.projectRoot, options.pilotHome);
  const candidates = await listSessionFileCandidates(chatDir, options.includeInternal);
  return candidates.length;
}

/** PD-SAAS-FORK: merge transcript pages across legacy/canonical chat dirs (dedupe by sessionId). */
export async function listProjectSessionsFromChatDirs(
  options: ListProjectSessionsFromChatDirsOptions,
): Promise<SessionInfo[]> {
  const merged = await mergeSessionFileCandidates(options.chatDirs, options.includeInternal);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? merged.length;
  const wanted = limit === 0 ? Number.POSITIVE_INFINITY : offset + limit;
  const sessions: SessionInfo[] = [];
  const projectRoot = options.projectRoot ?? "";

  for (const candidate of merged) {
    if (sessions.length >= wanted) break;
    const lite = await readSessionLite(candidate.path);
    if (!lite) continue;
    const info = parseSessionInfoFromLite(candidate.sessionId, lite, projectRoot || undefined);
    if (info) {
      sessions.push(info);
    }
  }

  return sessions.slice(offset, limit === 0 ? undefined : offset + limit);
}

export async function countProjectSessionsFromChatDirs(
  chatDirs: string[],
  includeInternal = false,
): Promise<number> {
  const merged = await mergeSessionFileCandidates(chatDirs, includeInternal);
  return merged.length;
}

async function mergeSessionFileCandidates(
  chatDirs: string[],
  includeInternal = false,
): Promise<SessionFileCandidate[]> {
  const bySessionId = new Map<string, SessionFileCandidate>();
  for (const chatDir of chatDirs) {
    const candidates = await listSessionFileCandidates(chatDir, includeInternal);
    for (const candidate of candidates) {
      const existing = bySessionId.get(candidate.sessionId);
      if (!existing || candidate.mtime > existing.mtime) {
        bySessionId.set(candidate.sessionId, candidate);
      }
    }
  }
  return [...bySessionId.values()].sort((left, right) => right.mtime - left.mtime);
}

async function listSessionFileCandidates(
  chatDir: string,
  includeInternal = false,
): Promise<SessionFileCandidate[]> {
  let names: string[];
  try {
    names = await readdir(chatDir);
  } catch {
    return [];
  }

  const candidates: SessionFileCandidate[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) {
      continue;
    }
    const sessionId = name.slice(0, -".jsonl".length);
    if (!includeInternal && isInternalSession(sessionId)) {
      continue;
    }
    const path = join(chatDir, name);
    const fileStat = await stat(path).catch(() => null);
    if (!fileStat?.isFile() || fileStat.size === 0) {
      continue;
    }
    candidates.push({
      name,
      sessionId,
      path,
      mtime: fileStat.mtime.getTime(),
      size: fileStat.size,
    });
  }

  candidates.sort((left, right) => right.mtime - left.mtime);
  return candidates;
}

export function parseSessionInfoFromLite(
  sessionId: string,
  lite: SessionLiteFile,
  projectRoot?: string,
): SessionInfo | null {
  const source = `${lite.head}\n${lite.tail}`;
  // PD-SAAS-FORK: sidebar title freezes on first auto title / first user prompt;
  // only user rename (custom title metadata) may override later turns.
  const customTitle = lastMetadataStringField(source, "title");
  const aiTitle = firstMetadataStringField(source, "aiTitle");
  const tag = lastMetadataStringField(source, "tag");
  const firstPrompt = firstAcceptedInputText(lite);
  const firstCreatedAt = firstJsonStringField(lite.head, "createdAt");
  const summary = customTitle ?? aiTitle ?? firstPrompt;

  return {
    sessionId,
    summary: summary || "对话",
    lastModified: lite.mtime,
    fileSize: lite.size,
    customTitle,
    aiTitle,
    firstPrompt,
    cwd: projectRoot,
    tag,
    createdAt: firstCreatedAt ? Date.parse(firstCreatedAt) : undefined,
  };
}

function firstAcceptedInputText(lite: SessionLiteFile): string | undefined {
  return (
    firstAcceptedInputTextFromSource(lite.head)
    ?? (lite.tail !== lite.head ? firstAcceptedInputTextFromSource(lite.tail) : undefined)
  );
}

function firstAcceptedInputTextFromSource(source: string): string | undefined {
  for (const line of source.split(/\r?\n/)) {
    if (!line.includes('"type":"accepted_input"')) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as {
        messages?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };
      const text = entry.messages?.flatMap((message) => message.content ?? []).find((block) => block.type === "text")?.text;
      if (text?.trim() && !isSyntheticSessionTitlePrompt(text)) {
        return text.trim();
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function firstJsonStringField(source: string, field: string): string | undefined {
  const match = source.match(new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"])*)"`));
  return match?.[1] ? unescapeJsonString(match[1]) : undefined;
}

function lastJsonStringField(source: string, field: string): string | undefined {
  const regex = new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"])*)"`, "g");
  let value: string | undefined;
  for (const match of source.matchAll(regex)) {
    if (match[1]) {
      value = unescapeJsonString(match[1]);
    }
  }
  return value;
}

/**
 * Like {@link lastJsonStringField} but restricted to JSONL lines whose
 * `"type"` is `"session_metadata"`. The old approach scanned the entire
 * raw head+tail text for `"title"`, which would pick up stray `"title"`
 * keys from tool-call inputs, web-search results, or activity frames —
 * causing the sidebar to display an intermediate tool argument instead
 * of the actual session title.
 */
function firstMetadataStringField(source: string, field: string): string | undefined {
  const fieldRegex = new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"])*)"`);
  for (const line of source.split(/\r?\n/)) {
    if (!line.includes('"session_metadata"')) continue;
    const match = line.match(fieldRegex);
    if (match?.[1]) {
      return unescapeJsonString(match[1]);
    }
  }
  return undefined;
}

function lastMetadataStringField(source: string, field: string): string | undefined {
  const fieldRegex = new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"])*)"`);
  let value: string | undefined;
  for (const line of source.split(/\r?\n/)) {
    if (!line.includes('"session_metadata"')) continue;
    const match = line.match(fieldRegex);
    if (match?.[1]) {
      value = unescapeJsonString(match[1]);
    }
  }
  return value;
}

function unescapeJsonString(value: string): string {
  return JSON.parse(`"${value}"`) as string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** Options for listing sessions across all known projects. */
export type ListAllSessionsOptions = {
  pilotHome: string;
  limit?: number;
  offset?: number;
  includeInternal?: boolean;
};

/**
 * List sessions across **all** projects under `{pilotHome}/projects/`. Each
 * project directory is scanned for `.jsonl` files in its `chats/` subfolder.
 * Results are sorted by lastModified descending (most-recent first), then
 * paginated via `limit` / `offset`.
 */
export async function listAllSessions(options: ListAllSessionsOptions): Promise<SessionInfo[]> {
  const projectsDir = resolve(options.pilotHome, "projects");
  let projectIds: string[];
  try {
    projectIds = await readdir(projectsDir);
  } catch {
    return [];
  }

  const all: SessionInfo[] = [];
  for (const projectId of projectIds) {
    const chatDir = join(projectsDir, projectId, "chats");
    let names: string[];
    try {
      names = await readdir(chatDir);
    } catch {
      continue;
    }

    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      const sessionId = name.slice(0, -".jsonl".length);
      if (!options.includeInternal && isInternalSession(sessionId)) continue;
      const lite = await readSessionLite(join(chatDir, name));
      if (!lite) continue;
      const info = parseSessionInfoFromLite(sessionId, lite);
      if (info) {
        info.cwd = projectId;
        all.push(info);
      }
    }
  }

  all.sort((left, right) => right.lastModified - left.lastModified);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? all.length;
  return all.slice(offset, limit === 0 ? undefined : offset + limit);
}

/** Options for title-based session search. */
export type SearchSessionsByTitleOptions = {
  projectRoot: string;
  pilotHome: string;
  query: string;
  limit?: number;
  includeInternal?: boolean;
};

/**
 * Search sessions within a project by matching `query` (case-insensitive
 * substring) against `customTitle`, `aiTitle`, and `firstPrompt`. Returns
 * results sorted by lastModified descending.
 */
export async function searchSessionsByTitle(options: SearchSessionsByTitleOptions): Promise<SessionInfo[]> {
  const chatDir = getPilotProjectChatDir(options.projectRoot, options.pilotHome);
  let names: string[];
  try {
    names = await readdir(chatDir);
  } catch {
    return [];
  }

  const needle = options.query.toLowerCase();
  const results: SessionInfo[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) continue;
    const sessionId = name.slice(0, -".jsonl".length);
    if (!options.includeInternal && isInternalSession(sessionId)) continue;
    const lite = await readSessionLite(join(chatDir, name));
    if (!lite) continue;
    const info = parseSessionInfoFromLite(sessionId, lite, options.projectRoot);
    if (!info) continue;
    const haystack = [info.customTitle, info.aiTitle, info.firstPrompt]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (haystack.includes(needle)) {
      results.push(info);
    }
  }

  results.sort((left, right) => right.lastModified - left.lastModified);
  return options.limit ? results.slice(0, options.limit) : results;
}
