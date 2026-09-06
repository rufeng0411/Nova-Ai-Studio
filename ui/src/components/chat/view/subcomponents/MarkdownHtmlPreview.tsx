/**
 * PD-SAAS-FORK: render ```html document blocks as a live preview instead of raw code only.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Maximize2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { copyTextToClipboard } from '../../../../utils/clipboard';
import { isTruncatedHtmlDocument } from '../../../../shared/isTruncatedHtmlDocument';

const MAX_PREVIEW_BYTES = 600_000;

export function isRenderableHtmlDocument(code: string): boolean {
  const trimmed = String(code || '').trim().toLowerCase();
  if (!trimmed || trimmed.length < 24) return false;
  return trimmed.startsWith('<!doctype') || /<html[\s>]/i.test(trimmed);
}

type MarkdownHtmlPreviewProps = {
  html: string;
};

export default function MarkdownHtmlPreview({ html }: MarkdownHtmlPreviewProps) {
  const { t } = useTranslation('chat');
  const [copied, setCopied] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const tooLarge = html.length > MAX_PREVIEW_BYTES;
  const truncated = isTruncatedHtmlDocument(html);
  const previewSrc = useMemo(() => {
    if (tooLarge || truncated) return '';
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }, [html, tooLarge, truncated]);

  useEffect(() => {
    if (!previewSrc) return undefined;
    return () => {
      URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const frame = (className: string) => {
    if (!previewSrc) {
      return (
        <div className={`flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center text-xs text-muted-foreground ${className}`}>
          {truncated
            ? t('htmlPreview.truncated', {
                defaultValue:
                  'HTML 生成未完成（内容在样式或标签处被截断），无法预览。请让助手用「写入文件」分屏交付，或说「直接开始做，做完告诉我文件在哪」。',
              })
            : tooLarge
              ? t('htmlPreview.tooLarge', { defaultValue: '页面过大，请打开已保存的 HTML 文件预览' })
              : t('htmlPreview.unavailable', { defaultValue: '预览不可用' })}
        </div>
      );
    }
    return (
      <iframe
        title={t('htmlPreview.frameTitle', { defaultValue: 'HTML 页面预览' })}
        src={previewSrc}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        className={className}
      />
    );
  };

  return (
    <div className="my-3 w-full min-w-0" data-testid="markdown-html-preview">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t('htmlPreview.label', { defaultValue: '页面预览' })}
        </span>
        {previewSrc ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
          >
            <Maximize2 className="h-3 w-3" />
            {t('htmlPreview.expand', { defaultValue: '放大' })}
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <div className="min-h-[280px] w-full min-w-[min(100%,320px)]">
          {frame('h-[min(72vh,560px)] w-full min-w-[min(100%,960px)] border-0 bg-card')}
        </div>
      </div>

      <details
        className="mt-2 rounded-lg border border-border/60 bg-muted/20"
        open={sourceOpen}
        onToggle={(event) => setSourceOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sourceOpen ? 'rotate-180' : ''}`} />
          {t('htmlPreview.viewSource', { defaultValue: '查看 HTML 源码' })}
        </summary>
        <div className="relative border-t border-border/60">
          <button
            type="button"
            onClick={() =>
              copyTextToClipboard(html).then((ok) => {
                if (ok) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }
              })
            }
            className="absolute right-2 top-2 z-10 rounded-md border border-gray-600 bg-gray-700/80 px-2 py-1 text-xs text-primary-foreground"
          >
            {copied ? t('codeBlock.copied') : t('codeBlock.copyCode')}
          </button>
          <SyntaxHighlighter
            language="html"
            style={oneDark}
            customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', maxHeight: '360px' }}
          >
            {html}
          </SyntaxHighlighter>
        </div>
      </details>

      {modalOpen && previewSrc ? (
        <div
          className="fixed inset-0 z-[120] flex flex-col bg-black/70 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-neutral-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 text-xs text-neutral-200">
              <span>{t('htmlPreview.label', { defaultValue: '页面预览' })}</span>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md px-2 py-1 hover:bg-neutral-800">
                {t('htmlPreview.close', { defaultValue: '关闭' })}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-card p-2">
              {frame('h-[min(90vh,900px)] w-full min-w-[min(100%,1200px)] border-0')}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
