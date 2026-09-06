// PD-SAAS-FORK: icon-only @ reference for unified preview chrome
import { useCallback, useMemo, useState } from 'react';
import { AtSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ArtifactScope } from '../../shared/artifactScope';
import { resolveArtifactReferencePaths } from '../../shared/artifactReferencePaths';
import { requestFileReferences } from '../../shared/fileReferenceBridge';
import { PreviewChromeIconButton } from './PreviewChromeBar';

type SuperPreviewReferenceButtonProps = {
  artifactScope: ArtifactScope;
  siblings?: string[];
};

export default function SuperPreviewReferenceButton({
  artifactScope,
  siblings,
}: SuperPreviewReferenceButtonProps) {
  const { t } = useTranslation('common');
  const [feedback, setFeedback] = useState<'idle' | 'ok' | 'fail'>('idle');
  const paths = useMemo(
    () => resolveArtifactReferencePaths(artifactScope, { siblings }),
    [artifactScope, siblings],
  );
  const disabled = paths.length === 0;

  const handleClick = useCallback(() => {
    const ok = requestFileReferences(paths);
    setFeedback(ok ? 'ok' : 'fail');
    window.setTimeout(() => setFeedback('idle'), 2200);
  }, [paths]);

  const label = t('superPreview.referenceLabel', { defaultValue: '引用' });
  const title = disabled
    ? t('superPreview.referenceDisabled', { defaultValue: '暂无可引用的文件' })
    : feedback === 'ok'
      ? t('superPreview.referenceAdded', { defaultValue: '已加入对话引用' })
      : feedback === 'fail'
        ? t('superPreview.referenceNoChat', { defaultValue: '请打开对话页后再引用' })
        : t('superPreview.referenceHint', {
          defaultValue: '引用到对话输入框（{{count}} 个文件）',
          count: paths.length,
        });

  return (
    <PreviewChromeIconButton
      data-testid="super-preview-reference"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      active={feedback === 'ok'}
      className={
        feedback === 'fail'
          ? 'border border-amber-500/40 text-amber-700 dark:text-amber-200'
          : undefined
      }
    >
      <AtSign className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
    </PreviewChromeIconButton>
  );
}
