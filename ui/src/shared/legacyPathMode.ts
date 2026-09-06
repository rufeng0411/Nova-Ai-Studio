/**
 * PD-SAAS-FORK: Legacy path resolution mode — meta-first for historical turns,
 * strict hintDir (no mtime guess) only for new turns with scopeId dirs.
 */

export type LegacyPathMode = 'legacy' | 'strict';

export interface TurnPathMetaLike {
  turnArtifactDir?: string | null;
  hintDir?: string | null;
  scopeId?: string | null;
}

export interface ResolveLegacyPathModeInput {
  /** Explicit meta from turn acceptance / deliverable meta */
  meta?: TurnPathMetaLike | null;
  /** Whether this turn has persisted deliverable meta in JSONL */
  hasPersistedMeta?: boolean;
  /** Turn artifact dir inferred from message content */
  turnArtifactDir?: string | null;
  /** Scope id for new turn-scoped artifact dirs */
  scopeId?: string | null;
}

/** New turns use STDA `artifacts/task-{date}-{id8}/` or legacy `artifacts/...-{scopeId}/`. */
export function isScopeIdArtifactDir(dir: string | null | undefined): boolean {
  if (!dir || typeof dir !== 'string') return false;
  const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized.includes('artifacts/')) return false;
  const base = normalized.split('/').pop() ?? '';
  if (/^task-\d{8}-[a-f0-9]{8}(-\d+)?$/i.test(base)) return true;
  return /-([a-f0-9]{6,12})$/i.test(base);
}

/**
 * Resolve path mode for a turn:
 * - legacy: historical turns with meta or without scopeId dirs — preserve exact paths
 * - strict: new turns with scopeId artifact dirs — no mtime guessing on hintDir
 */
export function resolveLegacyPathMode(input: ResolveLegacyPathModeInput): LegacyPathMode {
  const meta = input.meta ?? {};
  const turnDir = meta.turnArtifactDir ?? meta.hintDir ?? input.turnArtifactDir ?? null;
  const scopeId = meta.scopeId ?? input.scopeId ?? null;

  if (input.hasPersistedMeta) return 'legacy';
  if (scopeId && isScopeIdArtifactDir(turnDir)) return 'strict';
  if (isScopeIdArtifactDir(turnDir)) return 'strict';
  return 'legacy';
}

/** Prefer meta-stored paths over heuristic resolution for legacy turns. */
export function shouldPreferMetaPath(mode: LegacyPathMode): boolean {
  return mode === 'legacy';
}

/** Whether hintDir multi-match should return ambiguous instead of mtime pick. */
export function shouldRejectHintDirMtimeGuess(mode: LegacyPathMode): boolean {
  return mode === 'strict';
}
