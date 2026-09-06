/**
 * PD-SAAS-FORK: Platform skill management — taxonomy tree + editor panel.
 */
import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AdminSkillsTree from './AdminSkillsTree';
import AdminNewSkillModal from './AdminNewSkillModal';
import type { AdminSkillLeaf } from './buildAdminSkillsTree';
import SkillsV2 from '../../components/main-content-v2/SkillsV2';
import type { Project } from '../../types/app';
import { useAdminSettingsProjects } from './platform/useAdminSettingsProjects';

export default function SkillsAdminPage() {
  const { projects } = useAdminSettingsProjects();
  const [manageTarget, setManageTarget] = useState<AdminSkillLeaf | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const appProjects = useMemo<Project[]>(
    () =>
      projects.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        fullPath: p.fullPath,
        path: p.path,
        sessions: [],
      })),
    [projects],
  );

  const selectedProject = useMemo(
    () => appProjects[0] ?? null,
    [appProjects],
  );

  const handleSelectSkill = useCallback((leaf: AdminSkillLeaf) => {
    setManageTarget(leaf);
  }, []);

  const handleCreated = useCallback((created: { slug: string; name: string }) => {
    setTreeRefreshKey((k) => k + 1);
    setManageTarget({
      kind: 'skill',
      id: `skill:${created.slug}`,
      slug: created.slug,
      label: created.name,
      name: created.name,
      status: 'available',
      hiddenInHub: false,
      scope: 'user',
    });
  }, []);

  const catalogFallback = useMemo(() => {
    if (!manageTarget) return null;
    if (manageTarget.scope && manageTarget.scope !== 'catalog') return null;
    return {
      slug: manageTarget.slug,
      name: manageTarget.label,
      description: manageTarget.description,
      source: manageTarget.source,
      status: manageTarget.status,
    };
  }, [manageTarget]);

  return (
    <div className="saas-admin-skills" data-testid="saas-admin-skills">
      <div className="saas-admin-panel-head saas-admin-skills-head">
        <div>
          <h2>技能管理</h2>
          <p className="saas-admin-note saas-admin-skills-subtitle">
            与工具同一套分类：营销 · GEO（六段）· 办公 · 创作 · 开发 · 脑暴 · 教育 — 点击左侧 GEO 展开基线/策略/可引用等阶段
          </p>
        </div>
        <div className="saas-admin-skills-head-actions">
          <button
            type="button"
            className="saas-admin-btn primary"
            onClick={() => setShowNewModal(true)}
            data-testid="saas-admin-new-skill"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            新建技能
          </button>
        </div>
      </div>

      <div className="saas-admin-skills-split">
        <div className="saas-admin-skills-browse" data-testid="saas-admin-skills-browse">
          <AdminSkillsTree
            key={treeRefreshKey}
            selectedProject={selectedProject}
            selectedSlug={manageTarget?.slug ?? null}
            onSelectSkill={handleSelectSkill}
          />
        </div>
        <div className="saas-admin-skills-manage" data-testid="saas-admin-skills-manage">
          <SkillsV2
            panelMode
            panelHideNew
            selectedProject={selectedProject}
            projects={appProjects}
            externalSlug={manageTarget?.slug ?? null}
            catalogFallback={catalogFallback}
          />
        </div>
      </div>

      <AdminNewSkillModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
