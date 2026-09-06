// PD-SAAS-FORK: Preflight Studio — Super Preview split workbench (OD / ppt-master)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, PenLine, SkipForward, X } from 'lucide-react';
import odCatalog from '../../../../generated/preflight-catalog-od.json';
import pptCatalog from '../../../../generated/preflight-catalog-ppt.json';
import { authenticatedFetch } from '../../../../utils/api.js';
import type { PreflightCatalogEntry, PreflightConfirmPayload, PreflightDraftSelection } from '../../../../shared/preflightSelection';
import { buildCustomStyleLaunchContext, buildLaunchContextXml } from '../../../../shared/preflightSelection';
import { isPreflightEagerThumbsEnabled } from '../../../../shared/preflightStudioGate';
import { storePendingLaunchContext } from '../../../../shared/launchContextStorage';
import PreflightDetailPreview from '../../../../shared/preflightDetailPreview';
import type { PreflightThumbKind } from '../../../../shared/preflightThumbRender';
import SelectionChip from './SelectionChip';
import VisualCardGrid from './VisualCardGrid';

export type PreflightStudioAdapterProps = {
  slug: 'open-design' | 'ppt-master' | string;
  displayName: string;
  sessionId?: string;
  slotId?: string;
  fallbackPrompt?: string;
  onClose?: () => void;
  onConfirmed?: (payload: PreflightConfirmPayload) => void;
};

type PptCatalog = typeof pptCatalog;
type OdCatalog = typeof odCatalog;

const PPT_STEPS = ['canvas', 'mode', 'style'] as const;

function odEntries(catalog: OdCatalog): PreflightCatalogEntry[] {
  return (catalog.entries ?? []).map((e) => ({
    id: e.id,
    label: e.label,
    category: e.category,
    accent: e.accent,
    colors: e.colors,
    previewUrl: e.previewUrl,
    previewThumbUrl: e.previewThumbUrl,
    previewImageUrl: e.previewImageUrl,
    recommended: e.recommended,
  }));
}

function pptEntriesForStep(catalog: PptCatalog, step: typeof PPT_STEPS[number]): PreflightCatalogEntry[] {
  if (step === 'canvas') {
    return (catalog.canvas ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      dim: c.dim,
      ratio: c.ratio,
      desc: c.use,
      colors: c.colors,
      previewUrl: c.previewUrl,
      previewThumbUrl: c.previewThumbUrl,
      previewImageUrl: c.previewImageUrl,
    }));
  }
  if (step === 'mode') {
    return (catalog.modes ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      desc: m.desc,
      colors: m.colors,
      previewThumbUrl: m.previewThumbUrl,
      previewImageUrl: m.previewImageUrl,
    }));
  }
  return (catalog.styles ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    group: s.group,
    desc: s.desc,
    colors: s.colors,
    previewUrl: s.previewUrl,
    previewThumbUrl: s.previewThumbUrl,
    previewImageUrl: s.previewImageUrl,
    recommended: s.recommended,
  }));
}

function pptThumbKind(step: typeof PPT_STEPS[number]): PreflightThumbKind {
  if (step === 'canvas') return 'ppt-canvas';
  if (step === 'mode') return 'ppt-mode';
  return 'ppt-style';
}

export default function PreflightStudioAdapter({
  slug,
  displayName,
  sessionId,
  slotId,
  fallbackPrompt,
  onClose,
  onConfirmed,
}: PreflightStudioAdapterProps) {
  const { t } = useTranslation('chat');
  const eagerThumbs = isPreflightEagerThumbsEnabled();
  const isPpt = slug === 'ppt-master';
  const [pptStep, setPptStep] = useState(0);
  const [filter, setFilter] = useState('');
  const [selections, setSelections] = useState<Record<string, PreflightDraftSelection>>({});
  const [confirmed, setConfirmed] = useState(false);

  const currentStepId = isPpt ? PPT_STEPS[pptStep] : 'surface';
  const thumbKind = isPpt ? pptThumbKind(currentStepId) : 'od';

  const allItems = useMemo(() => {
    if (slug === 'open-design') return odEntries(odCatalog as OdCatalog);
    if (isPpt) return pptEntriesForStep(pptCatalog as PptCatalog, currentStepId);
    return [];
  }, [currentStepId, isPpt, slug]);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(q)
      || item.id.toLowerCase().includes(q)
      || (item.category ?? '').toLowerCase().includes(q)
      || (item.group ?? '').toLowerCase().includes(q),
    );
  }, [allItems, filter]);

  const selectedForStep = selections[currentStepId];

  const detailItem = useMemo(
    () => filteredItems.find((i) => i.id === selectedForStep?.optionId)
      ?? allItems.find((i) => i.id === selectedForStep?.optionId),
    [allItems, filteredItems, selectedForStep?.optionId],
  );

  useEffect(() => {
    if (selectedForStep) return;
    const recommended = allItems.find((i) => i.recommended) ?? allItems[0];
    if (recommended) {
      setSelections((prev) => ({
        ...prev,
        [currentStepId]: { stepId: currentStepId, optionId: recommended.id, label: recommended.label },
      }));
    }
  }, [allItems, currentStepId, selectedForStep]);

  const chipLabel = useMemo(() => {
    if (isPpt) {
      const canvas = selections.canvas?.label ?? '—';
      const style = selections.style?.label ?? '—';
      return `${canvas} · ${style}`;
    }
    return selections.surface?.label ?? displayName;
  }, [displayName, isPpt, selections.canvas?.label, selections.style?.label, selections.surface?.label]);

  const chipPreviewItem = useMemo((): PreflightCatalogEntry | undefined => {
    if (isPpt) {
      const styleId = selections.style?.optionId;
      if (!styleId) return detailItem;
      return pptEntriesForStep(pptCatalog as PptCatalog, 'style').find((e) => e.id === styleId) ?? detailItem;
    }
    const surfaceId = selections.surface?.optionId;
    if (!surfaceId) return detailItem;
    return odEntries(odCatalog as OdCatalog).find((e) => e.id === surfaceId) ?? detailItem;
  }, [detailItem, isPpt, selections.style?.optionId, selections.surface?.optionId]);

  const chipThumbKind: PreflightThumbKind = isPpt ? 'ppt-style' : 'od';

  const handleConfirm = useCallback(async () => {
    const body: Record<string, { id: string; label?: string }> = {};
    for (const [key, sel] of Object.entries(selections)) {
      body[key] = { id: sel.optionId, label: sel.label };
    }
    let compiledPrompt = fallbackPrompt ?? '';
    let launchContext = buildLaunchContextXml({ capability: slug, slotId, selections: body });

    try {
      const res = await authenticatedFetch('/api/launch/compile', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          selections: Object.entries(selections).map(([stepId, s]) => ({
            stepId,
            optionId: s.optionId,
            id: s.optionId,
            label: s.label,
          })),
          brief: fallbackPrompt ?? '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.compiledPrompt) compiledPrompt = data.compiledPrompt;
        if (data?.launchContext) launchContext = data.launchContext;
      }
    } catch {
      // fallback to local launch-context
    }

    storePendingLaunchContext(launchContext);
    setConfirmed(true);
    onConfirmed?.({ prompt: compiledPrompt, launchContext, mode: 'template' });
  }, [fallbackPrompt, onConfirmed, selections, sessionId, slotId, slug]);

  const handleCustomStyle = useCallback(() => {
    const launchContext = buildCustomStyleLaunchContext({ capability: slug, slotId });
    storePendingLaunchContext(launchContext);
    onConfirmed?.({
      prompt: fallbackPrompt?.trim() ?? '',
      launchContext,
      mode: 'custom',
    });
  }, [fallbackPrompt, onConfirmed, slotId, slug]);

  const handleNextOrConfirm = useCallback(() => {
    if (isPpt && pptStep < PPT_STEPS.length - 1) {
      setPptStep((s) => s + 1);
      return;
    }
    void handleConfirm();
  }, [handleConfirm, isPpt, pptStep]);

  const handleSkipDefault = useCallback(() => {
    void handleConfirm();
  }, [handleConfirm]);

  if (confirmed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center" data-testid="preflight-confirmed">
        <Check className="h-8 w-8 text-primary" strokeWidth={1.75} />
        <p className="text-sm font-medium text-foreground">样式已确认</p>
        <p className="text-xs text-muted-foreground">正在继续制作…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card" data-testid="preflight-studio-adapter">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">超级预览 · 选模板</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {displayName}
            {' · '}
            {isPpt
              ? t('preflight.stepPpt', { defaultValue: `第 ${pptStep + 1} / ${PPT_STEPS.length} 步`, step: pptStep + 1, total: PPT_STEPS.length })
              : t('preflight.stepOd', { defaultValue: '选择设计系统' })}
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-b border-border px-3 py-2">
        <SelectionChip
          label={chipLabel}
          sublabel={isPpt ? '三步确认 · 点击卡片即时预览' : '已选样式 · 右侧大图同步'}
          item={chipPreviewItem}
          thumbKind={chipThumbKind}
          accent={chipPreviewItem?.accent ?? chipPreviewItem?.colors?.[0] ?? '#6366f1'}
          onEdit={isPpt ? () => setPptStep(0) : undefined}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,34%)_1fr] overflow-hidden">
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-border">
          <div className="shrink-0 p-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('preflight.filterPlaceholder', { defaultValue: '搜索设计系统…' })}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary/50"
              data-testid="preflight-filter"
            />
          </div>
          <VisualCardGrid
            items={filteredItems}
            selectedId={selectedForStep?.optionId}
            eagerThumbs={eagerThumbs}
            thumbKind={thumbKind}
            columns={1}
            onSelect={(item) => {
              setSelections((prev) => ({
                ...prev,
                [currentStepId]: { stepId: currentStepId, optionId: item.id, label: item.label },
              }));
            }}
          />
        </aside>
        <PreflightDetailPreview item={detailItem} kind={thumbKind} className="min-h-0" />
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border p-2">
        <button
          type="button"
          onClick={handleCustomStyle}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/80 px-2 py-2 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
          data-testid="preflight-custom-style"
        >
          <PenLine className="h-3.5 w-3.5" />
          {t('preflight.customStyle', { defaultValue: '不需要模板，自己输入风格' })}
        </button>
        <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSkipDefault}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-2 text-[12px] text-muted-foreground hover:bg-muted"
          data-testid="preflight-skip-default"
        >
          <SkipForward className="h-3.5 w-3.5" />
          {t('preflight.skipDefault', { defaultValue: '跳过（默认）' })}
        </button>
        <button
          type="button"
          onClick={handleNextOrConfirm}
          disabled={!selectedForStep}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
          data-testid="preflight-confirm"
        >
          <Check className="h-3.5 w-3.5" />
          {isPpt && pptStep < PPT_STEPS.length - 1
            ? t('preflight.nextStep', { defaultValue: '下一步' })
            : t('preflight.confirmStyle', { defaultValue: '确认样式' })}
        </button>
        </div>
      </div>
    </div>
  );
}
