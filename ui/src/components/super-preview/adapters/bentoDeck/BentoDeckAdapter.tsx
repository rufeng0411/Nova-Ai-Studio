// PD-SAAS-FORK: Bento deck adapter — view 默认网页预览；edit 仅原生 bento/slides；有损转换已停用
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ExternalLink, RefreshCw, Save } from 'lucide-react';
import type { ArtifactContract } from '../../../../shared/artifactContract';
import { normalizeArtifactPath, scopeDeliverablePathToTurnDir } from '../../../../shared/artifactPaths';
import {
  extractBentoDocFromHtml,
  spliceBentoDocIntoHtml,
  hasBentoDocBlock,
} from '../../../../shared/bentoDocSplice';
import { requestCapabilityTry } from '../../../../shared/capabilityTryBridge';
import { resolveStaticDeckBackupPath } from '../../../../shared/bentoStudioSupport';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import { api } from '../../../../utils/api';
import { PreviewChromeGroup, PreviewChromeIconButton } from '../../PreviewChromeBar';
import WebPreviewEmbedded from '../web/WebPreviewEmbedded';

type BentoDeckSurface = 'web' | 'bento-edit';

type BentoDeckAdapterProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  contract: ArtifactContract;
  mode: 'view' | 'edit';
  hintDir?: string;
  onRegisterToolbar?: (toolbar: ReactNode | null) => void;
  onRegisterRefresh?: (refresh: ReactNode | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onFallbackChange?: (fallback: boolean) => void;
};

const REGENERATE_WYSIWYG_PROMPT =
  '请用「Nova可编辑演示稿」按原主题原生重新生成 deck.bento.html（16:9）：须含品牌配色/字体层级/配图 image+doc.assets、layouts 配方坐标、morph≥2，右栏所见即所得，禁止静态 HTML，直接开始做，做完告诉我文件路径。';

export default function BentoDeckAdapter({
  projectName,
  projectRoot,
  apiPath,
  fileName,
  mode,
  hintDir,
  onRegisterToolbar,
  onRegisterRefresh,
  onDirtyChange,
  onFallbackChange,
}: BentoDeckAdapterProps) {
  const { t } = useTranslation('chat');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const originalHtmlRef = useRef('');
  const [surface, setSurface] = useState<BentoDeckSurface>('web');
  const [editBlocked, setEditBlocked] = useState(false);
  const [validatingEdit, setValidatingEdit] = useState(false);
  const [staticBackupExists, setStaticBackupExists] = useState(false);
  const [viewingStaticOriginal, setViewingStaticOriginal] = useState(false);
  const [repairedDeck, setRepairedDeck] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const normalizedPath = scopeDeliverablePathToTurnDir(normalizeArtifactPath(apiPath), hintDir);
  const staticBackupPath = useMemo(
    () => resolveStaticDeckBackupPath(normalizedPath),
    [normalizedPath],
  );
  const activePreviewPath = viewingStaticOriginal ? staticBackupPath : normalizedPath;
  const previewUrl = useMemo(
    () => api.projectPreviewUrl(projectName, activePreviewPath, projectRoot ?? '', hintDir),
    [activePreviewPath, hintDir, projectName, projectRoot],
  );

  const registerToolbar = onRegisterToolbar ?? (() => {});
  const registerRefresh = onRegisterRefresh ?? (() => {});

  const persistDoc = useCallback(async (doc: unknown) => {
    if (!originalHtmlRef.current) {
      throw new Error('Original HTML not loaded');
    }
    const nextHtml = spliceBentoDocIntoHtml(originalHtmlRef.current, doc);
    const response = await api.saveFile(projectName, normalizedPath, nextHtml);
    if (!response.ok) {
      let message = t('bentoDeck.saveFailed', { defaultValue: '暂时无法保存，请稍后重试' }) as string;
      try {
        const payload = await response.json();
        if (payload?.error) message = String(payload.error);
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    originalHtmlRef.current = nextHtml;
    setDirty(false);
  }, [normalizedPath, projectName, t]);

  const handleRegenerate = useCallback(() => {
    requestCapabilityTry(REGENERATE_WYSIWYG_PROMPT, {
      slug: 'nova-bento-slides',
      displayName: 'Nova可编辑演示稿',
      majorCategory: 'office',
    });
  }, []);

  const refreshStaticBackupExists = useCallback(async () => {
    try {
      const response = await api.resolveProjectFile(projectName, staticBackupPath, hintDir);
      setStaticBackupExists(response.ok);
    } catch {
      setStaticBackupExists(false);
    }
  }, [hintDir, projectName, staticBackupPath]);

  const detectRepairedDeck = useCallback((text: string) => {
    if (!hasBentoDocBlock(text)) {
      setRepairedDeck(false);
      return;
    }
    try {
      const doc = extractBentoDocFromHtml(text) as { meta?: { repairedFrom?: string } };
      setRepairedDeck(doc?.meta?.repairedFrom === 'static-html');
    } catch {
      setRepairedDeck(false);
    }
  }, []);

  useEffect(() => {
    setViewingStaticOriginal(false);
    void refreshStaticBackupExists();
  }, [normalizedPath, refreshStaticBackupExists]);

  useEffect(() => {
    let cancelled = false;
    if (mode === 'view') {
      setSurface('web');
      setEditBlocked(false);
      setValidatingEdit(false);
      onFallbackChange?.(false);
      void loadProjectTextContent(projectName, normalizedPath, projectRoot, { hintDir })
        .then((text) => {
          if (!cancelled) detectRepairedDeck(text);
        })
        .catch(() => {
          if (!cancelled) setRepairedDeck(false);
        });
      return () => { cancelled = true; };
    }

    setValidatingEdit(true);
    setEditBlocked(false);
    setViewingStaticOriginal(false);

    void (async () => {
      try {
        const text = await loadProjectTextContent(projectName, normalizedPath, projectRoot, { hintDir });
        if (cancelled) return;

        if (!hasBentoDocBlock(text)) {
          setEditBlocked(true);
          setSurface('web');
          onFallbackChange?.(true);
          return;
        }

        detectRepairedDeck(text);
        originalHtmlRef.current = text;
        setEditBlocked(false);
        setSurface('bento-edit');
        onFallbackChange?.(false);
      } catch {
        if (cancelled) return;
        setEditBlocked(true);
        setSurface('web');
        onFallbackChange?.(true);
      } finally {
        if (!cancelled) setValidatingEdit(false);
      }
    })();

    return () => { cancelled = true; };
  }, [detectRepairedDeck, hintDir, mode, normalizedPath, onFallbackChange, projectName, projectRoot]);

  useEffect(() => {
    onDirtyChange?.(surface === 'bento-edit' ? dirty : false);
  }, [dirty, onDirtyChange, surface]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || surface !== 'bento-edit') return undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data ?? {};
      if (data.source !== 'bento-slides-shell') return;
      if (data.type === 'bento-doc') {
        void persistDoc(data.doc).then(() => {
          setSaveNotice(t('bentoDeck.saved', { defaultValue: '已保存' }) as string);
          window.setTimeout(() => setSaveNotice(null), 3000);
        }).catch((saveError) => {
          setSaveNotice(saveError instanceof Error ? saveError.message : String(saveError));
        }).finally(() => setSaving(false));
      }
      if (data.type === 'bento-ready') {
        iframe.contentWindow?.postMessage({ type: 'bento-set-mode', mode: 'edit' }, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [persistDoc, surface, t]);

  useEffect(() => {
    if (surface !== 'bento-edit') return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'bento-set-mode', mode: 'edit' }, '*');
  }, [previewUrl, surface]);

  const handleSave = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    setSaving(true);
    setSaveNotice(null);
    iframe.contentWindow.postMessage({ type: 'bento-request-doc' }, '*');
  }, []);

  useEffect(() => {
    if (surface !== 'bento-edit' || !onRegisterToolbar) {
      if (surface === 'bento-edit') onRegisterToolbar?.(null);
      return undefined;
    }
    onRegisterToolbar(
      <PreviewChromeGroup aria-label={t('bentoDeck.toolbar', { defaultValue: 'Bento 编辑' }) as string}>
        <PreviewChromeIconButton
          title={t('bentoDeck.save', { defaultValue: '保存' }) as string}
          onClick={() => { void handleSave(); }}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
        </PreviewChromeIconButton>
        {saveNotice ? <span className="text-xs text-muted-foreground">{saveNotice}</span> : null}
      </PreviewChromeGroup>,
    );
    return () => onRegisterToolbar(null);
  }, [handleSave, onRegisterToolbar, saveNotice, saving, surface, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (surface !== 'bento-edit') return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, surface]);

  const showWebPreview = surface === 'web';
  const showRepairedHint = repairedDeck;
  const showStaticFallbackBanner = editBlocked || showRepairedHint;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="bento-deck-adapter" data-bento-surface={surface}>
      {showStaticFallbackBanner ? (
        <div
          className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          data-testid="bento-deck-fallback-banner"
        >
          <div className="flex flex-wrap items-start gap-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p>
                {editBlocked
                  ? t('bentoDeck.staticPreviewNotice', {
                    defaultValue: '当前为网页版演示稿，预览保留完整版式。Bento 所见即所得须用「Nova可编辑演示稿」原生生成（配色/字体/配图/版式一致），不支持自动转换。',
                  })
                  : t('bentoDeck.repairedPreviewNotice', {
                    defaultValue: '当前 deck 来自旧版有损转换，版式/配图/字体不完整。请点「重新生成」用原生 Bento 重做，以保证右栏所见即所得。',
                  })}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {staticBackupExists ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  onClick={() => setViewingStaticOriginal((prev) => !prev)}
                >
                  <ExternalLink className="size-3" aria-hidden />
                  {viewingStaticOriginal
                    ? t('bentoDeck.backToBentoPreview', { defaultValue: '返回当前预览' })
                    : t('bentoDeck.viewStaticOriginal', { defaultValue: '查看原版式' })}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                onClick={handleRegenerate}
              >
                <RefreshCw className="size-3" aria-hidden />
                {t('bentoDeck.regenerateWysiwyg', { defaultValue: '重新生成（所见即所得）' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {validatingEdit ? (
        <div className="shrink-0 border-b border-border/40 px-3 py-1.5 text-xs text-muted-foreground">
          {t('bentoDeck.validatingEdit', { defaultValue: '正在检查是否可编辑…' })}
        </div>
      ) : null}
      {showWebPreview ? (
        <div className="min-h-0 flex-1" data-testid="bento-deck-web-preview">
          <WebPreviewEmbedded
            previewUrl={previewUrl}
            fileName={viewingStaticOriginal ? 'deck.static.html' : fileName}
            apiPath={activePreviewPath}
            onRegisterToolbar={registerToolbar}
            onRegisterRefresh={registerRefresh}
          />
        </div>
      ) : null}
      {surface === 'bento-edit' ? (
        <iframe
          ref={iframeRef}
          title={t('bentoDeck.iframeTitle', { defaultValue: 'Bento 演示稿' }) as string}
          src={previewUrl}
          className="h-full w-full flex-1 border-0 bg-background"
          data-testid="bento-deck-iframe"
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage({ type: 'bento-set-mode', mode: 'edit' }, '*');
          }}
        />
      ) : null}
    </div>
  );
}
