/**
 * PD-SAAS-FORK: 后台技能树 — 与能力中心 taxonomy 一致的分支/叶子结构
 */
import {
  EDUCATION_BAND_ORDER,
  GEO_FLYWHEEL_ORDER,
  MARKETING_FLYWHEEL_ORDER,
  type HubMajorCategory,
} from '../../shared/capabilityHubTheme.js';
import {
  HUB_MAJOR_CATEGORY_ORDER,
  capabilityMatchesFlywheelStage,
  capabilityMatchesFlywheelTaskGroup,
  getFlywheelTaskGroups,
  getMajorCategoriesMeta,
  getMajorCategorySubtags,
  matchesMajorCategory,
} from '../../shared/capabilityHubTaxonomy.js';

export type AdminCapabilityRecord = {
  slug: string;
  name: string;
  display_name?: string;
  task_summary?: string;
  description?: string;
  stage: string;
  stage_label?: string;
  task_group?: string;
  major_category?: string;
  geo_stage?: string;
  category_subtag?: string;
  education_bands?: string[];
  secondary_stages?: string[];
  secondary_task_groups?: string[];
  secondary_categories?: string[];
  hidden_in_hub?: boolean;
  status?: string;
  scope?: string;
  source?: string;
};

export type AdminSkillLeaf = {
  kind: 'skill';
  id: string;
  slug: string;
  label: string;
  status: string;
  hiddenInHub: boolean;
  scope?: string;
  source?: string;
  description?: string;
  name: string;
};

export type AdminSkillBranch = {
  kind: 'branch';
  id: string;
  label: string;
  children: AdminSkillTreeNode[];
};

export type AdminSkillTreeNode = AdminSkillBranch | AdminSkillLeaf;

export type AdminSkillsTreeLabels = {
  major: Record<HubMajorCategory, string>;
  uncategorized: string;
  general: string;
  stageLabels: Record<string, string>;
  taskGroupLabels: Record<string, string>;
  subtagLabels: Record<string, string>;
  bandLabels: Record<string, string>;
};

type BuildOptions = {
  capabilities: AdminCapabilityRecord[];
  labels: AdminSkillsTreeLabels;
  flywheelTaskGroups?: Record<string, Array<{ id: string; label: string; group_order?: number }>>;
};

function skillLabel(item: AdminCapabilityRecord): string {
  return (item.display_name || item.task_summary || item.name || item.slug).trim();
}

function toLeaf(item: AdminCapabilityRecord): AdminSkillLeaf {
  return {
    kind: 'skill',
    id: `skill:${item.slug}`,
    slug: item.slug,
    label: skillLabel(item),
    status: item.status || 'available',
    hiddenInHub: Boolean(item.hidden_in_hub),
    scope: item.scope,
    source: item.source,
    description: item.description || item.task_summary,
    name: item.name,
  };
}

function pruneBranch(branch: AdminSkillBranch): AdminSkillBranch | null {
  const children = branch.children
    .map((child) => (child.kind === 'branch' ? pruneBranch(child) : child))
    .filter((child): child is AdminSkillTreeNode => child !== null);
  if (children.length === 0) return null;
  return { ...branch, children };
}

function sortLeaves(nodes: AdminSkillTreeNode[]): AdminSkillTreeNode[] {
  return [...nodes].sort((a, b) => {
    const la = a.kind === 'skill' ? a.label : a.label;
    const lb = b.kind === 'skill' ? b.label : b.label;
    return la.localeCompare(lb, 'zh-CN');
  });
}

function buildMarketingBranch(
  capabilities: AdminCapabilityRecord[],
  labels: AdminSkillsTreeLabels,
  flywheelTaskGroups: BuildOptions['flywheelTaskGroups'],
): AdminSkillBranch | null {
  const marketingCaps = capabilities.filter((item) => matchesMajorCategory('marketing', item));
  if (marketingCaps.length === 0) return null;

  const stageChildren: AdminSkillTreeNode[] = [];

  for (const stageId of MARKETING_FLYWHEEL_ORDER) {
    const stageCaps = marketingCaps.filter((item) => capabilityMatchesFlywheelStage(item, stageId));
    if (stageCaps.length === 0) continue;

    const taskGroupsFromApi = flywheelTaskGroups?.[stageId];
    const taskGroups =
      Array.isArray(taskGroupsFromApi) && taskGroupsFromApi.length > 0
        ? [...taskGroupsFromApi].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99))
        : getFlywheelTaskGroups(stageId);

    const tgChildren: AdminSkillTreeNode[] = [];

    if (taskGroups.length === 0) {
      tgChildren.push(...sortLeaves(stageCaps.map(toLeaf)));
    } else {
      const placed = new Set<string>();
      for (const tg of taskGroups) {
        const tgCaps = stageCaps.filter(
          (item) => capabilityMatchesFlywheelTaskGroup(item, stageId, tg.id) && !placed.has(item.slug),
        );
        tgCaps.forEach((item) => placed.add(item.slug));
        if (tgCaps.length === 0) continue;
        tgChildren.push({
          kind: 'branch',
          id: `marketing:${stageId}:${tg.id}`,
          label: labels.taskGroupLabels[tg.id] || tg.label || tg.id,
          children: sortLeaves(tgCaps.map(toLeaf)),
        });
      }
      const rest = stageCaps.filter((item) => !placed.has(item.slug));
      if (rest.length > 0) {
        tgChildren.push({
          kind: 'branch',
          id: `marketing:${stageId}:general`,
          label: labels.general,
          children: sortLeaves(rest.map(toLeaf)),
        });
      }
    }

    if (tgChildren.length === 0) continue;

    stageChildren.push({
      kind: 'branch',
      id: `marketing:${stageId}`,
      label: labels.stageLabels[stageId] || stageId,
      children: tgChildren,
    });
  }

  if (stageChildren.length === 0) return null;

  return {
    kind: 'branch',
    id: 'marketing',
    label: labels.major.marketing,
    children: stageChildren,
  };
}

function buildGeoBranch(
  capabilities: AdminCapabilityRecord[],
  labels: AdminSkillsTreeLabels,
): AdminSkillBranch | null {
  const geoCaps = capabilities.filter((item) => matchesMajorCategory('geo', item));
  if (geoCaps.length === 0) return null;

  const stageChildren: AdminSkillTreeNode[] = [];
  for (const stageId of GEO_FLYWHEEL_ORDER) {
    const stageCaps = geoCaps.filter((item) => item.geo_stage === stageId);
    if (stageCaps.length === 0) continue;
    stageChildren.push({
      kind: 'branch',
      id: `geo:${stageId}`,
      label: labels.stageLabels[stageId] || stageId,
      children: sortLeaves(stageCaps.map(toLeaf)),
    });
  }

  if (stageChildren.length === 0) return null;

  return {
    kind: 'branch',
    id: 'geo',
    label: labels.major.geo,
    children: stageChildren,
  };
}

function buildEducationBranch(capabilities: AdminCapabilityRecord[], labels: AdminSkillsTreeLabels): AdminSkillBranch | null {
  const eduCaps = capabilities.filter((item) => matchesMajorCategory('education', item));
  if (eduCaps.length === 0) return null;

  const bandChildren: AdminSkillTreeNode[] = [];
  const placed = new Set<string>();

  for (const bandId of EDUCATION_BAND_ORDER) {
    const bandCaps = eduCaps.filter((item) => {
      if (placed.has(item.slug)) return false;
      const bands = item.education_bands || [];
      if (bands.length === 0) return bandId === 'general';
      return bands.includes(bandId);
    });
    bandCaps.forEach((item) => placed.add(item.slug));
    if (bandCaps.length === 0) continue;
    bandChildren.push({
      kind: 'branch',
      id: `education:${bandId}`,
      label: labels.bandLabels[bandId] || bandId,
      children: sortLeaves(bandCaps.map(toLeaf)),
    });
  }

  const rest = eduCaps.filter((item) => !placed.has(item.slug));
  if (rest.length > 0) {
    bandChildren.push({
      kind: 'branch',
      id: 'education:general',
      label: labels.general,
      children: sortLeaves(rest.map(toLeaf)),
    });
  }

  if (bandChildren.length === 0) return null;

  return {
    kind: 'branch',
    id: 'education',
    label: labels.major.education,
    children: bandChildren,
  };
}

function buildSubtagMajorBranch(
  major: 'office' | 'creation' | 'development' | 'brainstorming',
  capabilities: AdminCapabilityRecord[],
  labels: AdminSkillsTreeLabels,
): AdminSkillBranch | null {
  const majorCaps = capabilities.filter((item) => matchesMajorCategory(major, item));
  if (majorCaps.length === 0) return null;

  const subtags = getMajorCategorySubtags(major);
  const subtagChildren: AdminSkillTreeNode[] = [];
  const placed = new Set<string>();

  for (const subtag of [...subtags].sort((a, b) => (a.subtag_order ?? 99) - (b.subtag_order ?? 99))) {
    const subCaps = majorCaps.filter((item) => {
      if (placed.has(item.slug)) return false;
      const sid = item.category_subtag || 'general';
      return sid === subtag.id;
    });
    subCaps.forEach((item) => placed.add(item.slug));
    if (subCaps.length === 0) continue;
    subtagChildren.push({
      kind: 'branch',
      id: `${major}:${subtag.id}`,
      label: labels.subtagLabels[subtag.id] || subtag.label || subtag.id,
      children: sortLeaves(subCaps.map(toLeaf)),
    });
  }

  const rest = majorCaps.filter((item) => !placed.has(item.slug));
  if (rest.length > 0) {
    subtagChildren.push({
      kind: 'branch',
      id: `${major}:general`,
      label: labels.general,
      children: sortLeaves(rest.map(toLeaf)),
    });
  }

  if (subtagChildren.length === 0) return null;

  return {
    kind: 'branch',
    id: major,
    label: labels.major[major],
    children: subtagChildren,
  };
}

function collectPlacedSlugs(nodes: AdminSkillTreeNode[]): Set<string> {
  const slugs = new Set<string>();
  const walk = (list: AdminSkillTreeNode[]) => {
    for (const node of list) {
      if (node.kind === 'skill') slugs.add(node.slug);
      else walk(node.children);
    }
  };
  walk(nodes);
  return slugs;
}

export function buildAdminSkillsTree(options: BuildOptions): AdminSkillTreeNode[] {
  const { capabilities, labels, flywheelTaskGroups } = options;
  const roots: AdminSkillTreeNode[] = [];

  for (const major of HUB_MAJOR_CATEGORY_ORDER) {
    let branch: AdminSkillBranch | null = null;
    switch (major) {
      case 'marketing':
        branch = buildMarketingBranch(capabilities, labels, flywheelTaskGroups);
        break;
      case 'geo':
        branch = buildGeoBranch(capabilities, labels);
        break;
      case 'office':
      case 'creation':
      case 'development':
      case 'brainstorming':
      case 'finance':
        branch = buildSubtagMajorBranch(major, capabilities, labels);
        break;
      case 'education':
        branch = buildEducationBranch(capabilities, labels);
        break;
      default: {
        const _exhaustive: never = major;
        void _exhaustive;
      }
    }
    if (branch) roots.push(branch);
  }

  const placed = collectPlacedSlugs(roots);
  const uncategorized = capabilities.filter(
    (item) => item.stage === 'uncategorized' || !placed.has(item.slug),
  );
  const uniqueUncategorized = uncategorized.filter(
    (item, index, list) => list.findIndex((x) => x.slug === item.slug) === index,
  );
  if (uniqueUncategorized.length > 0) {
    roots.push({
      kind: 'branch',
      id: 'uncategorized',
      label: labels.uncategorized,
      children: sortLeaves(uniqueUncategorized.map(toLeaf)),
    });
  }

  return roots
    .map((node) => (node.kind === 'branch' ? pruneBranch(node) : node))
    .filter((node): node is AdminSkillTreeNode => node !== null);
}

export function findSkillAncestors(nodes: AdminSkillTreeNode[], slug: string): string[] {
  const path: string[] = [];
  const walk = (list: AdminSkillTreeNode[], trail: string[]): boolean => {
    for (const node of list) {
      if (node.kind === 'skill') {
        if (node.slug === slug) {
          path.push(...trail);
          return true;
        }
        continue;
      }
      if (walk(node.children, [...trail, node.id])) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}

export function filterAdminSkillsTree(
  nodes: AdminSkillTreeNode[],
  query: string,
): AdminSkillTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const filterNode = (node: AdminSkillTreeNode): AdminSkillTreeNode | null => {
    if (node.kind === 'skill') {
      const hay = `${node.slug} ${node.label}`.toLowerCase();
      return hay.includes(q) ? node : null;
    }
    const children = node.children
      .map(filterNode)
      .filter((child): child is AdminSkillTreeNode => child !== null);
    if (children.length === 0) return null;
    return { ...node, children };
  };

  return nodes.map(filterNode).filter((node): node is AdminSkillTreeNode => node !== null);
}

export function defaultMajorLabels(): AdminSkillsTreeLabels['major'] {
  const meta = getMajorCategoriesMeta();
  return {
    marketing: '营销',
    media: meta.media?.label || '媒体',
    geo: meta.geo?.label || 'GEO',
    finance: meta.finance?.label || '金融',
    office: meta.office?.label || '办公',
    creation: meta.creation?.label || '创作',
    development: meta.development?.label || '开发',
    brainstorming: meta.brainstorming?.label || '脑暴',
    education: '教育',
  };
}

export { HUB_MAJOR_CATEGORY_ORDER };
