// PD-SAAS-FORK: colored export format buttons for preview toolbar
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentExport } from '../../hooks/useDocumentExport';
import type { ExportCapability } from '../../shared/documentExportMatrix';
import { buildExportCapabilities, exportCapDisabledReason, hasExportCapabilities, isExportCapClickable } from '../../shared/documentExportMatrix';
import { resolveExportScope } from '../../shared/resolveExportScope';
import { classifyDeliverablePath } from '../../shared/artifactPaths';
import { cn } from '../../lib/utils';

export type DocumentExportActionBarProps = {
  projectName?: string;
  sourcePath?: string;
  projectRoot?: string;
  variant?: 'overlay' | 'editor';
};

type BadgeKind = 'pdf' | 'docx' | 'pptx' | 'xlsx';

type BadgeStyle = {
  kind: BadgeKind;
  label: string;
  chip: string;
  chipOverlay: string;
};

function badgeKindFor(cap: ExportCapability): BadgeKind {
  if (cap.format === 'pdf') return 'pdf';
  if (cap.format === 'docx') return 'docx';
  if (cap.format === 'pptx') return 'pptx';
  return 'xlsx';
}

const BADGE_STYLES: Record<BadgeKind, Omit<BadgeStyle, 'label'>> = {
  pdf: {
    kind: 'pdf',
    chip:
      'border-red-500/15 bg-red-500/[0.08] text-red-700/90 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300/90',
    chipOverlay: 'border-red-300/25 bg-red-500/15 text-red-50',
  },
  docx: {
    kind: 'docx',
    chip:
      'border-blue-500/15 bg-blue-500/[0.08] text-blue-700/90 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/90',
    chipOverlay: 'border-blue-300/25 bg-blue-500/15 text-blue-50',
  },
  pptx: {
    kind: 'pptx',
    chip:
      'border-amber-500/15 bg-amber-500/[0.08] text-amber-800/90 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200/90',
    chipOverlay: 'border-amber-300/25 bg-amber-500/15 text-amber-50',
  },
  xlsx: {
    kind: 'xlsx',
    chip:
      'border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-800/90 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200/90',
    chipOverlay: 'border-emerald-300/25 bg-emerald-500/15 text-emerald-50',
  },
};

function badgeLabel(cap: ExportCapability): string {
  const kind = badgeKindFor(cap);
  if (kind === 'docx') return 'DOC';
  return kind.toUpperCase();
}

function ExportFormatBadge({
  cap,
  running,
}: {
  cap: ExportCapability;
  running: boolean;
}) {
  const kind = badgeKindFor(cap);
  const style = BADGE_STYLES[kind];

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] max-w-full items-center justify-center rounded-[0.35rem] border px-0.5',
        'text-[8px] font-semibold leading-none tracking-[0.02em]',
        'transition-[transform,opacity] duration-200',
        style.chip,
        running && 'scale-95 opacity-80',
      )}
    >
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : badgeLabel(cap)}
    </span>
  );
}

function capKey(cap: ExportCapability): string {
  return `${cap.engine}:${cap.format}:${cap.recommended}`;
}

function isSameCap(job: { activeFormat?: string; activeEngine?: string }, cap: ExportCapability): boolean {
  return job.activeFormat === cap.format && job.activeEngine === cap.engine;
}

export function DocumentExportActionBar({
  projectName,
  sourcePath,
  projectRoot,
  variant = 'editor',
}: DocumentExportActionBarProps) {
  const { t } = useTranslation('chat');
  const { capabilities, capsLoaded, job, startExport, retryDownload, pageCount } = useDocumentExport(
    projectName,
    sourcePath,
    projectRoot,
  );

  if (!projectName || !sourcePath) return null;

  const scope = resolveExportScope({
    filePath: sourcePath,
    kind: classifyDeliverablePath(sourcePath),
  });
  // PD-SAAS-FORK: pessimistic OCR until server capabilities load — avoids clickable PPTX that fails.
  const scopeCaps = buildExportCapabilities(scope, sourcePath, { ocrReady: false });
  const scopeCapList = Array.isArray(scopeCaps) ? scopeCaps : [];
  const scopePrimary = scopeCapList.filter((c) => c.recommended);
  if (!hasExportCapabilities(sourcePath, scope) && scopePrimary.length === 0) {
    return null;
  }

  // Same hit target as PreviewActionToolbar / CodeEditorHeader (editor icon row).
  const shell =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 max-md:min-h-[44px] max-md:min-w-[44px]';

  const serverPrimary = (Array.isArray(capabilities) ? capabilities : []).filter((c) => c.recommended);
  const primary = capsLoaded && serverPrimary.length > 0 ? serverPrimary : scopePrimary;
  if (primary.length === 0) return null;

  const statusClass = 'text-[11px] text-muted-foreground';

  const busy = job.status === 'running' || job.status === 'downloading';
  const pageProgressLabel =
    busy &&
    job.activeFormat === 'pptx' &&
    job.progressPage &&
    job.progressTotal &&
    job.progressTotal > 1
      ? `${job.progressPage}/${job.progressTotal}`
      : null;

  const renderCapButton = (cap: ExportCapability) => {
    const label = t(cap.labelKey, {
      defaultValue:
        cap.format === 'pdf'
          ? 'PDF'
          : cap.format === 'docx'
            ? 'Word'
            : cap.format === 'pptx'
              ? 'PPT'
              : 'Excel',
    });
    const hint = t(cap.hintKey, {
      defaultValue: label,
      count: pageCount ?? cap.pageCount ?? 0,
    });
    const busyCap = job.status === 'running' || job.status === 'downloading';
    const running =
      busyCap && isSameCap(job, cap);
    const disabled = !isExportCapClickable(cap, { capsLoaded, busy: busyCap, running });
    const reasonKey = exportCapDisabledReason(cap, {
      capsLoaded,
      enabled: cap.enabled !== false,
    });
    const reason = reasonKey
      ? t(reasonKey, {
          defaultValue:
            reasonKey === 'export.reason.checking'
              ? '正在检查导出能力…'
              : '需要先在设置中配置文档工具',
        })
      : undefined;

    return (
      <button
        key={capKey(cap)}
        type="button"
        className={cn(shell, 'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30')}
        title={disabled && reason ? reason : hint}
        aria-label={label}
        disabled={disabled}
        onClick={() => void startExport(cap)}
      >
        <ExportFormatBadge cap={cap} running={running} />
      </button>
    );
  };

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
      {primary.map((cap) => renderCapButton(cap))}
      {pageProgressLabel ? (
        <span
          className={cn(statusClass, 'shrink-0 tabular-nums px-0.5')}
          aria-live="polite"
          title={t('export.pageProgress', { defaultValue: '导出页进度' })}
        >
          {pageProgressLabel}
        </span>
      ) : null}
      {job.status === 'done' && job.autoDownloadFailed && job.downloadUrl ? (
        <button
          type="button"
          className={cn(
            statusClass,
            'shrink-0 whitespace-nowrap px-0.5 underline decoration-dotted underline-offset-2 hover:text-foreground',
          )}
          title={t('export.retryDownload', { defaultValue: '自动下载未成功，点击重试' })}
          onClick={() => void retryDownload()}
        >
          {t('export.retryDownloadShort', { defaultValue: '点击下载' })}
        </button>
      ) : null}
      {job.status === 'failed' ? (
        <span
          className={cn(statusClass, 'max-w-[8rem] shrink truncate whitespace-nowrap px-0.5')}
          title={job.error}
        >
          {job.error?.includes('not configured') || job.error?.includes('MinerU token')
            ? t('export.reason.needsOcrConfig', { defaultValue: '请先在设置中配置文档工具' })
            : job.error?.includes('not a PNG') || job.error?.includes('image format') || job.error?.includes('No valid slide images')
              ? t('export.failedBadImage', { defaultValue: '图片格式无法识别' })
              : job.error?.includes('File not found') || job.error?.includes('export_capabilities') || job.error?.includes('job not found')
                ? t('export.failedPath', { defaultValue: '找不到源文件' })
                : job.error?.includes('export_timeout')
                  ? t('export.failedTimeout', {
                      defaultValue: '导出耗时较长已中断，请稍后在成果文件夹查看是否已生成',
                    })
                  : job.error?.includes('Executable doesn') ||
                    job.error?.includes('playwright') ||
                    job.error?.includes('chromium')
                  ? t('export.failedPdfRuntime', {
                      defaultValue: 'PDF 导出组件未就绪，请重新部署后重试',
                    })
                  : job.error?.includes('python-pptx') ||
                      job.error?.includes('No Python') ||
                      job.error?.includes('ModuleNotFoundError')
                    ? t('export.failedPptRuntime', {
                        defaultValue: 'PPT 导出组件未就绪，请重新部署后重试',
                      })
                    : t('export.failed', { defaultValue: '导出失败' })}
        </span>
      ) : null}
    </div>
  );
}

export default DocumentExportActionBar;
