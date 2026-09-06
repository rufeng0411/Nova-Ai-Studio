/**
 * PD-SAAS-FORK (STDA): resolve contract scopeDir — STDA-first, legacy fallback.
 */
import type { ChatMessage } from '../components/chat/types/types';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';
import { isTaskArtifactDirPath } from './taskArtifactDir';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import { resolvePrimarySessionTaskDirectory } from './resolvePrimaryTaskArtifactDir';

export type SessionTaskDirectoryUi = {
  taskArtifactDir: string;
  taskDirKey: string;
  goalVersion: number;
  allocatedAt?: string;
  displayLabel?: string;
};

export type ResolveContractScopeDirInput = {
  messages: ChatMessage[];
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
  sessionManifest?: SessionDeliverableManifestUi;
  turnArtifactDir?: string | null;
  pathHints?: string[];
};

function normalizeDir(dir: string | null | undefined): string | null {
  if (!dir || typeof dir !== 'string') return null;
  return dir.replace(/\\/g, '/').replace(/\/+$/, '') || null;
}

function latestTurnAcceptanceScope(messages: ChatMessage[]): {
  turnArtifactDir?: string;
  scopeId?: string;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.type !== 'assistant') continue;
    const meta = extractTurnAcceptanceMeta(msg);
    if (meta?.turnArtifactDir || meta?.taskArtifactDir) {
      return {
        turnArtifactDir: meta.taskArtifactDir ?? meta.turnArtifactDir,
        scopeId: meta.scopeId,
      };
    }
  }
  return {};
}

function longestCommonPathPrefix(paths: string[]): string | null {
  const normalized = paths
    .map((p) => normalizeDir(p))
    .filter((p): p is string => Boolean(p));
  if (normalized.length === 0) return null;
  if (normalized.length === 1) {
    const single = normalized[0]!;
    const slash = single.lastIndexOf('/');
    return slash > 0 ? single.slice(0, slash) : single;
  }
  const split = normalized.map((p) => p.split('/'));
  const parts: string[] = [];
  for (let i = 0; i < split[0]!.length; i += 1) {
    const segment = split[0]![i];
    if (split.every((row) => row[i] === segment)) {
      parts.push(segment!);
    } else {
      break;
    }
  }
  return parts.join('/') || null;
}

/** STDA-first scope directory for UDC four-line alignment. */
export function resolveContractScopeDir(input: ResolveContractScopeDirInput): string | null {
  const primary = resolvePrimarySessionTaskDirectory({
    messages: input.messages,
    manifest: input.sessionManifest,
    latestDirectory: input.sessionTaskDirectory ?? undefined,
  });
  const primaryDir = normalizeDir(primary?.taskArtifactDir);
  if (primaryDir && isTaskArtifactDirPath(primaryDir)) return primaryDir;

  const stda = normalizeDir(input.sessionTaskDirectory?.taskArtifactDir);
  if (stda && isTaskArtifactDirPath(stda)) return stda;

  const acceptance = latestTurnAcceptanceScope(input.messages);
  const metaDir = normalizeDir(acceptance.turnArtifactDir ?? input.turnArtifactDir);
  if (metaDir && isTaskArtifactDirPath(metaDir)) return metaDir;
  if (metaDir) return metaDir;

  if (input.pathHints?.length) {
    const hintPrefix = longestCommonPathPrefix(input.pathHints);
    if (hintPrefix?.includes('artifacts/')) return hintPrefix;
  }

  return null;
}

export function resolveScopeIdForTurn(
  input: ResolveContractScopeDirInput,
): string | null {
  if (input.sessionTaskDirectory?.taskDirKey) {
    return input.sessionTaskDirectory.taskDirKey;
  }
  const acceptance = latestTurnAcceptanceScope(input.messages);
  if (acceptance.scopeId) return acceptance.scopeId;
  const scopeDir = resolveContractScopeDir(input);
  if (!scopeDir) return null;
  const match = scopeDir.match(/task-(\d{8}-[a-f0-9]{8}(?:-\d+)?)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}
