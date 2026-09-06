// PD-SAAS-FORK: resolve deliverable paths to file-tree node paths for task-folder navigation
import type { FileTreeNode } from '../components/file-tree/types/types';
import { normalizeHintDir } from '../../shared/deliverablePathResolve.mjs';

export function normalizeTreePath(path: string): string {
  return String(path || '').replace(/\\/g, '/').trim().replace(/^\/+/, '');
}

export type FileTreeMatch = {
  /** Raw `node.path` exactly as the tree API returned it (may be absolute, backslashes). */
  path: string;
  /** Raw `node.path` of every ancestor directory, outermost first. */
  ancestorPaths: string[];
};

type Candidate = FileTreeMatch & {
  normalized: string;
  rank: number;
};

/**
 * Find the tree node matching a deliverable path. The tree API returns raw
 * filesystem paths (absolute, backslashes on Windows) while deliverable paths
 * are usually project-relative with forward slashes — so matching is done on
 * normalized forms, but the returned paths are the RAW node paths so callers
 * can drive `expanded` / `activePath` state that compares against `node.path`.
 */
export function findFileTreeNode(
  nodes: FileTreeNode[],
  targetPath: string,
  hintDir?: string,
): FileTreeMatch | null {
  const target = normalizeTreePath(targetPath).toLowerCase();
  if (!target) return null;
  const targetHasSlash = target.includes('/');
  const targetBase = target.split('/').pop() || target;
  const hintNorm = hintDir ? normalizeHintDir(hintDir).toLowerCase() : '';

  const candidates: Candidate[] = [];

  const walk = (list: FileTreeNode[], ancestors: string[]): void => {
    for (const node of list) {
      const normalized = normalizeTreePath(node.path).toLowerCase();
      let rank = -1;
      if (normalized === target || normalized.endsWith(`/${target}`)) {
        rank = 0;
      } else if (!targetHasSlash && node.type !== 'directory') {
        const base = normalized.split('/').pop() || '';
        if (base === targetBase) rank = 1;
      }
      if (rank >= 0) {
        candidates.push({
          path: node.path,
          ancestorPaths: [...ancestors],
          normalized,
          rank,
        });
      }
      if (node.type === 'directory' && node.children?.length) {
        walk(node.children, [...ancestors, node.path]);
      }
    }
  };

  walk(nodes, []);
  if (candidates.length === 0) return null;

  const rank0 = candidates.filter((c) => c.rank === 0);
  if (rank0.length > 0) {
    let pool = rank0;
    if (hintNorm) {
      const inHint = pool.filter((c) => c.normalized.includes(hintNorm));
      if (inHint.length === 1) {
        return { path: inHint[0].path, ancestorPaths: inHint[0].ancestorPaths };
      }
      if (inHint.length > 0) {
        pool = inHint;
      }
    }
    if (!targetHasSlash && pool.length > 1 && !hintNorm) {
      return null;
    }
    pool.sort((a, b) => {
      const aArtifacts = a.normalized.includes('artifacts/') ? 0 : 1;
      const bArtifacts = b.normalized.includes('artifacts/') ? 0 : 1;
      if (aArtifacts !== bArtifacts) return aArtifacts - bArtifacts;
      if (a.normalized.length !== b.normalized.length) {
        return a.normalized.length - b.normalized.length;
      }
      return a.normalized.localeCompare(b.normalized);
    });
    return { path: pool[0].path, ancestorPaths: pool[0].ancestorPaths };
  }

  if (targetHasSlash) {
    return null;
  }

  let rank1 = candidates.filter((c) => c.rank === 1);
  if (hintNorm) {
    const inHint = rank1.filter((c) => c.normalized.includes(hintNorm));
    if (inHint.length === 1) {
      return { path: inHint[0].path, ancestorPaths: inHint[0].ancestorPaths };
    }
    if (inHint.length > 1) {
      rank1 = inHint;
    }
  }

  if (rank1.length !== 1) {
    return null;
  }

  return { path: rank1[0].path, ancestorPaths: rank1[0].ancestorPaths };
}

/** Find a directory node whose normalized path matches the task folder (scoped tree root). */
export function findFileTreeDirectoryNode(
  nodes: FileTreeNode[],
  folderPath: string,
  hintDir?: string,
): FileTreeNode | null {
  return findFileTreeDirectoryMatch(nodes, folderPath, hintDir)?.node ?? null;
}

export function findFileTreeDirectoryMatch(
  nodes: FileTreeNode[],
  folderPath: string,
  hintDir?: string,
): { node: FileTreeNode; ancestorPaths: string[] } | null {
  const target = normalizeTreePath(folderPath).toLowerCase().replace(/\/+$/, '');
  if (!target) return null;
  const hintNorm = hintDir ? normalizeHintDir(hintDir).toLowerCase() : '';

  type DirCandidate = {
    node: FileTreeNode;
    ancestorPaths: string[];
    normalized: string;
    score: number;
  };

  const candidates: DirCandidate[] = [];

  const walk = (list: FileTreeNode[], ancestors: string[]): void => {
    for (const node of list) {
      if (node.type !== 'directory') continue;
      const normalized = normalizeTreePath(node.path).toLowerCase();
      const matches = normalized === target || normalized.endsWith(`/${target}`);
      if (matches) {
        if (!hintNorm || normalized.includes(hintNorm)) {
          candidates.push({
            node,
            ancestorPaths: [...ancestors],
            normalized,
            score: normalized.length,
          });
        }
      }
      if (node.children?.length) {
        walk(node.children, [...ancestors, node.path]);
      }
    }
  };

  walk(nodes, []);
  if (candidates.length === 0) return null;

  let pool = candidates;
  if (hintNorm) {
    const inHint = pool.filter((c) => c.normalized.includes(hintNorm));
    if (inHint.length > 0) pool = inHint;
  }

  pool.sort((a, b) => {
    const aArtifacts = a.normalized.includes('artifacts/') ? 0 : 1;
    const bArtifacts = b.normalized.includes('artifacts/') ? 0 : 1;
    if (aArtifacts !== bArtifacts) return aArtifacts - bArtifacts;
    return a.score - b.score;
  });

  const best = pool[0];
  return { node: best.node, ancestorPaths: best.ancestorPaths };
}

/** @deprecated Use findFileTreeNode — this loses the raw node paths. */
export function findFileTreeNodePath(nodes: FileTreeNode[], targetPath: string, hintDir?: string): string | null {
  return findFileTreeNode(nodes, targetPath, hintDir)?.path ?? null;
}

/**
 * String-prefix ancestors of a normalized path. Only valid when tree node
 * paths are project-relative; prefer `findFileTreeNode().ancestorPaths`.
 */
export function ancestorFolderPaths(filePath: string): string[] {
  const normalized = normalizeTreePath(filePath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return [];
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join('/'));
  }
  return ancestors;
}
