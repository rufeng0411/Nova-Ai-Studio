/**
 * PD-SAAS-FORK: 后台技能管理 — 真·树形导航（分支展开 / 叶子即技能）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText, Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { cn } from '../../lib/utils.js';
import { localizeCapabilityFields } from '../../shared/capabilityLocale.js';
import type { Project } from '../../types/app';
import {
  buildAdminSkillsTree,
  filterAdminSkillsTree,
  findSkillAncestors,
  type AdminCapabilityRecord,
  type AdminSkillLeaf,
  type AdminSkillTreeNode,
} from './buildAdminSkillsTree.js';
import {
  mergeAdminBandLabels,
  mergeAdminStageLabels,
  mergeAdminSubtagLabels,
  mergeAdminTaskGroupLabels,
  resolveAdminMajorLabels,
} from './adminSkillsTreeLabels.js';
import { enrichAdminCapabilities } from './enrichAdminCapabilities.js';

type AdminSkillsTreeProps = {
  selectedProject: Project | null;
  selectedSlug: string | null;
  onSelectSkill: (leaf: AdminSkillLeaf) => void;
};

function collectAllBranchIds(nodes: AdminSkillTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: AdminSkillTreeNode[]) => {
    for (const node of list) {
      if (node.kind !== 'branch') continue;
      ids.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

function TreeBranch({
  node,
  depth,
  expanded,
  onToggle,
  selectedSlug,
  onSelectSkill,
}: {
  node: Extract<AdminSkillTreeNode, { kind: 'branch' }>;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedSlug: string | null;
  onSelectSkill: (leaf: AdminSkillLeaf) => void;
}) {
  const isOpen = expanded.has(node.id);
  const leafCount = useMemo(() => {
    let count = 0;
    const walk = (list: AdminSkillTreeNode[]) => {
      for (const child of list) {
        if (child.kind === 'skill') count += 1;
        else walk(child.children);
      }
    };
    walk(node.children);
    return count;
  }, [node.children]);

  return (
    <div className="saas-admin-skills-tree-branch">
      <button
        type="button"
        className="saas-admin-skills-tree-row saas-admin-skills-tree-row--branch"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onToggle(node.id)}
        aria-expanded={isOpen}
      >
        <ChevronRight
          className={cn('saas-admin-skills-tree-chevron', isOpen && 'saas-admin-skills-tree-chevron--open')}
          strokeWidth={2}
        />
        <span className="saas-admin-skills-tree-label">
          {node.label}
          <span className="saas-admin-skills-tree-count"> ({leafCount})</span>
        </span>
      </button>
      {isOpen ? (
        <div className="saas-admin-skills-tree-children">
          {node.children.map((child) =>
            child.kind === 'branch' ? (
              <TreeBranch
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedSlug={selectedSlug}
                onSelectSkill={onSelectSkill}
              />
            ) : (
              <TreeLeaf
                key={child.id}
                node={child}
                depth={depth + 1}
                selected={selectedSlug === child.slug}
                onSelect={() => onSelectSkill(child)}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function TreeLeaf({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: AdminSkillLeaf;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('saas-admin-skills-tree-row saas-admin-skills-tree-row--leaf', selected && 'is-selected')}
      style={{ paddingLeft: `${22 + depth * 14}px` }}
      onClick={onSelect}
      title={node.slug}
    >
      <FileText className="saas-admin-skills-tree-leaf-icon" strokeWidth={1.75} />
      <span className="saas-admin-skills-tree-label">{node.label}</span>
      {node.hiddenInHub ? <span className="saas-admin-skills-tree-tag">隐藏</span> : null}
      {node.status === 'needs_config' ? <span className="saas-admin-skills-tree-tag muted">需配置</span> : null}
    </button>
  );
}

export default function AdminSkillsTree({
  selectedProject,
  selectedSlug,
  onSelectSkill,
}: AdminSkillsTreeProps) {
  const { t, i18n } = useTranslation('capabilities');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<AdminCapabilityRecord[]>([]);
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
  const [taskGroupLabels, setTaskGroupLabels] = useState<Record<string, string>>({});
  const [subtagLabels, setSubtagLabels] = useState<Record<string, string>>({});
  const [bandLabels, setBandLabels] = useState<Record<string, string>>({});
  const [majorCategories, setMajorCategories] = useState<
    Record<string, { label?: string; subtags?: Array<{ id: string; label: string }> }>
  >({});
  const [flywheelTaskGroups, setFlywheelTaskGroups] = useState<
    Record<string, Array<{ id: string; label: string; group_order?: number }>>
  >({});
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const projectPath = selectedProject?.fullPath || selectedProject?.path || undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.capabilities({
        projectPath,
        locale: i18n.language,
        admin: true,
      });
      if (!response.ok) throw new Error('load_failed');
      const data = await response.json();
      const list = Array.isArray(data?.capabilities) ? data.capabilities : [];
      setCapabilities(
        list.map((item: AdminCapabilityRecord) => localizeCapabilityFields(item, i18n.language)),
      );

      const stages = Array.isArray(data?.stages) ? data.stages : [];
      const geoFlywheelStages = Array.isArray(data?.geo_flywheel_stages) ? data.geo_flywheel_stages : [];
      setStageLabels(
        mergeAdminStageLabels({
          marketingStages: stages,
          geoFlywheelStages,
          locale: i18n.language,
          t,
        }),
      );

      const tgMap = data?.flywheel_task_groups;
      if (tgMap && typeof tgMap === 'object') {
        setFlywheelTaskGroups(tgMap as typeof flywheelTaskGroups);
      } else {
        setFlywheelTaskGroups({});
      }
      setTaskGroupLabels(mergeAdminTaskGroupLabels(tgMap as typeof flywheelTaskGroups));

      const majorMeta = data?.major_categories;
      if (majorMeta && typeof majorMeta === 'object') {
        setMajorCategories(
          majorMeta as Record<string, { label?: string; subtags?: Array<{ id: string; label: string }> }>,
        );
        setSubtagLabels(mergeAdminSubtagLabels(
          majorMeta as Record<string, { subtags?: Array<{ id: string; label: string }> }>,
        ));
      } else {
        setMajorCategories({});
        setSubtagLabels({});
      }

      const bands = Array.isArray(data?.education_bands) ? data.education_bands : [];
      setBandLabels(mergeAdminBandLabels(bands, i18n.language));
    } catch {
      setError(t('empty.loadFailed'));
      setCapabilities([]);
    } finally {
      setLoading(false);
    }
  }, [projectPath, i18n.language, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => {
    const enriched = enrichAdminCapabilities(capabilities);
    return buildAdminSkillsTree({
      capabilities: enriched,
      flywheelTaskGroups,
      labels: {
        major: resolveAdminMajorLabels(t, majorCategories),
        uncategorized: t('uncategorized'),
        general: t('taskGroupGeneral', { defaultValue: '通用' }),
        stageLabels,
        taskGroupLabels,
        subtagLabels,
        bandLabels,
      },
    });
  }, [capabilities, flywheelTaskGroups, majorCategories, stageLabels, taskGroupLabels, subtagLabels, bandLabels, t]);

  const filteredTree = useMemo(() => filterAdminSkillsTree(tree, query), [tree, query]);

  const normalizedQuery = query.trim();

  const rootBranchIds = useMemo(
    () => tree.filter((node) => node.kind === 'branch').map((node) => node.id),
    [tree],
  );

  const defaultExpandedIds = useMemo(() => {
    const ids = new Set(rootBranchIds);
    const geo = tree.find((node) => node.kind === 'branch' && node.id === 'geo');
    if (geo?.kind === 'branch') {
      for (const child of geo.children) {
        if (child.kind === 'branch') ids.add(child.id);
      }
    }
    return ids;
  }, [tree, rootBranchIds]);

  // 搜索时展开过滤结果中的全部分支，便于看到匹配叶子
  useEffect(() => {
    if (!normalizedQuery || filteredTree.length === 0) return;
    setExpanded(new Set(collectAllBranchIds(filteredTree)));
  }, [normalizedQuery, filteredTree]);

  // 无搜索：默认展开一级大类 + GEO 六段；选中技能时额外展开其路径
  useEffect(() => {
    if (normalizedQuery) return;
    if (tree.length === 0) return;
    if (!selectedSlug) {
      setExpanded(new Set(defaultExpandedIds));
      return;
    }
    const ancestors = findSkillAncestors(tree, selectedSlug);
    setExpanded(new Set([...defaultExpandedIds, ...ancestors]));
  }, [normalizedQuery, selectedSlug, tree, defaultExpandedIds]);

  const toggleBranch = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="saas-admin-skills-tree" data-testid="saas-admin-skills-tree">
      <div className="saas-admin-skills-tree-toolbar">
        <label className="saas-admin-skills-tree-search">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </label>
      </div>

      <div className="saas-admin-skills-tree-body">
        {loading ? (
          <div className="saas-admin-skills-tree-status">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载技能树…</span>
          </div>
        ) : error ? (
          <div className="saas-admin-skills-tree-status">{error}</div>
        ) : filteredTree.length === 0 ? (
          <div className="saas-admin-skills-tree-status">{t('empty.noData')}</div>
        ) : (
          filteredTree.map((node) =>
            node.kind === 'branch' ? (
              <TreeBranch
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleBranch}
                selectedSlug={selectedSlug}
                onSelectSkill={onSelectSkill}
              />
            ) : (
              <TreeLeaf
                key={node.id}
                node={node}
                depth={0}
                selected={selectedSlug === node.slug}
                onSelect={() => onSelectSkill(node)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
