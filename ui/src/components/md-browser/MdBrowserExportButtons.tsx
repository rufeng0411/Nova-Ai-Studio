// PD-SAAS-FORK: Markdown 浏览器 Word/PDF 导出（复用 export_document）
import { useCallback, useState } from 'react';
import { FileDown, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import {
  exportMarkdownFromBrowser,
  mapMdBrowserExportError,
  type MdBrowserExportFormat,
} from '../../shared/mdBrowserExport';

type MdBrowserExportButtonsProps = {
  projectName?: string | null;
  getMarkdown: () => string;
  fileName: string;
  onStatus?: (message: string | null) => void;
};

export default function MdBrowserExportButtons({
  projectName,
  getMarkdown,
  fileName,
  onStatus,
}: MdBrowserExportButtonsProps) {
  const { t } = useTranslation('templatesHub');
  const [busyFormat, setBusyFormat] = useState<MdBrowserExportFormat | null>(null);

  const runExport = useCallback(
    async (format: MdBrowserExportFormat) => {
      if (busyFormat) return;
      setBusyFormat(format);
      onStatus?.(
        format === 'pdf'
          ? t('mdBrowserExportingPdf', { defaultValue: '正在导出 PDF…' })
          : t('mdBrowserExportingDocx', { defaultValue: '正在导出 Word…' }),
      );
      try {
        await exportMarkdownFromBrowser({
          projectName,
          content: getMarkdown(),
          fileName,
          format,
        });
        onStatus?.(
          format === 'pdf'
            ? t('mdBrowserExportedPdf', { defaultValue: 'PDF 已导出并开始下载' })
            : t('mdBrowserExportedDocx', { defaultValue: 'Word 已导出并开始下载' }),
        );
      } catch (err) {
        const code = err instanceof Error ? err.message : String(err);
        onStatus?.(mapMdBrowserExportError(code, t));
      } finally {
        setBusyFormat(null);
      }
    },
    [busyFormat, fileName, getMarkdown, onStatus, projectName, t],
  );

  const btnClass =
    'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50';

  return (
    <>
      <button
        type="button"
        className={cn(btnClass, 'border-blue-500/20 text-blue-700 dark:text-blue-300')}
        disabled={Boolean(busyFormat)}
        onClick={() => void runExport('docx')}
        data-testid="md-browser-export-docx"
        title={t('mdBrowserExportDocxTitle', { defaultValue: '导出为可编辑 Word（完美版式）' })}
      >
        {busyFormat === 'docx' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('mdBrowserExportDocx', { defaultValue: '导出 Word' })}
      </button>
      <button
        type="button"
        className={cn(btnClass, 'border-red-500/20 text-red-700 dark:text-red-300')}
        disabled={Boolean(busyFormat)}
        onClick={() => void runExport('pdf')}
        data-testid="md-browser-export-pdf"
        title={t('mdBrowserExportPdfTitle', { defaultValue: '导出为精排 PDF（完美版式）' })}
      >
        {busyFormat === 'pdf' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileDown className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('mdBrowserExportPdf', { defaultValue: '导出 PDF' })}
      </button>
    </>
  );
}
