/**
 * PD-SAAS-FORK: Smooth logout confirmation for SaaS sidebar.
 */
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { cn } from '../../lib/utils.js';

type SaasLogoutConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SaasLogoutConfirm({ open, onCancel, onConfirm }: SaasLogoutConfirmProps) {
  const { t } = useTranslation(['auth', 'common']);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saas-logout-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] rounded-xl border border-border bg-card p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <LogOut className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="saas-logout-title" className="text-[15px] font-semibold text-foreground">
              {t('auth:logout.title')}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {t('auth:logout.confirm')}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground',
              'transition-colors hover:bg-muted hover:text-foreground',
            )}
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground',
              'transition-opacity hover:opacity-90',
            )}
          >
            {t('auth:logout.button')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
