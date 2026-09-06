// PD-SAAS-FORK: HyperFrames Studio edit inner — lazy timeline + code + preview
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArtifactContract } from '../../../../shared/artifactContract';
import { normalizeArtifactPath } from '../../../../shared/artifactPaths';
import {
  buildHfEditPrompt,
  dispatchHfDeliverableUpdated,
  dispatchHfStudioPrefill,
} from '../../../../shared/hfStudioBridge';
import {
  resolveHfProjectDirFromApiPath,
  resolvePromoPathFromApiPath,
  resolveTaskDirFromHfPath,
} from '../../../../shared/hfStudioPathResolve';
import { resolveHfProjectIndexPath } from '../../../../shared/hfStudioSupport';
import { renderHfProjectWithPolling } from '../../../../shared/hfStudioApi';
import { api } from '../../../../utils/api';
import HfCodeEditorSurface from './HfCodeEditorSurface';
import HfStudioToolbar from './HfStudioToolbar';
import WebPreviewEmbedded from '../web/WebPreviewEmbedded';

const HfTimelineSurface = lazy(() => import('./HfTimelineSurface'));

type HyperframesStudioEditInnerProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  contract: ArtifactContract;
  hintDir?: string;
  siblings?: string[];
  onRegisterToolbar?: (toolbar: ReactNode | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function HyperframesStudioEditInner({
  projectName,
  projectRoot,
  apiPath,
  hintDir,
  siblings,
  onRegisterToolbar,
  onDirtyChange,
}: HyperframesStudioEditInnerProps) {
  const { t } = useTranslation('chat');
  const taskDir = hintDir ?? resolveTaskDirFromHfPath(apiPath);
  const projectDir = resolveHfProjectDirFromApiPath(apiPath) ?? `${taskDir}/hf-project`;
  const indexPath = resolveHfProjectIndexPath(apiPath, siblings);
  const [activePath, setActivePath] = useState(indexPath);
  const [files, setFiles] = useState<string[]>([indexPath]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const saveHandlerRef = useRef<(() => Promise<string>) | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await api.listProjectFolder(projectName, projectDir);
      if (!response.ok) return;
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const paths = items
        .filter((item: { type?: string; path?: string }) => item.type === 'file')
        .map((item: { path?: string }) => normalizeArtifactPath(String(item.path ?? '')))
        .filter(Boolean);
      if (paths.length > 0) setFiles(paths);
    })();
  }, [projectDir, projectName]);

  const previewUrl = useMemo(
    () => api.projectPreviewUrl(projectName, indexPath, projectRoot ?? ''),
    [indexPath, projectName, projectRoot],
  );

  const persistFile = useCallback(async () => {
    const getContent = saveHandlerRef.current;
    if (!getContent) return;
    const content = await getContent();
    const response = await api.saveFile(projectName, activePath, content);
    if (!response.ok) {
      throw new Error(t('hfStudio.saveFailed', { defaultValue: '暂时无法保存' }) as string);
    }
    setDirty(false);
    dispatchHfDeliverableUpdated({
      promoPath: resolvePromoPathFromApiPath(apiPath),
      taskArtifactDir: taskDir,
    });
  }, [activePath, apiPath, projectName, t, taskDir]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await persistFile();
      setSaveNotice(t('hfStudio.saved', { defaultValue: '已保存' }) as string);
      window.setTimeout(() => setSaveNotice(null), 3000);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [persistFile, t]);

  const handleRender = useCallback(async (quality: 'draft' | 'high') => {
    if (dirty) {
      try {
        await persistFile();
      } catch {
        setRenderNotice(t('hfStudio.renderNeedsSave', { defaultValue: '请先保存后再渲染' }) as string);
        return;
      }
    }
    setRendering(true);
    setRenderNotice(t('hfStudio.rendering', { defaultValue: '正在渲染成片…' }) as string);
    try {
      const promoPath = resolvePromoPathFromApiPath(apiPath) ?? `${taskDir}/promo.mp4`;
      const job = await renderHfProjectWithPolling(projectName, {
        projectDir,
        outputPath: promoPath,
        quality,
        taskArtifactDir: taskDir,
      });
      if (job.status === 'completed') {
        setRenderNotice(t('hfStudio.renderDone', { defaultValue: '成片已更新' }) as string);
      } else {
        setRenderNotice(job.error ?? t('hfStudio.renderFailed', { defaultValue: '渲染未完成' }) as string);
      }
    } catch (error) {
      setRenderNotice(error instanceof Error ? error.message : '渲染失败');
    } finally {
      setRendering(false);
      window.setTimeout(() => setRenderNotice(null), 5000);
    }
  }, [apiPath, dirty, persistFile, projectDir, projectName, t, taskDir]);

  const handleAiAssist = useCallback(() => {
    dispatchHfStudioPrefill(buildHfEditPrompt(activePath));
  }, [activePath]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!onRegisterToolbar) return undefined;
    onRegisterToolbar(
      <HfStudioToolbar
        dirty={dirty}
        saving={saving}
        rendering={rendering}
        onSave={() => { void handleSave(); }}
        onRenderDraft={() => { void handleRender('draft'); }}
        onRenderHigh={() => { void handleRender('high'); }}
        onAiAssist={handleAiAssist}
        saveNotice={saveNotice}
        renderNotice={renderNotice}
      />,
    );
    return () => onRegisterToolbar(null);
  }, [
    dirty,
    handleAiAssist,
    handleRender,
    handleSave,
    onRegisterToolbar,
    renderNotice,
    rendering,
    saveNotice,
    saving,
  ]);

  return (
    <div className="flex h-full min-h-0" data-testid="hf-studio-adapter">
      <div className="flex w-44 shrink-0 flex-col border-r border-border bg-muted/30">
        {files.map((filePath) => (
          <button
            key={filePath}
            type="button"
            className={`truncate px-2 py-1.5 text-left text-xs ${filePath === activePath ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
            onClick={() => setActivePath(filePath)}
          >
            {filePath.split('/').pop()}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-2">
          <HfCodeEditorSurface
            projectName={projectName}
            projectRoot={projectRoot}
            activePath={activePath}
            onDirtyChange={setDirty}
            onContentChange={() => {}}
            registerSaveHandler={(handler) => {
              saveHandlerRef.current = handler;
            }}
          />
          <div className="flex min-h-0 flex-col border-l border-border">
            <WebPreviewEmbedded previewUrl={previewUrl} fileName="index.html" apiPath={indexPath} />
            <Suspense fallback={null}>
              <HfTimelineSurface previewUrl={previewUrl} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
