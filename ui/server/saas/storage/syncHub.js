/**
 * PD-SAAS-FORK: @deprecated Phase 2 cloud-only — local↔hub sync retired (no-op stubs).
 */

/**
 * @deprecated Cloud-only mode: files live in canonical hub only.
 */
export async function syncWorkspaceHub(_workspace) {
  return { ok: true, bytes: 0, skipped: 'cloud-only' };
}

/**
 * @deprecated Cloud-only mode.
 * @param {string} _legacyProjectId
 */
export async function syncWorkspaceByProjectName(_legacyProjectId) {
  return { ok: true, bytes: 0, skipped: 'cloud-only' };
}

/**
 * @deprecated Cloud-only mode.
 */
export async function syncAllForCurrentUser() {
  return { results: [], skipped: 'cloud-only' };
}
