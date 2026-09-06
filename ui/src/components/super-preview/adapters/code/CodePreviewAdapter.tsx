import { useEffect, useState } from 'react';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import FallbackPreviewAdapter from '../fallback/FallbackPreviewAdapter';
import ReadonlyCodePreview from './ReadonlyCodePreview';

type CodePreviewAdapterProps = {
  projectName: string;
  apiPath: string;
  projectRoot?: string;
  fileName: string;
  embedInChrome?: boolean;
};

export default function CodePreviewAdapter({
  projectName,
  apiPath,
  projectRoot,
  fileName,
  embedInChrome = false,
}: CodePreviewAdapterProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadProjectTextContent(projectName, apiPath, projectRoot)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, projectName, projectRoot]);

  if (error) {
    return <FallbackPreviewAdapter message="代码预览加载失败，请下载后查看。" />;
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <ReadonlyCodePreview
      content={content}
      fileName={fileName}
      embedInChrome={embedInChrome}
    />
  );
}
