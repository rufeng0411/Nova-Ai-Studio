/**
 * PD-SAAS-FORK: Inline delete confirm / progress on a single sidebar session row.
 */
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import './sessionRowDelete.css';

export type SessionRowDeleteOverlayMode = 'confirm' | 'deleting' | 'error';

type SessionRowDeleteOverlayProps = {
  mode: SessionRowDeleteOverlayMode;
  isBackgroundTask?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onConfirm?: () => void;
  onDismissError?: () => void;
};

export default function SessionRowDeleteOverlay({
  mode,
  isBackgroundTask = false,
  error,
  onCancel,
  onConfirm,
  onDismissError,
}: SessionRowDeleteOverlayProps) {
  const { t } = useTranslation('sidebar');

  if (mode === 'deleting') {
    return (
      <div className="session-row-delete session-row-delete--progress" aria-busy="true">
        <div className="session-row-delete-progress-head">
          <Loader2 className="session-row-delete-spinner" strokeWidth={1.75} aria-hidden />
          <span className="session-row-delete-status">
            {t('deleteDialog.deleting', { defaultValue: '正在删除…' })}
          </span>
        </div>
        <div className="session-row-delete-track" aria-hidden>
          <div className="session-row-delete-fill" />
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="session-row-delete session-row-delete--error" role="alert">
        <p className="session-row-delete-error-text">
          {error ?? t('messages.deleteSessionFailed', { defaultValue: '删除会话失败，请重试。' })}
        </p>
        <button type="button" className="session-row-delete-dismiss" onClick={onDismissError}>
          {t('actions.dismiss', { defaultValue: '知道了' })}
        </button>
      </div>
    );
  }

  return (
    <div className="session-row-delete session-row-delete--confirm" role="dialog" aria-modal="false">
      <p className="session-row-delete-prompt">
        {isBackgroundTask
          ? t('deleteDialog.deleteBackgroundTaskTitle', { defaultValue: '删除计划任务？' })
          : t('deleteDialog.deleteSessionTitle', { defaultValue: '删除对话？' })}
      </p>
      <p className="session-row-delete-hint">
        {isBackgroundTask
          ? t('deleteDialog.deleteBackgroundTaskBody', {
              defaultValue: '将立即停止后台执行，并永久删除该任务的记录与对话，无法撤销。',
            })
          : t('deleteDialog.deleteSessionBody', {
              defaultValue: '将从记录中删除此对话，且无法撤销。',
            })}
      </p>
      <div className="session-row-delete-actions">
        <button type="button" className="session-row-delete-btn session-row-delete-btn--ghost" onClick={onCancel}>
          {t('actions.cancel', { defaultValue: '取消' })}
        </button>
        <button
          type="button"
          className={cn('session-row-delete-btn', 'session-row-delete-btn--danger')}
          onClick={onConfirm}
        >
          {t('deleteDialog.confirmDelete', { defaultValue: '删除' })}
        </button>
      </div>
    </div>
  );
}
