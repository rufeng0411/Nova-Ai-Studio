import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

export type HubFilterOption = {
  id: string;
  label: string;
  count?: number;
};

type HubFilterDropdownProps = {
  /** 触发按钮前缀，如「筛选」 */
  label: string;
  options: HubFilterOption[];
  activeId: string;
  onChange: (id: string) => void;
  /** 「全部」项文案 */
  allLabel: string;
  allId?: string;
  compact?: boolean;
};

export default function HubFilterDropdown({
  label,
  options,
  activeId,
  onChange,
  allLabel,
  allId = 'all',
  compact = false,
}: HubFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const allOption: HubFilterOption = { id: allId, label: allLabel };
  const merged = [allOption, ...options];
  const active = merged.find((opt) => opt.id === activeId) ?? allOption;
  const isFiltered = active.id !== allId;

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-label={label}
        aria-expanded={open ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border transition-colors',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
          isFiltered
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <SlidersHorizontal className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} strokeWidth={1.75} />
        <span className="font-medium">{isFiltered ? active.label : label}</span>
        {active.count != null && isFiltered ? (
          <span className="tabular-nums opacity-70">({active.count})</span>
        ) : null}
        <ChevronDown
          className={cn('transition-transform duration-150', compact ? 'h-3 w-3' : 'h-3.5 w-3.5', open && 'rotate-180')}
          strokeWidth={1.75}
        />
      </button>

      <AnimatePresence>
      {open ? (
        <motion.div
          role="listbox"
          aria-label={label}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.13, ease: 'easeOut' }}
          className="absolute right-0 z-50 mt-1.5 max-h-[60vh] w-56 origin-top-right overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          {merged.map((opt) => {
            const selected = opt.id === activeId;
            const dim = opt.id !== allId && (opt.count ?? -1) === 0;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected ? 'true' : 'false'}
                onClick={() => select(opt.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors',
                  selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  dim && 'opacity-50',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Check
                    className={cn('h-3.5 w-3.5 shrink-0', selected ? 'opacity-100 text-primary' : 'opacity-0')}
                    strokeWidth={2}
                  />
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.count != null ? (
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{opt.count}</span>
                ) : null}
              </button>
            );
          })}
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
