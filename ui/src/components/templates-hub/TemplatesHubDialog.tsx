// PD-SAAS-FORK: composer templates hub dialog — capabilities + process templates tabs
import { useEffect, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import TemplatesHubPanel, { type TemplatesHubTab } from './TemplatesHubPanel.js';
import type { CapabilityBindingContext } from '../../shared/capabilityBinding.js';
import type { Project } from '../../types/app';

export type { TemplatesHubTab };

type TemplatesHubDialogProps = {
  open: boolean;
  selectedProject: Project | null;
  initialTab?: TemplatesHubTab;
  onTryPrompt: (prompt: string, capability?: CapabilityBindingContext) => void;
  onClose: () => void;
};

export default function TemplatesHubDialog({
  open,
  selectedProject,
  initialTab = 'capabilities',
  onTryPrompt,
  onClose,
}: TemplatesHubDialogProps) {
  const { t } = useTranslation('templatesHub');
  const reduceMotion = useReducedMotion();
  const [hasOpened, setHasOpened] = useState(open);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open && !hasOpened) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 p-4 backdrop-blur-[2px] max-md:p-0 sm:items-center"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ pointerEvents: open ? 'auto' : 'none', visibility: open || hasOpened ? 'visible' : 'hidden' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-hub-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={false}
        animate={
          open
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : 8 }
        }
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={cn(
          'flex h-[min(85vh,720px)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-border bg-sidebar shadow-2xl',
          'max-md:h-[92dvh] max-md:max-w-none max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LayoutGrid
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden
              />
              <h2
                id="templates-hub-title"
                className="text-base font-semibold text-foreground"
              >
                {t('title')}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted max-md:h-11 max-md:w-11"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <TemplatesHubPanel
          key={open ? initialTab : 'closed'}
          variant="dialog"
          selectedProject={selectedProject}
          initialTab={initialTab}
          onTryPrompt={onTryPrompt}
        />
      </motion.div>
    </motion.div>
  );
}
