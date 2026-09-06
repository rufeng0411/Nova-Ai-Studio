/**
 * PD-SAAS-FORK: 工具 / 全案模板 可见性 — 与前台 Hub 同布局
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CapabilityHub from '../../components/main-content-v2/CapabilityHub.js';
import { clearCapabilityHubCache } from '../../shared/capabilityHubCache.js';
import {
  EMPTY_HUB_VISIBILITY,
  fetchHubVisibility,
  isCategoryVisible,
  normalizeHubVisibilityDoc,
  saveHubVisibilityAdmin,
  type HubVisibilityDoc,
  type HubVisibilityDocUpdater,
} from '../../shared/hubVisibility';
import HubVisibilityTemplatesPanel from './HubVisibilityTemplatesPanel.js';
import { cn } from '../../lib/utils.js';

type AdminTab = 'capabilities' | 'templates';

function resolveVisibilityDocUpdate(
  prev: HubVisibilityDoc,
  next: HubVisibilityDocUpdater,
): HubVisibilityDoc {
  const resolved = typeof next === 'function' ? next(prev) : next;
  return normalizeHubVisibilityDoc(resolved);
}

export default function HubVisibilityAdminPage() {
  const [doc, setDoc] = useState<HubVisibilityDoc>(EMPTY_HUB_VISIBILITY);
  const docRef = useRef<HubVisibilityDoc>(EMPTY_HUB_VISIBILITY);
  const [activeTab, setActiveTab] = useState<AdminTab>('capabilities');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const applyDocChange = useCallback((next: HubVisibilityDocUpdater) => {
    const normalized = resolveVisibilityDocUpdate(docRef.current, next);
    docRef.current = normalized;
    setDoc(normalized);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visibility = await fetchHubVisibility();
      const normalized = normalizeHubVisibilityDoc(visibility);
      docRef.current = normalized;
      setDoc(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const saved = await saveHubVisibilityAdmin(docRef.current);
      docRef.current = saved;
      setDoc(saved);
      clearCapabilityHubCache();
      setSavedNotice('已保存，前台工具与全案模板将在刷新后生效。');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, []);

  const stats = useMemo(() => {
    const hiddenCategories = Object.values(doc.categories).filter((v) => v === false).length;
    const hiddenCaps = Object.values(doc.capabilities).filter((v) => v === false).length;
    const hiddenTemplates = Object.values(doc.templates).filter((v) => v === false).length;
    return { hiddenCategories, hiddenCaps, hiddenTemplates };
  }, [doc]);

  const categoryStatusNotes = useMemo(() => {
    const notes: string[] = [];
    const tracked = [
      ['development', '开发'],
      ['brainstorming', '脑暴'],
      ['enterprise_compliance', '企业'],
      ['media', '媒体'],
      ['education', '教育'],
      ['finance', '金融'],
    ] as const;
    for (const [id, label] of tracked) {
      notes.push(isCategoryVisible(id, doc) ? `${label} Tab 可见` : `${label} Tab 隐藏`);
    }
    return notes;
  }, [doc]);

  if (loading) {
    return <p className="saas-admin-note">加载可见性配置…</p>;
  }

  return (
    <div className="saas-admin-hub-vis-hub flex h-[calc(100vh-7rem)] min-h-[560px] flex-col" data-testid="saas-admin-hub-visibility">
      <div className="saas-admin-panel-head shrink-0">
        <div>
          <h2>能力可见</h2>
          <p className="saas-admin-note">
            布局与前台工具一致；卡片右上角眼睛图标控制前台是否展示（等同收藏星标位置）。
            一级 Tab 与子类旁的眼睛可批量开关分类。默认隐藏「开发」「脑暴」「企业」，可在此开启。
          </p>
        </div>
        <div className="saas-admin-skills-head-actions">
          <button type="button" className="saas-admin-btn" onClick={() => void load()} disabled={saving}>
            重新加载
          </button>
          <button
            type="button"
            className="saas-admin-btn primary"
            onClick={() => void handleSave()}
            disabled={saving}
            data-testid="saas-admin-hub-vis-save"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {error ? <p className="saas-admin-error">{error}</p> : null}
      {savedNotice ? <p className="saas-admin-note">{savedNotice}</p> : null}

      <p className="saas-admin-note shrink-0">
        已隐藏：{stats.hiddenCategories} 个分类、{stats.hiddenCaps} 项能力、{stats.hiddenTemplates} 条模板
        {' · '}
        {categoryStatusNotes.join(' · ')}
      </p>

      <div className="mb-2 flex shrink-0 gap-2 px-1">
        <button
          type="button"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
            activeTab === 'capabilities' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => setActiveTab('capabilities')}
        >
          工具
        </button>
        <button
          type="button"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
            activeTab === 'templates' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => setActiveTab('templates')}
        >
          全案模板
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background">
        {activeTab === 'capabilities' ? (
          <CapabilityHub
            embedded
            visibilityMode
            visibilityDoc={doc}
            onVisibilityDocChange={applyDocChange}
            selectedProject={null}
          />
        ) : (
          <HubVisibilityTemplatesPanel doc={doc} onDocChange={applyDocChange} />
        )}
      </div>
    </div>
  );
}
