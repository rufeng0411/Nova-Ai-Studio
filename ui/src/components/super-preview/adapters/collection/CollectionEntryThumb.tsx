import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import type { DeliverableKind } from '../../../../shared/artifactPaths';
import { getArtifactFileName, isImageArtifactPath } from '../../../../shared/artifactPaths';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import { resolvePreviewKind } from '../../../../shared/projectPreviewCapabilities';
import { resolveProjectInlineMediaUrl } from '../../../../shared/projectInlineMediaUrl';
import { isAudioFile } from '../../../code-editor/utils/binaryFile';
import { getFileIconData } from '../../../file-tree/constants/fileIcons';
import ProgressiveProjectImage from '../../../shared/ProgressiveProjectImage';
import { isHtmlPreviewFile } from '../../superPreviewRouting';
import { shouldShowTextSnippetInCollectionThumb } from './collectionThumbPolicy';
import { stripMarkdownForSnippet } from './stripMarkdownForSnippet';

type CollectionEntryThumbProps = {
  projectName: string;
  projectRoot?: string;
  path: string;
  kind: DeliverableKind;
};

function kindShortLabel(kind: DeliverableKind, fileName: string): string {
  if (isAudioFile(fileName)) return '音频';
  switch (kind) {
    case 'html':
      return '网页';
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'pdf':
      return 'PDF';
    case 'document':
      return '文档';
    case 'spreadsheet':
      return '表格';
    case 'presentation':
      return 'PPT';
    case 'code':
      return '代码';
    default:
      return '文件';
  }
}

export function IconFallbackThumb({
  path,
  kind,
}: {
  path: string;
  kind: DeliverableKind;
}) {
  const fileName = getArtifactFileName(path);
  const { icon: Icon, color } = getFileIconData(fileName);
  const IconComponent = Icon ?? FileText;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded bg-muted/80 px-2 text-center">
      <IconComponent className={`h-7 w-7 ${color}`} strokeWidth={1.65} aria-hidden="true" />
      <span className="line-clamp-1 text-[10px] leading-tight text-muted-foreground">
        {kindShortLabel(kind, fileName)}
      </span>
    </div>
  );
}

function ImageEntryThumb({
  projectName,
  projectRoot,
  path,
  kind,
  fileName,
}: {
  projectName: string;
  projectRoot?: string;
  path: string;
  kind: DeliverableKind;
  fileName: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path]);

  if (failed) {
    return <IconFallbackThumb path={path} kind={kind} />;
  }

  return (
    <ProgressiveProjectImage
      key={path}
      projectName={projectName}
      projectRoot={projectRoot}
      filePath={path}
      alt={fileName}
      fullMode="content"
      className="aspect-[4/3] h-full w-full rounded"
      imageClassName="h-full w-full object-cover"
      thumbnailMax={240}
      preloadFull={false}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function TextSnippetThumb({
  projectName,
  projectRoot,
  path,
  kind,
  fileName,
}: {
  projectName: string;
  projectRoot?: string;
  path: string;
  kind: DeliverableKind;
  fileName: string;
}) {
  const [snippet, setSnippet] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void loadProjectTextContent(projectName, path, projectRoot)
      .then((text) => {
        if (cancelled) return;
        const normalized = stripMarkdownForSnippet(text).slice(0, 720);
        if (!normalized) {
          setState('failed');
          return;
        }
        setSnippet(normalized);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [fileName, path, projectName, projectRoot]);

  if (state === 'loading') {
    return <IconFallbackThumb path={path} kind={kind} />;
  }

  if (state === 'failed') {
    return <IconFallbackThumb path={path} kind={kind} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded bg-card">
      <div className="absolute inset-0 overflow-hidden p-2">
        <div className="line-clamp-[16] whitespace-pre-wrap break-words text-[7px] leading-[1.3] text-foreground/85">
          {snippet}
        </div>
      </div>
    </div>
  );
}

function HtmlSnippetThumb({
  projectName,
  projectRoot,
  path,
  fileName,
  kind,
}: {
  projectName: string;
  projectRoot?: string;
  path: string;
  fileName: string;
  kind: DeliverableKind;
}) {
  const previewUrl = useMemo(
    () => resolveProjectInlineMediaUrl(projectName, path, fileName, projectRoot, kind),
    [fileName, kind, path, projectName, projectRoot],
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path, previewUrl]);

  if (!previewUrl || failed) {
    return <IconFallbackThumb path={path} kind={kind} />;
  }

  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden rounded bg-card">
      <iframe
        title={`thumb-${fileName}`}
        src={previewUrl}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        className="absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-0 bg-card"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function VideoEntryThumb({
  previewUrl,
  path,
  kind,
}: {
  previewUrl: string;
  path: string;
  kind: DeliverableKind;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <IconFallbackThumb path={path} kind={kind} />;
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-black">
      <video
        src={previewUrl}
        preload="metadata"
        muted
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function CollectionEntryThumb({
  projectName,
  projectRoot,
  path,
  kind,
}: CollectionEntryThumbProps) {
  const fileName = getArtifactFileName(path);
  const resolvedKind = resolvePreviewKind(fileName, kind);
  const isImage = resolvedKind === 'image' || isImageArtifactPath(path);
  const isVideo = resolvedKind === 'video';
  const isHtml = isHtmlPreviewFile(fileName) || resolvedKind === 'html';
  const isTextSnippet = shouldShowTextSnippetInCollectionThumb(fileName);

  const previewUrl = useMemo(() => {
    if (!projectName || !path) return '';
    return resolveProjectInlineMediaUrl(projectName, path, fileName, projectRoot, resolvedKind);
  }, [fileName, path, projectName, projectRoot, resolvedKind]);

  if (isImage) {
    return (
      <ImageEntryThumb
        projectName={projectName}
        projectRoot={projectRoot}
        path={path}
        kind={resolvedKind}
        fileName={fileName}
      />
    );
  }

  if (isHtml) {
    return (
      <div className="aspect-[4/3] w-full">
        <HtmlSnippetThumb
          projectName={projectName}
          projectRoot={projectRoot}
          path={path}
          fileName={fileName}
          kind={resolvedKind}
        />
      </div>
    );
  }

  if (isVideo && previewUrl) {
    return (
      <VideoEntryThumb previewUrl={previewUrl} path={path} kind={resolvedKind} />
    );
  }

  if (isAudioFile(fileName)) {
    return (
      <div className="aspect-[4/3] w-full">
        <IconFallbackThumb path={path} kind={resolvedKind} />
      </div>
    );
  }

  if (isTextSnippet) {
    return (
      <div className="aspect-[4/3] w-full">
        <TextSnippetThumb
          projectName={projectName}
          projectRoot={projectRoot}
          path={path}
          kind={resolvedKind}
          fileName={fileName}
        />
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] w-full">
      <IconFallbackThumb path={path} kind={resolvedKind} />
    </div>
  );
}
