// PD-SAAS-FORK: Preflight selection memory chip
import { Pencil } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { PreflightCatalogEntry } from '../../../../shared/preflightSelection';
import SelectionChip from './SelectionChip';
import { PreflightCardThumb, ColorSwatches } from '../../../../shared/preflightCardThumb';
import type { PreflightThumbKind } from '../../../../shared/preflightThumbRender';

type SelectionChipProps = {
  label: string;
  sublabel?: string;
  item?: PreflightCatalogEntry;
  thumbKind?: PreflightThumbKind;
  accent?: string;
  onEdit?: () => void;
  className?: string;
};

export default function SelectionChip({
  label,
  sublabel,
  item,
  thumbKind = 'od',
  accent = '#6366f1',
  onEdit,
  className,
}: SelectionChipProps) {
  const previewItem: PreflightCatalogEntry = item ?? { id: 'chip', label, accent, colors: [accent] };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2 py-1.5',
        className,
      )}
      data-testid="preflight-selection-chip"
    >
      <div className="w-14 shrink-0 overflow-hidden rounded-md border border-border/50">
        <PreflightCardThumb item={previewItem} kind={thumbKind} eager />
        <ColorSwatches colors={previewItem.colors ?? [accent]} className="flex gap-px px-0.5 pb-0.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-foreground">{label}</div>
        {sublabel ? (
          <div className="truncate text-[11px] text-muted-foreground">{sublabel}</div>
        ) : null}
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="改样式"
          data-testid="preflight-chip-edit"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
