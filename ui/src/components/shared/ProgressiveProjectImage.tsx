import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../utils/api';
import { isImageFile } from '../code-editor/utils/binaryFile';

// PD-SAAS-FORK: shared thumb-first image primitive for large project deliverables.
type ProgressiveProjectImageProps = {
  alt: string;
  fullSrc?: string;
  thumbnailSrc?: string;
  projectName?: string;
  filePath?: string;
  projectRoot?: string;
  hintDir?: string;
  fullMode?: 'preview' | 'content';
  thumbnailMax?: number;
  thumbnailQuality?: number;
  preloadFull?: boolean;
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
};

export default function ProgressiveProjectImage({
  alt,
  fullSrc,
  thumbnailSrc,
  projectName,
  filePath,
  projectRoot = '',
  hintDir,
  fullMode = 'preview',
  thumbnailMax = 320,
  thumbnailQuality = 75,
  preloadFull = true,
  className = '',
  imageClassName = '',
  loading = 'lazy',
  onError,
}: ProgressiveProjectImageProps) {
  const resolvedFullSrc = useMemo(() => {
    if (fullSrc) return fullSrc;
    if (!projectName || !filePath) return '';
    if (fullMode === 'content') return api.fileContentUrl(projectName, filePath, projectRoot, hintDir);
    // PD-SAAS-FORK: raster images must fall back to inline content, not /preview HTML wrappers.
    if (isImageFile(filePath)) return api.fileContentUrl(projectName, filePath, projectRoot, hintDir);
    return api.projectPreviewUrl(projectName, filePath, projectRoot);
  }, [filePath, fullMode, fullSrc, hintDir, projectName, projectRoot]);

  const resolvedThumbnailSrc = useMemo(() => {
    if (fullMode === 'content') return '';
    if (thumbnailSrc) return thumbnailSrc;
    if (!projectName || !filePath) return '';
    return api.thumbnailUrl(projectName, filePath, {
      max: thumbnailMax,
      q: thumbnailQuality,
      format: 'webp',
      projectRoot,
      hintDir,
    });
  }, [filePath, fullMode, hintDir, projectName, projectRoot, thumbnailQuality, thumbnailMax, thumbnailSrc]);

  const [fullLoaded, setFullLoaded] = useState(!resolvedThumbnailSrc);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    setFullLoaded(!resolvedThumbnailSrc);
    setThumbnailFailed(false);
  }, [resolvedFullSrc, resolvedThumbnailSrc]);

  const showingFull = Boolean(
    resolvedFullSrc
    && (fullLoaded || thumbnailFailed || !resolvedThumbnailSrc),
  );

  const visibleSrc = showingFull ? resolvedFullSrc : resolvedThumbnailSrc;

  const handleVisibleError = useCallback(() => {
    if (!showingFull && resolvedFullSrc) {
      setThumbnailFailed(true);
      return;
    }
    onError?.();
  }, [onError, resolvedFullSrc, showingFull]);

  return (
    <span className={cn('relative block overflow-hidden bg-muted', className)}>
      {preloadFull && resolvedFullSrc && resolvedThumbnailSrc && !fullLoaded && !thumbnailFailed ? (
        <img
          data-testid="progressive-full-preload"
          src={resolvedFullSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          decoding="async"
          onLoad={() => setFullLoaded(true)}
          onError={() => setThumbnailFailed(true)}
        />
      ) : null}
      {visibleSrc ? (
        <img
          src={visibleSrc}
          alt={alt}
          className={cn('block max-h-full max-w-full object-contain transition-opacity', imageClassName)}
          loading={loading}
          decoding="async"
          onError={handleVisibleError}
        />
      ) : null}
    </span>
  );
}
