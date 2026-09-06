/**
 * PD-SAAS-FORK: 后台 Hub 可见性树（能力 + 全案模板）
 */
import type { ProcessTemplate } from '../../shared/processTemplates.js';
import {
  buildAdminSkillsTree,
  defaultMajorLabels,
  type AdminSkillTreeNode,
} from './buildAdminSkillsTree.js';
import type { AdminCapabilityRecord } from './buildAdminSkillsTree.js';
import { HUB_MAJOR_CATEGORY_ORDER } from '../../shared/capabilityHubTaxonomy.js';

export type HubVisibilityTreeNode = {
  kind: 'branch' | 'leaf';
  id: string;
  label: string;
  nodeType: 'category' | 'subcategory' | 'capability' | 'templateGroup' | 'template';
  slug?: string;
  templateId?: string;
  children?: HubVisibilityTreeNode[];
};

function mapSkillTree(nodes: AdminSkillTreeNode[]): HubVisibilityTreeNode[] {
  return nodes.map((node) => {
    if (node.kind === 'skill') {
      return {
        kind: 'leaf',
        id: `capability:${node.slug}`,
        label: node.label,
        nodeType: 'capability',
        slug: node.slug,
      };
    }
    const nodeType = node.id.includes(':') ? 'subcategory' : 'category';
    return {
      kind: 'branch',
      id: node.id,
      label: node.label,
      nodeType,
      children: mapSkillTree(node.children),
    };
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  marketing: '营销',
  enterprise: '企业',
  geo: 'GEO',
  office: '办公',
  creation: '创作',
};
const CATEGORY_ORDER = ['marketing', 'enterprise', 'geo', 'office', 'creation'];

export function buildHubVisibilityTree(options: {
  capabilities: AdminCapabilityRecord[];
  templates: ProcessTemplate[];
  flywheelTaskGroups?: Record<string, Array<{ id: string; label: string }>>;
}): HubVisibilityTreeNode[] {
  const labels = {
    major: defaultMajorLabels(),
    uncategorized: '待归类',
    general: '其他',
    stageLabels: {},
    taskGroupLabels: {},
    subtagLabels: {},
    bandLabels: {},
  };
  const skillRoots = buildAdminSkillsTree({
    capabilities: options.capabilities,
    labels,
    flywheelTaskGroups: options.flywheelTaskGroups,
  });

  const templateGroups = new Map<string, ProcessTemplate[]>();
  for (const template of options.templates) {
    const key = template.category || 'marketing';
    if (!templateGroups.has(key)) templateGroups.set(key, []);
    templateGroups.get(key)!.push(template);
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((id) => templateGroups.has(id)),
    ...[...templateGroups.keys()].filter((id) => !CATEGORY_ORDER.includes(id)),
  ];

  const templateBranch: HubVisibilityTreeNode = {
    kind: 'branch',
    id: 'templates',
    label: '全案模板',
    nodeType: 'category',
    children: orderedCategories.map((category) => {
      const items = templateGroups.get(category) || [];
      return {
        kind: 'branch' as const,
        id: `templates:${category}`,
        label: CATEGORY_LABELS[category] || category,
        nodeType: 'templateGroup' as const,
        children: items.map((template) => ({
          kind: 'leaf' as const,
          id: `template:${template.id}`,
          label: template.title,
          nodeType: 'template' as const,
          templateId: template.id,
        })),
      };
    }),
  };

  return [...mapSkillTree(skillRoots), templateBranch];
}

export function resolveVisibilityNodeKey(node: HubVisibilityTreeNode): string | null {
  if (node.nodeType === 'category' && node.id !== 'templates') return node.id;
  if (node.nodeType === 'subcategory') return node.id;
  if (node.nodeType === 'capability' && node.slug) return node.slug;
  if (node.nodeType === 'templateGroup') return node.id;
  if (node.nodeType === 'template' && node.templateId) return node.templateId;
  return null;
}

export function resolveVisibilitySection(node: HubVisibilityTreeNode):
  | 'categories'
  | 'subcategories'
  | 'capabilities'
  | 'templateGroups'
  | 'templates'
  | null {
  switch (node.nodeType) {
    case 'category':
      return node.id === 'templates' ? null : 'categories';
    case 'subcategory':
      return 'subcategories';
    case 'capability':
      return 'capabilities';
    case 'templateGroup':
      return 'templateGroups';
    case 'template':
      return 'templates';
    default:
      return null;
  }
}

export { HUB_MAJOR_CATEGORY_ORDER };
