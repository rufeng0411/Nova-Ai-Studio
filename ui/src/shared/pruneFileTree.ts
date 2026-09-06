// PD-SAAS-FORK: optimistic file-tree mutations after delete/rename.
import type { FileTreeNode } from '../components/file-tree/types/types';

function normalizeTreePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function isPathRemoved(nodePath: string, removedPaths: string[]): boolean {
  const normalized = normalizeTreePath(nodePath);
  return removedPaths.some((target) => {
    const normalizedTarget = normalizeTreePath(target);
    return normalized === normalizedTarget || normalized.startsWith(`${normalizedTarget}/`);
  });
}

export function pruneFileTreeNodes(nodes: FileTreeNode[], removedPaths: string[]): FileTreeNode[] {
  if (removedPaths.length === 0) return nodes;

  const walk = (list: FileTreeNode[]): FileTreeNode[] => {
    const next: FileTreeNode[] = [];
    for (const node of list) {
      if (isPathRemoved(node.path, removedPaths)) continue;
      if (node.type === 'directory' && node.children?.length) {
        next.push({ ...node, children: walk(node.children) });
      } else {
        next.push(node);
      }
    }
    return next;
  };

  return walk(nodes);
}
