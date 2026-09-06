import type { DeliverableItem } from './collectDeliverables';
import {
  getArtifactDirectory,
  getArtifactFileName,
  getDeliverableGroupKey,
  normalizeArtifactPath,
} from './artifactPaths';

export interface DeliverableFileNode {
  type: 'file';
  id: string;
  item: DeliverableItem;
}

export interface DeliverableFolderNode {
  type: 'folder';
  id: string;
  /** Project-relative directory used for preview/reveal/list APIs. */
  folderPath: string;
  folderName: string;
  items: DeliverableItem[];
  cover: DeliverableItem;
}

export type DeliverableNode = DeliverableFileNode | DeliverableFolderNode;

/** Pick the most representative file to use as a folder cover thumbnail. */
export function pickCoverItem(items: DeliverableItem[]): DeliverableItem {
  const byKind = (predicate: (item: DeliverableItem) => boolean) => items.find(predicate);

  const indexHtml = byKind(
    (item) => item.kind === 'html' && /(^|\/)index\.html?$/i.test(normalizeArtifactPath(item.path)),
  );
  if (indexHtml) return indexHtml;

  const image = byKind((item) => item.kind === 'image');
  if (image) return image;

  const html = byKind((item) => item.kind === 'html');
  if (html) return html;

  const video = byKind((item) => item.kind === 'video');
  if (video) return video;

  return items[0];
}

/**
 * Fold deliverables that live in the same folder into a single folder node.
 * URLs and root-level files are never grouped. The relative order of the first
 * occurrence of each group is preserved.
 */
export function groupDeliverablesByFolder(items: DeliverableItem[]): DeliverableNode[] {
  const order: string[] = [];
  const groups = new Map<string, DeliverableItem[]>();

  for (const item of items) {
    const groupable = item.kind !== 'url' && Boolean(getDeliverableGroupKey(item.apiPath || item.path));
    const key = groupable ? `dir:${getDeliverableGroupKey(item.apiPath || item.path).toLowerCase()}` : `file:${item.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  const nodes: DeliverableNode[] = [];
  for (const key of order) {
    const groupItems = groups.get(key)!;
    if (key.startsWith('dir:') && groupItems.length >= 2) {
      const cover = pickCoverItem(groupItems);
      const folderPath = getArtifactDirectory(cover.apiPath || cover.path) || getArtifactDirectory(groupItems[0].apiPath || groupItems[0].path);
      nodes.push({
        type: 'folder',
        id: `folder:${folderPath.toLowerCase()}`,
        folderPath,
        folderName: getArtifactFileName(folderPath) || folderPath,
        items: groupItems,
        cover,
      });
    } else {
      for (const item of groupItems) {
        nodes.push({ type: 'file', id: `file:${item.id}`, item });
      }
    }
  }

  return nodes;
}

/** Flatten nodes back to the file-level items, used for cross-item navigation. */
export function flattenNodeItems(nodes: DeliverableNode[]): DeliverableItem[] {
  const out: DeliverableItem[] = [];
  for (const node of nodes) {
    if (node.type === 'file') out.push(node.item);
  }
  return out;
}
