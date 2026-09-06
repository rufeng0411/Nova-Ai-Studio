// PD-SAAS-FORK: HTML Studio adapter — FieldEditor + optional VisualEditor, save + backup
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArtifactContract } from '../../../../shared/artifactContract';
import { normalizeArtifactPath } from '../../../../shared/artifactPaths';
import {
  buildHtmlEditPrompt,
  dispatchHtmlDeliverableUpdated,
  dispatchHtmlStudioPrefill,
} from '../../../../shared/htmlStudioBridge';
import { stripHtmlStudioEditorAttributes } from '../../../../shared/htmlPatchEngine';
import { detectHtmlStudioProfile } from '../../../../shared/htmlStudioSupport';
import { api } from '../../../../utils/api';
import StructuredEditorSurface from './StructuredEditorSurface';
import VisualEditorSurface from './VisualEditorSurface';
import HtmlStudioToolbar from './HtmlStudioToolbar';

type HtmlStudioAdapterProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  contract: ArtifactContract;
  visualMode?: boolean;
  onRegisterToolbar?: (toolbar: ReactNode | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function HtmlStudioAdapter({
  projectName,
  projectRoot,
  apiPath,
  fileName,
  contract,
  visualMode = false,
  onRegisterToolbar,
  onDirtyChange,
}: HtmlStudioAdapterProps) {
  const { t } = useTranslation('chat');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const latestHtmlRef = useRef('');
  const saveHandlerRef = useRef<(() => Promise<string>) | null>(null);
  const undoRef = useRef<{ undo: () => void; redo: () => void } | null>(null);

  const registerSaveHandlerStable = useCallback((handler: () => Promise<string>) => {
    saveHandlerRef.current = handler;
  }, []);

  const registerUndoHandlersStable = useCallback((handlers: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  }) => {
    undoRef.current = handlers;
    setCanUndo(handlers.canUndo);
    setCanRedo(handlers.canRedo);
  }, []);

  const persistHtml = useCallback(async (html: string) => {
    const normalizedPath = normalizeArtifactPath(apiPath);
    const cleanHtml = stripHtmlStudioEditorAttributes(html);
    const backupDir = `${normalizedPath.replace(/\/[^/]+$/, '')}/.nova-edit-backups`;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      if (latestHtmlRef.current && latestHtmlRef.current !== cleanHtml) {
        await api.saveFile(projectName, `${backupDir}/backup-${stamp}.html`, latestHtmlRef.current).catch(() => {});
      }
    } catch {
      // backup best-effort
    }
    const response = await api.saveFile(projectName, normalizedPath, cleanHtml);
    if (!response.ok) {
      let message = `保存失败（${response.status}）`;
      try {
        const payload = await response.json();
        if (payload?.error) message = String(payload.error);
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
    latestHtmlRef.current = cleanHtml;
    setDirty(false);
    dispatchHtmlDeliverableUpdated({ htmlPath: normalizedPath, projectName });
  }, [apiPath, projectName]);

  const handleSave = useCallback(async () => {
    if (!saveHandlerRef.current) return;
    setSaving(true);
    try {
      const html = await saveHandlerRef.current();
      await persistHtml(html);
      setSaveNotice(t('htmlStudio.saved', { defaultValue: '已保存' }) as string);
      window.setTimeout(() => setSaveNotice(null), 3000);
    } catch (saveError) {
      setSaveNotice(
        t('htmlStudio.saveFailed', {
          defaultValue: '暂时无法保存，请稍后重试或通过对话修改',
        }) as string,
      ); 
      console.error('[html-studio] save failed', saveError);
    } finally {
      setSaving(false);
    }
  }, [persistHtml, t]);

  const handleAiAssist = useCallback(() => {
    dispatchHtmlStudioPrefill({
      htmlPath: apiPath,
      instruction: buildHtmlEditPrompt(
        [apiPath],
        t('htmlStudio.aiAssistDefault', {
          defaultValue: '请帮我优化这份 HTML 报告的版式与文案，保持图表脚本不变。',
        }) as string,
      ),
      force: true,
    });
  }, [apiPath, t]);

  useEffect(() => {
    if (!onRegisterToolbar) return undefined;
    onRegisterToolbar(
      <HtmlStudioToolbar
        dirty={dirty}
        saving={saving}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={() => {
          void handleSave();
        }}
        onUndo={() => undoRef.current?.undo()}
        onRedo={() => undoRef.current?.redo()}
        onAiAssist={handleAiAssist}
        saveNotice={saveNotice}
      />,
    );
    return () => onRegisterToolbar(null);
  }, [canRedo, canUndo, dirty, handleAiAssist, handleSave, onRegisterToolbar, saveNotice, saving]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty) void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirty, handleSave]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const profile = detectHtmlStudioProfile(contract, fileName, latestHtmlRef.current);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="html-studio-adapter">
      {visualMode && profile !== 'ngrs' ? (
        <VisualEditorSurface
          projectName={projectName}
          projectRoot={projectRoot}
          apiPath={apiPath}
          contract={contract}
          onHtmlChange={(html) => {
            latestHtmlRef.current = html;
            setDirty(true);
          }}
          registerSaveHandler={(handler) => {
            saveHandlerRef.current = handler;
          }}
        />
      ) : (
        <StructuredEditorSurface
          projectName={projectName}
          projectRoot={projectRoot}
          apiPath={apiPath}
          fileName={fileName}
          contract={contract}
          onDirtyChange={setDirty}
          onInitialHtml={(html) => {
            latestHtmlRef.current = stripHtmlStudioEditorAttributes(html);
          }}
          onHtmlChange={(html) => {
            latestHtmlRef.current = html;
          }}
          registerSaveHandler={registerSaveHandlerStable}
          registerUndoHandlers={registerUndoHandlersStable}
        />
      )}
    </div>
  );
}
