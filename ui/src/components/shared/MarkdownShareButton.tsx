// PD-SAAS-FORK: Markdown 预览顶栏分享按钮（公开 /s/{id}）
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { shareMarkdownDocument } from '../../shared/markdownShareAction';
import type { MarkdownShareTarget } from '../../shared/markdownShareUrl';
import { PreviewChromeIconButton } from '../super-preview/PreviewChromeBar';

export type MarkdownShareButtonProps = {
  target: MarkdownShareTarget;
  className?: string;
  variant?: 'editor' | 'overlay';
};

export default function MarkdownShareButton({
  target,
  className,
  variant = 'editor',
}: MarkdownShareButtonProps) {
  const { t } = useTranslation('chat');
  const [busy, setBusy] = useState(false);

  const label = t('deliverables.shareMarkdown', { defaultValue: '分享' });
  const hint = t('deliverables.shareMarkdownHtmlHint', {
    defaultValue: '以独立网页分享，无需登录即可阅读，可保存 PDF/Word',
  });

  const handleShare = () => {
    if (busy) return;
    setBusy(true);
    void shareMarkdownDocument(target)
      .then((result) => {
        if (result.outcome === 'disabled') {
          window.alert(t('deliverables.shareMarkdownDisabled', { defaultValue: '公开分享暂不可用' }));
          return;
        }
        if (result.outcome === 'shadow') {
          window.alert(
            t('deliverables.shareMarkdownShadow', {
              defaultValue: '已记录分享（灰度中），公开页尚未对外开放',
            }),
          );
          return;
        }
        if (result.outcome === 'copied') {
          window.alert(t('deliverables.shareMarkdownCopied', { defaultValue: '链接已复制' }));
          return;
        }
        if (result.outcome === 'error') {
          window.alert(
            t('deliverables.shareMarkdownFailed', {
              defaultValue: '分享失败，请稍后重试',
            }),
          );
        }
      })
      .finally(() => setBusy(false));
  };

  if (variant === 'overlay') {
    const overlayBtn =
      'inline-flex min-h-[44px] items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card/10 hover:text-primary-foreground max-md:min-h-[44px] max-md:px-2';
    return (
      <button
        type="button"
        className={overlayBtn}
        title={hint}
        aria-label={label}
        onClick={handleShare}
        disabled={busy}
        data-testid="markdown-share-button"
      >
        <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </button>
    );
  }

  return (
    <PreviewChromeIconButton
      type="button"
      className={className}
      title={hint}
      aria-label={label}
      onClick={handleShare}
      disabled={busy}
      data-testid="markdown-share-button"
    >
      <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
    </PreviewChromeIconButton>
  );
}
