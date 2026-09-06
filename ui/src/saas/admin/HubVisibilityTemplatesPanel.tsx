/**
 * PD-SAAS-FORK: 全案模板可见性 — 与前台模板画廊同布局
 */
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import {
  fetchProcessTemplates,
  type ProcessTemplate,
  type ProcessTemplateCategory,
} from '../../shared/processTemplates.js';
import { ProcessTemplateCard } from '../../components/process-templates/ProcessTemplateGallery.js';
import {
  isTemplateGroupVisible,
  isTemplateVisible,
  toggleTemplateGroupVisibility,
  toggleTemplateVisibility,
  type HubVisibilityDoc,
  type HubVisibilityDocUpdater,
} from '../../shared/hubVisibility.js';

const CATEGORY_ORDER: ProcessTemplateCategory[] = [
  'marketing',
  'enterprise',
  'geo',
  'office',
  'creation',
];

const CATEGORY_LABELS: Record<string, string> = {
  marketing: '营销',
  enterprise: '企业',
  geo: 'GEO',
  office: '办公',
  creation: '创作',
};

type HubVisibilityTemplatesPanelProps = {
  doc: HubVisibilityDoc;
  onDocChange: (next: HubVisibilityDocUpdater) => void;
};

export default function HubVisibilityTemplatesPanel({
  doc,
  onDocChange,
}: HubVisibilityTemplatesPanelProps) {
  const { i18n } = useTranslation();
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchProcessTemplates(i18n.language, { admin: true })
      .then((payload) => {
        if (cancelled) return;
        setTemplates(payload.templates ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const categories = useMemo(() => {
    const keys = new Set(
      templates.map((item) => (item.category || 'marketing') as ProcessTemplateCategory),
    );
    return [
      ...CATEGORY_ORDER.filter((id) => keys.has(id)),
      ...[...keys].filter((id) => !CATEGORY_ORDER.includes(id as ProcessTemplateCategory)),
    ];
  }, [templates]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return templates;
    return templates.filter((item) => (item.category || 'marketing') === activeCategory);
  }, [templates, activeCategory]);

  if (loading) {
    return <p className="saas-admin-note px-4 py-6">加载全案模板…</p>;
  }

  if (error) {
    return <p className="saas-admin-error px-4 py-3">{error}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="hub-vis-templates-panel">
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] transition-colors',
              activeCategory === 'all'
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            全部 ({templates.length})
          </button>
          {categories.map((category) => {
            const groupId = `templates:${category}`;
            const groupVisible = isTemplateGroupVisible(groupId, doc);
            const count = templates.filter((item) => (item.category || 'marketing') === category).length;
            return (
              <span key={category} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] transition-colors',
                    activeCategory === category
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                    !groupVisible && 'opacity-50 line-through',
                  )}
                >
                  {CATEGORY_LABELS[category] || category} ({count})
                </button>
                <button
                  type="button"
                  title={groupVisible ? '分组前台可见' : '分组前台隐藏'}
                  aria-label={groupVisible ? '隐藏模板分组' : '显示模板分组'}
                  onClick={() => onDocChange((prev) => toggleTemplateGroupVisibility(prev, groupId))}
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted',
                    groupVisible ? 'text-primary' : 'text-muted-foreground/40',
                  )}
                >
                  {groupVisible ? (
                    <Eye className="h-3 w-3" strokeWidth={1.75} />
                  ) : (
                    <EyeOff className="h-3 w-3" strokeWidth={1.75} />
                  )}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const visible = isTemplateVisible(item.id, doc);
            return (
              <ProcessTemplateCard
                key={item.id}
                item={item}
                disabled={false}
                onTry={() => undefined}
                hubVisible={visible}
                onToggleHubVisible={() => onDocChange((prev) => toggleTemplateVisibility(prev, item.id))}
                hubVisibleLabel={visible ? '前台可见，点击隐藏' : '前台隐藏，点击显示'}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
