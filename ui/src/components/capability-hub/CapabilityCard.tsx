// PD-SAAS-FORK: minimal capability card — name + icon; description on hover
import { useCallback, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';
import type { HubVisualTheme } from '../../shared/capabilityHubTheme.js';

export type CapabilityCardStatus = 'available' | 'needs_config' | 'pending';

export type CapabilityCardProps = {
  icon: LucideIcon;
  theme: HubVisualTheme;
  title: string;
  description: string;
  statusLabel: string;
  status: CapabilityCardStatus;
  badges?: string[];
  tryLabel: string;
  rating?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteLabel?: string;
  /** PD-SAAS-FORK: 后台可见性管理 — 星标位改为前台可见开关 */
  hubVisible?: boolean;
  onToggleHubVisible?: () => void;
  hubVisibleLabel?: string;
  disabled?: boolean;
  disabledTitle?: string;
  selected?: boolean;
  onUse: () => void;
  /** PD-SAAS-FORK: mobile shell — full-width list row with wrap-friendly title */
  layout?: 'compact' | 'mobile-list' | 'mobile-grid';
};

const STATUS_DOT: Record<CapabilityCardStatus, string> = {
  available: 'bg-success',
  needs_config: 'bg-muted-foreground/40',
  pending: 'bg-warning',
};

export default function CapabilityCard({
  icon: Icon,
  theme,
  title,
  description,
  statusLabel,
  status,
  disabled = false,
  disabledTitle,
  selected = false,
  isFavorite = false,
  onToggleFavorite,
  favoriteLabel,
  hubVisible = true,
  onToggleHubVisible,
  hubVisibleLabel,
  onUse,
  layout = 'compact',
}: CapabilityCardProps) {
  const isMobileList = layout === 'mobile-list';
  const isMobileGrid = layout === 'mobile-grid';
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const [showDesc, setShowDesc] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties | null>(null);
  const hoverText = description?.trim();

  const updateTipPosition = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTipStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 10050,
    });
  }, []);

  const handleActivate = () => {
    if (disabled || onToggleHubVisible) return;
    onUse();
  };

  const handleMouseEnter = () => {
    if (disabled || !hoverText) return;
    updateTipPosition();
    setShowDesc(true);
  };

  const handleMouseLeave = () => {
    setShowDesc(false);
  };

  const handleFavoriteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onToggleFavorite?.();
  };

  const handleVisibilityClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onToggleHubVisible?.();
  };

  return (
    <>
      <motion.article
        ref={cardRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? 'true' : 'false'}
        aria-label={title}
        title={disabled ? disabledTitle : undefined}
        onClick={handleActivate}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleActivate();
          }
        }}
        whileHover={reduceMotion || disabled ? undefined : { y: -1 }}
        whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'group relative flex outline-none',
          isMobileGrid
            ? 'mobile-hub-cap-card mobile-touch-target items-center gap-1 rounded-lg border border-border/50 bg-card px-2 py-1.5 min-h-[40px]'
            : isMobileList
            ? 'mobile-hub-cap-card mobile-touch-target items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3 min-h-[52px]'
            : 'items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5 max-md:min-h-[44px] max-md:py-3',
          'transition-all duration-150 ease-out hover:border-primary/35 hover:bg-accent/40 hover:shadow-sm',
          'focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30',
          selected && 'border-primary/50 bg-primary/5 ring-2 ring-primary/25',
          !hubVisible && onToggleHubVisible && 'opacity-50',
          disabled ? 'cursor-not-allowed opacity-55' : onToggleHubVisible ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        {!isMobileGrid ? (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-110',
            isMobileList ? 'mt-0.5 h-8 w-8' : 'h-7 w-7',
            theme.icon,
          )}
        >
          <Icon className={cn(isMobileList ? 'h-4 w-4' : 'h-3.5 w-3.5')} strokeWidth={1.75} />
        </span>
        ) : null}

        <span
          className={cn(
            'mobile-hub-cap-title min-w-0 flex-1 font-medium text-foreground',
            isMobileGrid
              ? 'text-[11px] leading-snug tracking-tight [overflow-wrap:anywhere] line-clamp-3'
              : isMobileList
              ? 'text-[13px] leading-snug tracking-tight [overflow-wrap:anywhere]'
              : 'truncate text-[12px] leading-tight tracking-tight',
          )}
        >
          {title}
        </span>

        <span
          className={cn(
            'shrink-0 rounded-full opacity-70',
            isMobileGrid ? 'h-1.5 w-1.5' : isMobileList ? 'mt-2 h-2 w-2' : 'h-1.5 w-1.5',
            STATUS_DOT[status],
          )}
          title={statusLabel}
          aria-label={statusLabel}
        />

        {onToggleHubVisible ? (
          <button
            type="button"
            onClick={handleVisibilityClick}
            aria-pressed={hubVisible ? 'true' : 'false'}
            aria-label={hubVisibleLabel}
            title={hubVisibleLabel}
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              hubVisible ? 'text-primary hover:text-primary' : 'text-muted-foreground/50 hover:text-foreground',
            )}
          >
            {hubVisible ? (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        ) : onToggleFavorite ? (
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-pressed={isFavorite ? 'true' : 'false'}
            aria-label={favoriteLabel}
            title={favoriteLabel}
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              isFavorite && 'text-amber-500 hover:text-amber-600',
            )}
          >
            <Star
              className="h-3.5 w-3.5"
              strokeWidth={1.75}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
        ) : null}
      </motion.article>
      {showDesc && hoverText && tipStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              style={tipStyle}
              className="pointer-events-none max-w-[260px] rounded-lg border border-border bg-popover px-3 py-2 text-[11px] leading-relaxed text-popover-foreground shadow-lg"
              role="tooltip"
            >
              {hoverText}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
