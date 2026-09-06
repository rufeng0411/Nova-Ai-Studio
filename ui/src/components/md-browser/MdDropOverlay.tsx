// PD-SAAS-FORK: 全屏拖放蒙层（盖住 Cherry 编辑区，保证能接到 drop）
import type { DragEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';

type MdDropOverlayProps = {
  active: boolean;
  mode?: 'load' | 'openWindow';
  /** 编辑器页须 true（盖住 Cherry）；工作台全屏提示用 false，由 document 收 drop */
  capturePointer?: boolean;
  onDragEnter?: DragEventHandler;
  onDragOver?: DragEventHandler;
  onDragLeave?: DragEventHandler;
  onDrop?: DragEventHandler;
};

export default function MdDropOverlay({
  active,
  mode = 'load',
  capturePointer = false,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: MdDropOverlayProps) {
  const { t } = useTranslation('templatesHub');
  if (!active) return null;

  const label =
    mode === 'openWindow'
      ? t('mdBrowserDropHintWindow', {
          defaultValue: '松开以在 Markdown 浏览器中打开',
        })
      : t('mdBrowserDropHintLoad', {
          defaultValue: '松开以载入 Markdown 文件',
        });

  return (
    <div
      className={cn(
        'inset-0 z-[80] flex items-center justify-center',
        'bg-background/70 backdrop-blur-[1px]',
        capturePointer ? 'absolute' : 'fixed',
        capturePointer ? '' : 'pointer-events-none',
      )}
      data-testid="md-drop-overlay"
      aria-live="polite"
      onDragEnter={capturePointer ? onDragEnter : undefined}
      onDragOver={capturePointer ? onDragOver : undefined}
      onDragLeave={capturePointer ? onDragLeave : undefined}
      onDrop={capturePointer ? onDrop : undefined}
    >
      <div className="rounded-xl border border-dashed border-border bg-card/95 px-6 py-4 text-center shadow-sm">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('mdBrowserDropHintTypes', { defaultValue: '支持 .md / .markdown' })}
        </p>
      </div>
    </div>
  );
}
