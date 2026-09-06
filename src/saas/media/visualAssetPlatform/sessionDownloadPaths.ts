// PD-SAAS-FORK VAP: session-scoped download directory (isolates fetched images per conversation).

import path from "node:path";

import { sanitizeSessionIdForPath } from "../../../session/storage/ProjectSessionStorage.js";

/** Workspace-relative downloads root: artifacts/sessions/{sessionId}/downloads */
export function resolveSessionDownloadsRelDir(sessionId: string): string {
  const safeId = sanitizeSessionIdForPath(String(sessionId ?? "").trim() || "session");
  return `artifacts/sessions/${safeId}/downloads`.replace(/\\/gu, "/");
}

export function resolveSessionDownloadsAbsDir(
  workspaceRoot: string,
  sessionId: string,
): string {
  return path.join(workspaceRoot, resolveSessionDownloadsRelDir(sessionId));
}
