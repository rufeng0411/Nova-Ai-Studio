// PD-SAAS-FORK: GrapesJS visual editor surface (Phase 2) — dynamic import + Nova chrome
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import type { ArtifactContract } from '../../../../shared/artifactContract';

const GrapesEditor = lazy(() => import('./GrapesEditorInner'));

type VisualEditorSurfaceProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  contract: ArtifactContract;
  onHtmlChange?: (html: string) => void;
  registerSaveHandler?: (handler: () => Promise<string>) => void;
};

export default function VisualEditorSurface(props: VisualEditorSurfaceProps) {
  const { t } = useTranslation('chat');
  const [initialHtml, setInitialHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await loadProjectTextContent(props.projectName, props.apiPath, props.projectRoot);
        if (!cancelled) setInitialHtml(raw);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.apiPath, props.projectName, props.projectRoot]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-sidebar text-sm text-muted-foreground">
        {t('htmlStudio.loadingVisual', { defaultValue: '加载视觉编辑器…' })}
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">…</div>}>
      <GrapesEditor {...props} initialHtml={initialHtml} />
    </Suspense>
  );
}
