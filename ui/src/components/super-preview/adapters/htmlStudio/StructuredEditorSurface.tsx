// PD-SAAS-FORK: FieldEditor — Shadow DOM isolates CSS; ref-based dirty avoids focus loss on keystroke
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import {
  applyPatches,
  buildHtmlStudioEditorShadowHtml,
  inlineSiblingStyles,
  prepareEditableHtml,
  type HtmlFieldDescriptor,
  type HtmlFieldPatch,
} from '../../../../shared/htmlPatchEngine';
import { detectHtmlStudioProfile } from '../../../../shared/htmlStudioSupport';
import type { ArtifactContract } from '../../../../shared/artifactContract';

type StructuredEditorSurfaceProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  contract: ArtifactContract;
  onDirtyChange?: (dirty: boolean) => void;
  onInitialHtml?: (html: string) => void;
  onHtmlChange?: (html: string) => void;
  registerSaveHandler?: (handler: () => Promise<string>) => void;
  registerUndoHandlers?: (handlers: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  }) => void;
};

const LINKED_ASSET_RE = /<link[^>]+href=["']([^"']+\.(?:css|js))["'][^>]*>/gi;

function dirnamePosix(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '';
}

function resolveLinkedAssetPath(htmlDir: string, href: string): string | null {
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) return null;
  const clean = href.replace(/^\./, '');
  if (clean.startsWith('/')) return clean.replace(/^\/+/, '');
  return `${htmlDir}/${clean}`.replace(/\/+/g, '/');
}

function extractStyles(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('style'))
    .map((node) => node.textContent ?? '')
    .join('\n');
}

function collectPatchesFromRoot(root: ParentNode | null | undefined): HtmlFieldPatch[] {
  if (!root) return [];
  const patches: HtmlFieldPatch[] = [];
  root.querySelectorAll('[data-nova-field-id]').forEach((node) => {
    const el = node as HTMLElement;
    const fieldId = el.getAttribute('data-nova-field-id');
    if (!fieldId) return;
    patches.push({
      id: fieldId,
      text: el.innerText.replace(/\u00a0/g, ' ').trim(),
      html: DOMPurify.sanitize(el.innerHTML),
    });
  });
  return patches;
}

export default function StructuredEditorSurface({
  projectName,
  projectRoot,
  apiPath,
  fileName,
  contract,
  onDirtyChange,
  onInitialHtml,
  onHtmlChange,
  registerSaveHandler,
  registerUndoHandlers,
}: StructuredEditorSurfaceProps) {
  const { t } = useTranslation('chat');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<HtmlFieldDescriptor[]>([]);
  const [editorPayload, setEditorPayload] = useState<{
    html: string;
    css: string;
  } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const workingHtmlRef = useRef('');
  const injectedCssRef = useRef('');
  const profileRef = useRef<'ngrs' | 'generic' | 'slide'>('generic');
  const patchMapRef = useRef(new Map<string, HtmlFieldPatch>());
  const dirtyRef = useRef(false);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const wireCleanupRef = useRef<(() => void) | null>(null);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  const markDirty = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    onDirtyChangeRef.current?.(true);
  }, []);

  const clearDirty = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    onDirtyChangeRef.current?.(false);
  }, []);

  const wireShadowInput = useCallback((shadow: ShadowRoot) => {
    wireCleanupRef.current?.();
    const cleanups: Array<() => void> = [];
    shadow.querySelectorAll('[data-nova-field-id]').forEach((node) => {
      const el = node as HTMLElement;
      const fieldId = el.getAttribute('data-nova-field-id');
      if (!fieldId) return;
      const onInput = () => {
        patchMapRef.current.set(fieldId, {
          id: fieldId,
          text: el.innerText.replace(/\u00a0/g, ' ').trim(),
          html: DOMPurify.sanitize(el.innerHTML),
        });
        markDirty();
      };
      const onMouseDown = (event: MouseEvent) => {
        event.stopPropagation();
        window.requestAnimationFrame(() => el.focus());
      };
      el.addEventListener('input', onInput);
      el.addEventListener('blur', onInput);
      el.addEventListener('mousedown', onMouseDown);
      cleanups.push(() => {
        el.removeEventListener('input', onInput);
        el.removeEventListener('blur', onInput);
        el.removeEventListener('mousedown', onMouseDown);
      });
    });
    const stopBubble = (event: Event) => {
      event.stopPropagation();
    };
    shadow.addEventListener('keydown', stopBubble, true);
    shadow.addEventListener('keyup', stopBubble, true);
    cleanups.push(() => {
      shadow.removeEventListener('keydown', stopBubble, true);
      shadow.removeEventListener('keyup', stopBubble, true);
    });
    wireCleanupRef.current = () => cleanups.forEach((fn) => fn());
    return wireCleanupRef.current;
  }, [markDirty]);

  const mountEditor = useCallback((annotatedHtml: string, documentCss: string) => {
    const host = hostRef.current;
    if (!host) return;
    let shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: 'open' });
      shadowRef.current = shadow;
    }
    wireCleanupRef.current?.();
    shadow.innerHTML = buildHtmlStudioEditorShadowHtml(annotatedHtml, documentCss);
    wireShadowInput(shadow);
  }, [wireShadowInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditorPayload(null);
    (async () => {
      try {
        const raw = await loadProjectTextContent(projectName, apiPath, projectRoot);
        if (cancelled) return;
        const htmlDir = dirnamePosix(apiPath);
        const styleContents: string[] = [];
        LINKED_ASSET_RE.lastIndex = 0;
        let linkMatch: RegExpExecArray | null = LINKED_ASSET_RE.exec(raw);
        while (linkMatch) {
          const assetPath = resolveLinkedAssetPath(htmlDir, linkMatch[1]);
          if (assetPath && assetPath.endsWith('.css')) {
            try {
              styleContents.push(await loadProjectTextContent(projectName, assetPath, projectRoot));
            } catch {
              // optional sibling css
            }
          }
          linkMatch = LINKED_ASSET_RE.exec(raw);
        }
        const enriched = inlineSiblingStyles(raw, styleContents);
        const detectedProfile = detectHtmlStudioProfile(contract, fileName, enriched);
        profileRef.current = detectedProfile;
        const { html: annotatedHtml, fields: parsedFields } = prepareEditableHtml(enriched, detectedProfile);
        const documentCss = `${extractStyles(enriched)}\n${styleContents.join('\n')}`;
        workingHtmlRef.current = annotatedHtml;
        injectedCssRef.current = documentCss;
        patchMapRef.current = new Map();
        dirtyRef.current = false;
        undoStack.current = [];
        redoStack.current = [];
        setFields(parsedFields);
        setEditorPayload({ html: annotatedHtml, css: documentCss });
        onInitialHtml?.(annotatedHtml);
        onDirtyChangeRef.current?.(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      wireCleanupRef.current?.();
    };
  }, [apiPath, contract, fileName, onInitialHtml, projectName, projectRoot]);

  useEffect(() => {
    if (!editorPayload) return undefined;
    mountEditor(editorPayload.html, editorPayload.css);
    return () => wireCleanupRef.current?.();
  }, [editorPayload, mountEditor]);

  const commitPatches = useCallback((
    patchesOverride?: HtmlFieldPatch[],
  ): string => {
    const shadow = shadowRef.current;
    const active = shadow?.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const patches = patchesOverride
      ?? collectPatchesFromRoot(shadow)
      ?? Array.from(patchMapRef.current.values());
    if (patches.length === 0) return workingHtmlRef.current;
    undoStack.current.push(workingHtmlRef.current);
    redoStack.current = [];
    const next = applyPatches(workingHtmlRef.current, patches, profileRef.current);
    const reprepared = prepareEditableHtml(next, profileRef.current);
    workingHtmlRef.current = reprepared.html;
    setFields(reprepared.fields);
    mountEditor(reprepared.html, injectedCssRef.current);
    patchMapRef.current = new Map();
    clearDirty();
    onHtmlChange?.(reprepared.html);
    return reprepared.html;
  }, [clearDirty, mountEditor, onHtmlChange]);

  const saveHandlerRef = useRef<() => Promise<string>>(async () => workingHtmlRef.current);
  saveHandlerRef.current = async () => {
    const patches = collectPatchesFromRoot(shadowRef.current);
    return commitPatches(patches);
  };

  useEffect(() => {
    registerSaveHandler?.(async () => saveHandlerRef.current());
  }, [registerSaveHandler]);

  const registerUndoHandlersRef = useRef(registerUndoHandlers);
  registerUndoHandlersRef.current = registerUndoHandlers;

  const publishUndoHandlers = useCallback(() => {
    registerUndoHandlersRef.current?.({
      undo: () => {
        const prev = undoStack.current.pop();
        if (!prev) return;
        redoStack.current.push(workingHtmlRef.current);
        const reprepared = prepareEditableHtml(prev, profileRef.current);
        workingHtmlRef.current = reprepared.html;
        setFields(reprepared.fields);
        mountEditor(reprepared.html, injectedCssRef.current);
        patchMapRef.current = new Map();
        clearDirty();
        onHtmlChange?.(reprepared.html);
        publishUndoHandlers();
      },
      redo: () => {
        const next = redoStack.current.pop();
        if (!next) return;
        undoStack.current.push(workingHtmlRef.current);
        const reprepared = prepareEditableHtml(next, profileRef.current);
        workingHtmlRef.current = reprepared.html;
        setFields(reprepared.fields);
        mountEditor(reprepared.html, injectedCssRef.current);
        patchMapRef.current = new Map();
        clearDirty();
        onHtmlChange?.(reprepared.html);
        publishUndoHandlers();
      },
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    });
  }, [clearDirty, mountEditor, onHtmlChange]);

  useEffect(() => {
    publishUndoHandlers();
  }, [publishUndoHandlers]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-sidebar" data-testid="html-studio-structured-surface">
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('htmlStudio.loading', { defaultValue: '加载中…' })}
        </div>
        <div ref={hostRef} className="hidden" aria-hidden data-testid="html-studio-editor-host" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-sidebar p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar" data-testid="html-studio-structured-surface">
      {fields.length === 0 ? (
        <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('htmlStudio.noEditableFields', {
            defaultValue: '未检测到可编辑文本，请切回查看或使用「请 AI 协助」修改版式。',
          })}
        </div>
      ) : null}
      <div
        className="min-h-0 flex-1 overflow-auto bg-sidebar p-3"
        onKeyDownCapture={(event) => event.stopPropagation()}
        onKeyUpCapture={(event) => event.stopPropagation()}
      >
        <div className="mx-auto min-h-[480px] w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div
            ref={hostRef}
            className="block min-h-[480px] w-full"
            data-testid="html-studio-editor-host"
            onMouseDownCapture={(event) => event.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}
