/**
 * PD-SAAS-FORK: Unified sidebar delete confirm (project / session / background task).
 */
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';

export type SidebarDeleteDialogProps = {
  title: string;
  subtitle?: string;
  body: string;
  isDeleting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SidebarDeleteDialog({
  title,
  subtitle,
  body,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: SidebarDeleteDialogProps) {
  const { t } = useTranslation('sidebar');

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl">
        <div className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <Trash2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="mt-1 break-all text-sm text-muted-foreground">
                <span className="font-mono text-xs">{subtitle}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-sm text-foreground">{body}</p>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {t('actions.cancel', { defaultValue: '取消' })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.75} />}
            {isDeleting
              ? t('deleteDialog.deleting', { defaultValue: '正在删除…' })
              : t('deleteDialog.confirmDelete', { defaultValue: '删除' })}
          </button>
        </div>
      </div>
    </div>
  );
}
