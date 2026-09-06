// PD-SAAS-FORK: deliverables panel — responsive inline strip (chat only; overlay unchanged)
import React, { useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { sortDeliverables } from '../../../shared/collectDeliverables';
import { useInlineDeliverableSlots } from '../../../hooks/useInlineDeliverableSlots';
import DeliverableThumb from './DeliverableThumb';
import DeliverablePreviewOverlay from './DeliverablePreviewOverlay';

type AssistantDeliverablesPanelProps = {
  items: DeliverableItem[];
  folderItems?: DeliverableItem[];
  filteredCount?: number;
  selectedProject?: Project | null;
  onFileOpen?: (filePath: string) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
  assistantText?: string;
  className?: string;
};

/** Inline chat thumbnail width (~15% smaller than legacy 9rem). Preview area inside is 4:3. */
const INLINE_THUMB_CLASS = 'w-[7.65rem] shrink-0';

function TaskFolderButton({
  disabled,
  title,
  onClick,
  label,
}: {
  disabled: boolean;
  title?: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-card/90 px-2 py-1 text-[11px] font-medium text-foreground/85 transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
      data-testid="open-task-folder"
    >
      <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export function AssistantDeliverablesPanel({
  items,
  folderItems,
  filteredCount = 0,
  selectedProject,
  onFileOpen,
  onOpenTaskFolder,
  className = '',
}: AssistantDeliverablesPanelProps) {
  const { t } = useTranslation('chat');
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const inlineSlotCount = useInlineDeliverableSlots();
  const taskFolderItems = folderItems && folderItems.length > 0 ? folderItems : items;

  const previewItems = useMemo(
    () => sortDeliverables(items.filter((item) => item.kind !== 'url')),
    [items],
  );

  const totalCount = previewItems.length;
  const hasLocalFiles = taskFolderItems.some((item) => item.kind !== 'url');

  const visibleCount = Math.min(inlineSlotCount, totalCount);
  const visibleItems = useMemo(
    () => previewItems.slice(0, visibleCount),
    [previewItems, visibleCount],
  );
  const remainingCount = Math.max(0, totalCount - visibleCount);

  const openOverlayForItem = (item: DeliverableItem) => {
    const idx = previewItems.findIndex((entry) => entry.id === item.id);
    setOverlayIndex(idx >= 0 ? idx : 0);
  };

  if (items.length === 0 && filteredCount <= 0) return null;

  const folderLabel = t('deliverables.openTaskFolder', { defaultValue: '前往任务所在文件夹' });
  const needProjectTitle = t('deliverables.needProject', {
    defaultValue: '请先选择项目后再打开文件夹',
  });

  const panelMode = totalCount === 0 ? 'inline-empty' : remainingCount > 0 ? 'inline-partial' : 'inline-all';

  return (
    <div
      className={`mt-2 flex min-w-0 flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 ${className}`.trim()}
      data-testid="assistant-deliverables-panel"
      data-deliverable-mode={panelMode}
      data-deliverable-slots={inlineSlotCount}
      data-deliverable-total={totalCount}
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        {visibleItems.map((item) => (
          <div key={item.id} className={INLINE_THUMB_CLASS}>
            <DeliverableThumb
              item={item}
              selectedProject={selectedProject}
              allowFrame={false}
              size="compact"
              onActivate={() => openOverlayForItem(item)}
            />
          </div>
        ))}
      </div>

      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setOverlayIndex(visibleCount)}
          className="w-fit text-left text-[12px] font-medium tabular-nums text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          data-testid="deliverables-more-count"
          aria-label={t('deliverables.totalAndRemainingAria', {
            defaultValue: '{{total}} deliverables, {{remaining}} more',
            total: totalCount,
            remaining: remainingCount,
          })}
        >
          {t('deliverables.totalAndRemaining', {
            defaultValue: '{{total}} items · {{remaining}} more',
            total: totalCount,
            remaining: remainingCount,
          })}
        </button>
      ) : null}

      {hasLocalFiles && onOpenTaskFolder ? (
        <div className="flex justify-end border-t border-border/40 pt-2">
          <TaskFolderButton
            disabled={!selectedProject?.name}
            title={!selectedProject?.name ? needProjectTitle : undefined}
            onClick={() => onOpenTaskFolder(taskFolderItems)}
            label={folderLabel}
          />
        </div>
      ) : null}

      {overlayIndex !== null && previewItems.length > 0 ? (
        <DeliverablePreviewOverlay
          items={previewItems}
          index={overlayIndex}
          onIndexChange={setOverlayIndex}
          selectedProject={selectedProject}
          onFileOpen={onFileOpen}
          onClose={() => setOverlayIndex(null)}
        />
      ) : null}
    </div>
  );
}

export default AssistantDeliverablesPanel;
