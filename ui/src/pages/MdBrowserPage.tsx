// PD-SAAS-FORK: 独立 Markdown 浏览器工具页（Cherry Core + Nova 顶栏；全页拖放载入）
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, Save } from 'lucide-react';
import novaLogoMark from '../saas/brand/novaLogoMark';
import { isMdBrowserToolEnabled, subscribeMdBrowserToolEnabled } from '../shared/mdBrowserGate';
import {
  isMarkdownFile,
  pickLocalMarkdownFile,
  readRememberedMdBrowserProject,
  rememberMdBrowserProject,
  saveMarkdownAs,
  takeMdBrowserPayload,
} from '../shared/mdBrowserOpen';
import { resolveMdBrowserExportProject } from '../shared/mdBrowserExport';
import { useDocumentMdFileDrop } from '../shared/useMdFileDropZone';
import NovaLoadingScreen from '../saas/brand/NovaLoadingScreen';
import MdDropOverlay from '../components/md-browser/MdDropOverlay';
import MdBrowserExportButtons from '../components/md-browser/MdBrowserExportButtons';

const CherryMarkdownCoreEditor = lazy(() => import('../components/md-browser/CherryMarkdownCoreEditor'));

type EditorApi = {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
};

export default function MdBrowserPage() {
  const { t } = useTranslation('templatesHub');
  const [searchParams] = useSearchParams();
  const editorApiRef = useRef<EditorApi | null>(null);
  const [fileName, setFileName] = useState('untitled.md');
  const [initialValue, setInitialValue] = useState('# Markdown\n\n');
  const [editorKey, setEditorKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(() => isMdBrowserToolEnabled());
  const [exportProject, setExportProject] = useState<string | null>(
    () => searchParams.get('project') || readRememberedMdBrowserProject(),
  );

  useEffect(() => {
    setEnabled(isMdBrowserToolEnabled());
    return subscribeMdBrowserToolEnabled(() => setEnabled(isMdBrowserToolEnabled()));
  }, []);

  useEffect(() => {
    document.title = t('mdBrowserWindowTitle', { defaultValue: 'Markdown 浏览器 · Nova Ai Studio' });
  }, [t]);

  useEffect(() => {
    const fromQuery = searchParams.get('project');
    if (fromQuery?.trim()) {
      rememberMdBrowserProject(fromQuery);
      setExportProject(fromQuery.trim());
      return;
    }
    void resolveMdBrowserExportProject(readRememberedMdBrowserProject()).then((name) => {
      if (name) {
        rememberMdBrowserProject(name);
        setExportProject(name);
      }
    });
  }, [searchParams]);

  const loadMarkdownContent = useCallback(
    (content: string, name: string) => {
      setFileName(name || 'untitled.md');
      setInitialValue(content);
      setEditorKey((n) => n + 1);
      setStatus(t('mdBrowserOpened', { defaultValue: '已打开本地文件' }));
    },
    [t],
  );

  useEffect(() => {
    const sid = searchParams.get('sid');
    if (!sid) {
      setReady(true);
      return;
    }
    const payload = takeMdBrowserPayload(sid);
    if (payload) {
      setFileName(payload.fileName);
      setInitialValue(payload.content);
      setEditorKey((n) => n + 1);
    }
    setReady(true);
  }, [searchParams]);

  const handleEditorReady = useCallback((api: EditorApi) => {
    editorApiRef.current = api;
  }, []);

  const getMarkdown = useCallback(
    () => editorApiRef.current?.getMarkdown() ?? initialValue,
    [initialValue],
  );

  const handleOpen = useCallback(async () => {
    const picked = await pickLocalMarkdownFile();
    if (!picked) return;
    loadMarkdownContent(picked.content, picked.fileName);
  }, [loadMarkdownContent]);

  const handleSaveAs = useCallback(async () => {
    const content = editorApiRef.current?.getMarkdown() ?? initialValue;
    const result = await saveMarkdownAs(content, fileName);
    if (result === 'cancelled') return;
    setStatus(
      result === 'saved'
        ? t('mdBrowserSaved', { defaultValue: '已另存为' })
        : t('mdBrowserDownloaded', { defaultValue: '已下载到本地' }),
    );
  }, [fileName, initialValue, t]);

  const handleDroppedMarkdown = useCallback(
    async (files: File[]) => {
      const md = files.find((f) => isMarkdownFile(f));
      if (!md) return;
      const content = await md.text();
      loadMarkdownContent(content, md.name || 'untitled.md');
    },
    [loadMarkdownContent],
  );

  // document capture：整窗（含 Cherry 编辑区）都是拖放载入区
  const { isDragActive } = useDocumentMdFileDrop({
    enabled: enabled && ready,
    onMarkdownFiles: handleDroppedMarkdown,
  });

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
        {t('mdBrowserDisabled', { defaultValue: 'Markdown 浏览器未开启' })}
      </div>
    );
  }

  if (!ready) {
    return (
      <NovaLoadingScreen
        label={t('mdBrowserLoading', { defaultValue: '正在打开 Markdown 浏览器…' })}
        ariaLabel={t('mdBrowserLoading', { defaultValue: '正在打开 Markdown 浏览器…' })}
      />
    );
  }

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col bg-background text-foreground"
      data-testid="md-browser-page"
    >
      <MdDropOverlay active={isDragActive} mode="load" />
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border/80 bg-card/80 px-3 py-2 backdrop-blur-sm md:px-4">
        <img
          src={novaLogoMark}
          alt="Nova"
          width={22}
          height={22}
          className="h-5.5 w-5.5 shrink-0 object-contain"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight">
            {t('mdBrowserWindowHeading', { defaultValue: 'Markdown 浏览器' })}
          </div>
          <div className="truncate text-[11px] text-muted-foreground" title={fileName}>
            {fileName}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => void handleOpen()}
            data-testid="md-browser-open"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            {t('mdBrowserOpen', { defaultValue: '打开' })}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => void handleSaveAs()}
            data-testid="md-browser-save-as"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {t('mdBrowserSaveAs', { defaultValue: '另存为' })}
          </button>
          <MdBrowserExportButtons
            projectName={exportProject}
            getMarkdown={getMarkdown}
            fileName={fileName}
            onStatus={setStatus}
          />
        </div>
      </header>
      {status ? (
        <div className="relative z-10 shrink-0 border-b border-border/50 px-4 py-1 text-[11px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <main className="relative z-0 min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={(
            <NovaLoadingScreen
              label={t('mdBrowserLoadingEditor', { defaultValue: '正在加载编辑器…' })}
              ariaLabel={t('mdBrowserLoadingEditor', { defaultValue: '正在加载编辑器…' })}
            />
          )}
        >
          <CherryMarkdownCoreEditor
            key={editorKey}
            initialValue={initialValue}
            onReady={handleEditorReady}
          />
        </Suspense>
      </main>
    </div>
  );
}
