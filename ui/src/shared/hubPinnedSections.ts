// PD-SAAS-FORK: 能力/模板分组内「必留 + 同名代表 + 更多展开」切分

import { compareHubRepresentative, normalizeHubDisplayName } from './hubCapabilityPresentation.js';

export type HubPinnedIdentifiable = {
  slug?: string;
  id?: string;
  hub_pinned?: boolean;
  hub_recommend_stars?: number;
  hub_sort?: number;
};

export function isHubPinnedEntry(item: HubPinnedIdentifiable): boolean {
  return item.hub_pinned === true;
}

export type HubSectionSplit<T extends HubPinnedIdentifiable> = {
  pinned: T[];
  secondary: T[];
  /** 本节启用折叠（存在必留项且有待展开项） */
  collapseActive: boolean;
};

export type SplitHubSectionOptions<T extends HubPinnedIdentifiable> = {
  bypassCollapse?: boolean;
  /** 缺省用 slug；传入中文名后启用「同名只留代表」 */
  getDisplayName?: (item: T) => string;
};

function itemKey(item: HubPinnedIdentifiable): string {
  return String(item.slug || item.id || '');
}

/**
 * 将分组内能力切为「默认展示」与「更多展开」。
 * - bypassCollapse：搜索/管理模式下展示全部
 * - 有 hub_pinned：必留在默认区，其余进更多（保留原语义）
 * - 无 hub_pinned：同名簇只留最具代表性一项在默认区，其余进更多；无同名则全部展示
 */
export function splitHubSectionItems<T extends HubPinnedIdentifiable>(
  items: T[],
  options: SplitHubSectionOptions<T> = {},
): HubSectionSplit<T> {
  if (options.bypassCollapse || items.length === 0) {
    return { pinned: items, secondary: [], collapseActive: false };
  }

  const pinnedEntries = items.filter(isHubPinnedEntry);
  const getName = options.getDisplayName;

  // —— 有必留：必留默认展示；非必留进更多（同名时保证代表优先为必留） ——
  if (pinnedEntries.length > 0) {
    const pinnedKeys = new Set(pinnedEntries.map(itemKey).filter(Boolean));
    const secondary = items.filter((item) => {
      const key = itemKey(item);
      return key ? !pinnedKeys.has(key) : true;
    });
    return {
      pinned: pinnedEntries,
      secondary,
      collapseActive: secondary.length > 0,
    };
  }

  // —— 无必留：同名归并 ——
  if (!getName) {
    return { pinned: items, secondary: [], collapseActive: false };
  }

  const clusters = new Map<string, T[]>();
  const orderKeys: string[] = [];
  for (const item of items) {
    const raw = getName(item) || itemKey(item);
    const key = normalizeHubDisplayName(raw) || `slug:${itemKey(item)}`;
    if (!clusters.has(key)) {
      clusters.set(key, []);
      orderKeys.push(key);
    }
    clusters.get(key)!.push(item);
  }

  const primary: T[] = [];
  const secondary: T[] = [];
  const primaryKeys = new Set<string>();

  for (const key of orderKeys) {
    const cluster = clusters.get(key) || [];
    if (cluster.length === 1) {
      primary.push(cluster[0]!);
      primaryKeys.add(itemKey(cluster[0]!));
      continue;
    }
    const ranked = [...cluster].sort(compareHubRepresentative);
    const rep = ranked[0]!;
    primary.push(rep);
    primaryKeys.add(itemKey(rep));
    for (const extra of ranked.slice(1)) {
      secondary.push(extra);
    }
  }

  // 保持传入顺序：primary 按原 items 相对序
  const primaryOrdered = items.filter((item) => primaryKeys.has(itemKey(item)));
  const secondaryOrdered = items.filter((item) => {
    const key = itemKey(item);
    return key ? !primaryKeys.has(key) : false;
  });

  return {
    pinned: primaryOrdered,
    secondary: secondaryOrdered,
    collapseActive: secondaryOrdered.length > 0,
  };
}
