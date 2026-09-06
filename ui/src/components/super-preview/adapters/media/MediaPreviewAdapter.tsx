import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../../../utils/api';
import { isAudioFile, isVideoFile } from '../../../code-editor/utils/binaryFile';

type MediaPreviewAdapterProps = {
  projectName: string;
  apiPath: string;
  previewUrl: string;
  fileName: string;
  projectRoot?: string;
  hintDir?: string;
};

export default function MediaPreviewAdapter({
  projectName,
  apiPath,
  previewUrl,
  fileName,
  projectRoot,
  hintDir,
}: MediaPreviewAdapterProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const needsBlob = isAudioFile(fileName) || isVideoFile(fileName);
  const source = blobUrl ?? previewUrl;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!needsBlob || !projectName || !apiPath) return undefined;
    api.readFileBlob(projectName, apiPath, { projectRoot, hintDir })
      .then((response: Response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiPath, fileName, hintDir, needsBlob, projectName, projectRoot]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2 text-neutral-200">
        <div className="min-w-0 truncate text-xs">{fileName}</div>
        {source ? (
          <a
            href={source}
            download={fileName}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            下载
          </a>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        {isAudioFile(fileName) ? (
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-white/5 p-5 text-neutral-100 shadow-xl">
            <div className="mb-3 truncate text-sm font-medium">{fileName}</div>
            <audio src={source} controls className="w-full" />
          </div>
        ) : (
          <video src={source} controls playsInline preload="metadata" className="max-h-full max-w-full bg-black">
            <track kind="captions" />
            {fileName}
          </video>
        )}
      </div>
    </div>
  );
}
