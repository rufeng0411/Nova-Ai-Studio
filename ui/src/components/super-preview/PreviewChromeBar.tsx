// PD-SAAS-FORK: unified single-row preview action bar (super preview + sidebar editor)
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function PreviewChromeBar({
  title,
  titleIcon,
  children,
  pinnedTrailing,
  className,
}: {
  title?: string;
  titleIcon?: ReactNode;
  children?: ReactNode;
  /** Always visible on the right — never scrolls away with toolbar overflow. */
  pinnedTrailing?: ReactNode;
  className?: string;
}) {
  const hasScrollRegion = Boolean(title || children || pinnedTrailing);

  return (
    <div
      className={cn(
        'flex h-9 w-full min-w-0 shrink-0 flex-nowrap items-stretch border-b border-border bg-card/95 backdrop-blur-sm',
        className,
      )}
    >
      {hasScrollRegion ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {title ? (
            <>
              <div className="flex w-[min(34%,10.5rem)] shrink-0 items-center gap-1.5 overflow-hidden">
                {titleIcon ? <span className="shrink-0 text-muted-foreground">{titleIcon}</span> : null}
                <span className="min-w-0 truncate text-xs font-medium text-foreground" title={title}>
                  {title}
                </span>
              </div>
              {children ? <PreviewChromeDivider /> : null}
            </>
          ) : null}
          {children ? (
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-nowrap items-center gap-0.5',
                title ? 'justify-end' : 'ml-auto justify-end',
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
      {pinnedTrailing ? (
        <div
          className={cn(
            'flex shrink-0 items-center bg-card/95 px-1.5',
            hasScrollRegion && 'border-l border-border/80',
          )}
          data-testid="preview-chrome-pinned-trailing"
        >
          {pinnedTrailing}
        </div>
      ) : null}
    </div>
  );
}

export function PreviewChromeGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex shrink-0 flex-nowrap items-center gap-0.5', className)}>{children}</div>;
}

export function PreviewChromeDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border/80" aria-hidden />;
}

type PreviewChromeIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  variant?: 'ghost' | 'muted';
};

export function PreviewChromeIconButton({
  active = false,
  variant = 'ghost',
  className,
  type = 'button',
  ...props
}: PreviewChromeIconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        'text-muted-foreground hover:bg-muted hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        variant === 'muted' && 'bg-muted/60',
        active && 'bg-muted text-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function PreviewChromeCloseButton({
  onClose,
  label,
}: {
  onClose: () => void;
  label: string;
}) {
  return (
    <PreviewChromeIconButton title={label} aria-label={label} onClick={onClose}>
      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
    </PreviewChromeIconButton>
  );
}

export function PreviewChromeLink({
  href,
  title,
  children,
  className,
}: {
  href: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {children}
    </a>
  );
}
