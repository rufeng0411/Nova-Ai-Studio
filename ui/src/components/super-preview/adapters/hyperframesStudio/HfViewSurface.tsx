// PD-SAAS-FORK: HyperFrames Studio view surface — lightweight iframe + promo video
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../utils/api';
import {
  resolvePromoPathFromApiPath,
  resolveHfHintDir,
} from '../../../../shared/hfStudioPathResolve';
import { isPromoMp4Path, resolveHfProjectIndexPath } from '../../../../shared/hfStudioSupport';
import MediaPreviewAdapter from '../media/MediaPreviewAdapter';
import WebPreviewEmbedded from '../web/WebPreviewEmbedded';

type HfViewSurfaceProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  hintDir?: string;
  siblings?: string[];
  onRegisterToolbar?: (node: React.ReactNode | null) => void;
};

export default function HfViewSurface({
  projectName,
  projectRoot,
  apiPath,
  fileName,
  hintDir,
  siblings,
}: HfViewSurfaceProps) {
  const { t } = useTranslation('chat');
  const scopedHintDir = resolveHfHintDir(apiPath, hintDir);
  const indexPath = resolveHfProjectIndexPath(apiPath, siblings);
  const promoPath = resolvePromoPathFromApiPath(apiPath)
    ?? (scopedHintDir ? `${scopedHintDir}/promo.mp4` : undefined);
  const promoPrimary = isPromoMp4Path(apiPath) || fileName.toLowerCase() === 'promo.mp4';

  const previewUrl = useMemo(
    () => api.projectPreviewUrl(projectName, indexPath, projectRoot ?? ''),
    [projectName, indexPath, projectRoot],
  );

  const promoPreviewUrl = promoPath
    ? api.fileContentUrl(projectName, promoPath, projectRoot ?? '', scopedHintDir)
    : '';

  if (promoPrimary && promoPath) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-testid="hf-studio-view">
        <MediaPreviewAdapter
          projectName={projectName}
          apiPath={promoPath}
          previewUrl={promoPreviewUrl}
          fileName="promo.mp4"
          projectRoot={projectRoot}
          hintDir={scopedHintDir}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="hf-studio-view">
      <div className="flex min-h-0 flex-1 flex-col border-b border-border">
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          {t('hfStudio.view.projectPreview', { defaultValue: '工程预览' })}
        </div>
        <div className="min-h-0 flex-1">
          <WebPreviewEmbedded
            previewUrl={previewUrl}
            fileName="index.html"
            apiPath={indexPath}
          />
        </div>
      </div>
      {promoPreviewUrl ? (
        <div className="h-[38%] min-h-[160px] shrink-0">
          <div className="px-3 py-1.5 text-xs text-muted-foreground">
            {t('hfStudio.view.promoPreview', { defaultValue: '成片预览' })}
          </div>
          <MediaPreviewAdapter
            projectName={projectName}
            apiPath={promoPath ?? 'promo.mp4'}
            previewUrl={promoPreviewUrl}
            fileName="promo.mp4"
            projectRoot={projectRoot}
            hintDir={scopedHintDir}
          />
        </div>
      ) : null}
    </div>
  );
}
