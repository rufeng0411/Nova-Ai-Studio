/**
 * PD-SAAS-FORK (STDA): resolve primary task directory for UI four-line alignment.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import type { SessionTaskDirectoryUi } from './resolveContractScopeDir';
import { isTaskArtifactDirPath } from './taskArtifactDir';
import { collectDeliverablesFromMessages } from './collectDeliverables';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';

function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, '/').replace(/\/+$/, '');
}

function taskRootFromPath(path: string | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  const normalized = normalizeDir(path);
  const match = normalized.match(/^(artifacts\/task-\d{8}-[a-f0-9]{8}(?:-\d+)?)/i);
  return match?.[1]?.toLowerCase();
}

function countResolvedUnderRoot(manifest: SessionDeliverableManifestUi | undefined, root: string): number {
  if (!manifest?.slots?.length) return 0;
  const normalizedRoot = normalizeDir(root);
  let count = 0;
  for (const slot of manifest.slots) {
    if (slot.status === 'removed') continue;
    const path = slot.resolvedPath ?? slot.pathHint;
    if (!path) continue;
    const slotRoot = taskRootFromPath(path);
    if (slotRoot === normalizedRoot || path.startsWith(`${normalizedRoot}/`)) count += 1;
  }
  return count;
}

function readDirectoryFromMessage(message: ChatMessage): SessionTaskDirectoryUi | undefined {
  const payload = message.payload as Record<string, unknown> | undefined;
  const raw = payload?.sessionTaskDirectory ?? (message as Record<string, unknown>).sessionTaskDirectory;
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.taskArtifactDir !== 'string' || typeof record.taskDirKey !== 'string') return undefined;
  if (typeof record.goalVersion !== 'number') return undefined;
  return {
    taskArtifactDir: record.taskArtifactDir,
    taskDirKey: record.taskDirKey,
    goalVersion: record.goalVersion,
    allocatedAt: typeof record.allocatedAt === 'string' ? record.allocatedAt : undefined,
    displayLabel: typeof record.displayLabel === 'string' ? record.displayLabel : undefined,
  };
}

function directoryFromRoot(
  root: string,
  input: {
    manifest?: SessionDeliverableManifestUi;
    latestDirectory?: SessionTaskDirectoryUi | null;
  },
): SessionTaskDirectoryUi | undefined {
  const match = root.match(/^artifacts\/task-(\d{8}-[a-f0-9]{8}(?:-\d+)?)$/i);
  if (!match) return undefined;
  return {
    taskArtifactDir: normalizeDir(root),
    taskDirKey: match[1]!.toLowerCase(),
    goalVersion: input.manifest?.goalVersion ?? input.latestDirectory?.goalVersion ?? 1,
    allocatedAt: input.latestDirectory?.allocatedAt,
    displayLabel: input.latestDirectory?.displayLabel,
  };
}

function resolveWriteRootFromMessages(messages: ChatMessage[]): string | undefined {
  const writeItems = collectDeliverablesFromMessages(messages).filter((item) => item.source === 'tool');
  const writeDir = inferTurnArtifactDirectory(writeItems);
  if (!writeDir) return undefined;
  const root = taskRootFromPath(writeDir) ?? normalizeDir(writeDir);
  return root && isTaskArtifactDirPath(root) ? root : undefined;
}

export function resolvePrimarySessionTaskDirectory(input: {
  messages: ChatMessage[];
  manifest?: SessionDeliverableManifestUi;
  latestDirectory?: SessionTaskDirectoryUi | null;
}): SessionTaskDirectoryUi | undefined {
  const writeRoot = resolveWriteRootFromMessages(input.messages);
  if (writeRoot) {
    const manifestDir = normalizeDir(input.manifest?.taskArtifactDir ?? '');
    if (!manifestDir || manifestDir !== writeRoot) {
      const writesUnderRoot = collectDeliverablesFromMessages(input.messages).filter((item) => {
        if (item.source !== 'tool') return false;
        const path = (item.apiPath || item.path).replace(/\\/g, '/');
        return path.toLowerCase().startsWith(`${writeRoot.toLowerCase()}/`);
      }).length;
      if (writesUnderRoot > 0) {
        return directoryFromRoot(writeRoot, input) ?? input.latestDirectory ?? undefined;
      }
    }
  }

  const roots = new Set<string>();
  for (const slot of input.manifest?.slots ?? []) {
    if (slot.status === 'removed') continue;
    const path = slot.resolvedPath ?? slot.pathHint;
    const root = taskRootFromPath(path);
    if (root && isTaskArtifactDirPath(root)) roots.add(root);
  }
  if (input.manifest?.taskArtifactDir && isTaskArtifactDirPath(input.manifest.taskArtifactDir)) {
    roots.add(normalizeDir(input.manifest.taskArtifactDir));
  }

  if (roots.size > 0) {
    const scored = [...roots].map((root) => ({
      root,
      score: countResolvedUnderRoot(input.manifest, root),
    }));
    scored.sort((a, b) => b.score - a.score || a.root.localeCompare(b.root));
    const best = scored[0]!;
    if (best.score > 0) {
      const match = best.root.match(/^artifacts\/task-(\d{8}-[a-f0-9]{8}(?:-\d+)?)$/i);
      if (match) {
        return {
          taskArtifactDir: best.root,
          taskDirKey: match[1]!.toLowerCase(),
          goalVersion: input.manifest?.goalVersion ?? input.latestDirectory?.goalVersion ?? 1,
          allocatedAt: input.latestDirectory?.allocatedAt,
          displayLabel: input.latestDirectory?.displayLabel,
        };
      }
    }
  }

  for (let i = 0; i < input.messages.length; i += 1) {
    const fromPayload = readDirectoryFromMessage(input.messages[i]!);
    if (fromPayload) return fromPayload;
  }

  return input.latestDirectory ?? undefined;
}
