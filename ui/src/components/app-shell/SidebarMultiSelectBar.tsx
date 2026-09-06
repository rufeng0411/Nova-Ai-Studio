// PD-SAAS-FORK: batch action toolbar while sidebar multi-select is active.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  CheckSquare,
  Lock,
  LockOpen,
  Pause,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

export type SidebarMultiSelectBarProps = {
  selectedCount: number;
  canPause: boolean;
  canResume: boolean;
  canComplete: boolean;
  canUncomplete: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canDelete: boolean;
  onExit: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
};

function BatchIconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        destructive
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function SidebarMultiSelectBar({
  selectedCount,
  canPause,
  canResume,
  canComplete,
  canUncomplete,
  canLock,
  canUnlock,
  canDelete,
  onExit,
  onSelectAll,
  onClearSelection,
  onPause,
  onResume,
  onComplete,
  onUncomplete,
  onLock,
  onUnlock,
  onDelete,
}: SidebarMultiSelectBarProps) {
  const { t } = useTranslation('sidebar');
  const hasSelection = selectedCount > 0;

  return (
    <div className="shrink-0 border-t border-border bg-sidebar/95 px-2 py-2 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t('multiSelect.exit', { defaultValue: '退出多选' })}
          aria-label={t('multiSelect.exit', { defaultValue: '退出多选' })}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
          {t('multiSelect.selectedCount', {
            count: selectedCount,
            defaultValue: '已选 {{count}} 条',
          })}
        </span>
        <button
          type="button"
          onClick={onSelectAll}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t('multiSelect.selectAll', { defaultValue: '全选' })}
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          disabled={!hasSelection}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {t('multiSelect.clear', { defaultValue: '清空' })}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        <BatchIconButton
          label={t('actions.pauseSession', { defaultValue: '暂停' })}
          onClick={onPause}
          disabled={!canPause}
        >
          <Pause className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.resumeSession', { defaultValue: '继续' })}
          onClick={onResume}
          disabled={!canResume}
        >
          <Play className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.markTaskComplete', { defaultValue: '任务完成' })}
          onClick={onComplete}
          disabled={!canComplete}
        >
          <Check className="h-4 w-4 stroke-emerald-600/85 dark:stroke-emerald-400/85" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.markTaskIncomplete', { defaultValue: '取消任务完成' })}
          onClick={onUncomplete}
          disabled={!canUncomplete}
        >
          <Check className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.lockSession', { defaultValue: '锁定' })}
          onClick={onLock}
          disabled={!canLock}
        >
          <Lock className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.unlockSession', { defaultValue: '解除锁定' })}
          onClick={onUnlock}
          disabled={!canUnlock}
        >
          <LockOpen className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <BatchIconButton
          label={t('actions.delete', { defaultValue: '删除' })}
          onClick={onDelete}
          disabled={!canDelete}
          destructive
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </BatchIconButton>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t('multiSelect.hint', { defaultValue: '多选模式' })}
        </span>
      </div>
    </div>
  );
}
