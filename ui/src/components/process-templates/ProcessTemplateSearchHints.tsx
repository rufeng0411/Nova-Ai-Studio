// PD-SAAS-FORK: 流程模板搜索 — 聚焦输入框时分组关键词快捷提示
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';

export type TemplateSearchHintGroup = {
  id: string;
  label: string;
  keywords: string[];
};

type ProcessTemplateSearchHintsProps = {
  query: string;
  onPickKeyword: (keyword: string) => void;
  className?: string;
};

function normalizeGroups(raw: unknown): TemplateSearchHintGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as { id?: string; label?: string; keywords?: unknown };
      const keywords = Array.isArray(row.keywords)
        ? row.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : [];
      if (!row.id || !row.label || keywords.length === 0) return null;
      return { id: row.id, label: row.label, keywords };
    })
    .filter((g): g is TemplateSearchHintGroup => g !== null);
}

function filterGroups(groups: TemplateSearchHintGroup[], query: string): TemplateSearchHintGroup[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return groups;
  return groups
    .map((group) => ({
      ...group,
      keywords: group.keywords.filter((kw) => kw.toLowerCase().includes(trimmed)),
    }))
    .filter((group) => group.keywords.length > 0);
}

export default function ProcessTemplateSearchHints({
  query,
  onPickKeyword,
  className,
}: ProcessTemplateSearchHintsProps) {
  const { t } = useTranslation('processTemplates');

  const groups = useMemo(() => {
    const raw = t('searchHints.groups', { returnObjects: true });
    return filterGroups(normalizeGroups(raw), query);
  }, [t, query]);

  if (groups.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-border/70 bg-card/95 p-2.5 shadow-sm backdrop-blur-sm',
        className,
      )}
      role="listbox"
      aria-label={t('searchHints.title')}
    >
      <p className="mb-2 px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {t('searchHints.title')}
      </p>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-0.5 text-[11px] font-medium text-muted-foreground">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.keywords.map((keyword) => (
                <button
                  key={`${group.id}-${keyword}`}
                  type="button"
                  role="option"
                  aria-selected={query.trim() === keyword ? 'true' : 'false'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onPickKeyword(keyword)}
                  className={cn(
                    'rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground/85',
                    'transition-colors hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    query.trim() === keyword && 'border-primary/35 bg-primary/[0.08] text-primary',
                  )}
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
