// PD-SAAS-FORK: shared markdown preview for overlay and sidebar pipeline
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadProjectTextContent } from '../../shared/loadProjectTextContent';
import MarkdownPreview from '../code-editor/view/subcomponents/markdown/MarkdownPreview';

export type ProjectMarkdownPreviewProps = {
  projectName: string;
  apiPath: string;
  projectRoot?: string;
  hintDir?: string;
  className?: string;
};

export function ProjectMarkdownPreview({
  projectName,
  apiPath,
  projectRoot,
  hintDir,
  className = '',
}: ProjectMarkdownPreviewProps) {
  const { t } = useTranslation('chat');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const load = async () => {
      try {
        const text = await loadProjectTextContent(projectName, apiPath, projectRoot, { hintDir });
        if (!cancelled) {
          setContent(text);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiPath, hintDir, projectName, projectRoot]);

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center text-sm text-muted-foreground ${className}`.trim()}>
        {t('deliverables.loadingPreview', { defaultValue: '正在加载预览…' })}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground ${className}`.trim()}>
        {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
      </div>
    );
  }

  return (
    <div className={`h-full w-full overflow-y-auto bg-background ${className}`.trim()}>
      <div className="prose prose-sm prose-neutral mx-auto max-w-none px-8 py-6 dark:prose-invert prose-headings:font-semibold prose-a:text-foreground prose-a:underline prose-code:text-[13px] prose-pre:bg-primary prose-img:rounded-lg dark:prose-a:text-neutral-100">
        <MarkdownPreview content={content} />
      </div>
    </div>
  );
}

export default ProjectMarkdownPreview;
