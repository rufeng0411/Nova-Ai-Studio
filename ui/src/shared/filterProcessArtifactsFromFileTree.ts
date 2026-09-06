// PD-SAAS-FORK: hide VAP bookkeeping paths from folder Tab (still on disk for bind/repair).
import type { FileTreeNode } from '../components/file-tree/types/types';
import { isVisualAssetInternalTreePath } from './nonDeliverablePaths';

function normalizeTreePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function shouldHideFileTreeNode(node: FileTreeNode): boolean {
  const path = normalizeTreePath(node.path);
  if (!path) return false;
  return isVisualAssetInternalTreePath(path);
}

/** Remove VAP internal assets (_capture/prepared/raw/manifest) from folder tree display. */
export function filterProcessArtifactsFromFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const walk = (list: FileTreeNode[]): FileTreeNode[] => {
    const next: FileTreeNode[] = [];
    for (const node of list) {
      if (shouldHideFileTreeNode(node)) continue;
      if (node.type === 'directory') {
        const children = node.children?.length ? walk(node.children) : [];
        if (children.length === 0 && /\/assets$/i.test(normalizeTreePath(node.path))) {
          continue;
        }
        next.push({ ...node, children });
      } else {
        next.push(node);
      }
    }
    return next;
  };
  return walk(nodes);
}
