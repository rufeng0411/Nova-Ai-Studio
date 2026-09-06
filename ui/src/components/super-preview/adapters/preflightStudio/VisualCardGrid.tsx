// PD-SAAS-FORK: Preflight visual card grid with virtual window
import { useEffect, useRef } from 'react';
import { cn } from '../../../../lib/utils';
import type { PreflightCatalogEntry } from '../../../../shared/preflightSelection';
import {
  ColorSwatches,
  PreflightCardThumb,
} from '../../../../shared/preflightCardThumb';
import type { PreflightThumbKind } from '../../../../shared/preflightThumbRender';
import { PREFLIGHT_MAX_VISIBLE_CARDS, usePreflightVirtualWindow } from './usePreflightVirtualWindow';

type VisualCardGridProps = {
  items: PreflightCatalogEntry[];
  selectedId?: string;
  onSelect: (item: PreflightCatalogEntry) => void;
  columns?: number;
  eagerThumbs?: boolean;
  thumbKind?: PreflightThumbKind;
};

export default function VisualCardGrid({
  items,
  selectedId,
  onSelect,
  columns = 2,
  eagerThumbs = false,
  thumbKind = 'od',
}: VisualCardGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { visibleItems, startIndex, onScroll, registerContainer } = usePreflightVirtualWindow(items);

  useEffect(() => {
    registerContainer(scrollRef.current);
  }, [registerContainer]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      data-testid="preflight-card-grid"
      data-visible-count={Math.min(visibleItems.length, PREFLIGHT_MAX_VISIBLE_CARDS)}
      onScroll={(e) => {
        const el = e.currentTarget;
        onScroll(el.scrollTop, el.clientHeight);
      }}
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item, idx) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              data-index={startIndex + idx}
              data-testid={`preflight-card-${item.id}`}
              onClick={() => onSelect(item)}
              className={cn(
                'flex flex-col gap-1 rounded-lg border p-1.5 text-left transition',
                selected
                  ? 'border-primary/70 bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border/60 bg-card hover:border-border hover:bg-muted/30',
              )}
            >
              <PreflightCardThumb item={item} kind={thumbKind} eager={eagerThumbs} />
              <ColorSwatches colors={item.colors ?? (item.accent ? [item.accent] : undefined)} />
              <span className="truncate text-[11px] font-medium text-foreground">{item.label}</span>
              {item.desc ? (
                <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{item.desc}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
