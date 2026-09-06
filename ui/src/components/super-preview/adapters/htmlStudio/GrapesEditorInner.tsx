// PD-SAAS-FORK: GrapesJS inner — loaded dynamically to keep bundle lean in view mode
import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import type { ArtifactContract } from '../../../../shared/artifactContract';

type GrapesEditorInnerProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  contract: ArtifactContract;
  initialHtml: string;
  onHtmlChange?: (html: string) => void;
  registerSaveHandler?: (handler: () => Promise<string>) => void;
};

export default function GrapesEditorInner({
  initialHtml,
  onHtmlChange,
  registerSaveHandler,
}: GrapesEditorInnerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<typeof grapesjs.init> | null>(null);
  const latestHtmlRef = useRef(initialHtml);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const editor = grapesjs.init({
      container: hostRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      panels: { defaults: [] },
      canvas: {
        styles: [],
      },
    });
    editor.setComponents(DOMPurify.sanitize(initialHtml));
    editorRef.current = editor;

    const sync = () => {
      const html = editor.getHtml();
      const css = editor.getCss();
      const combined = `<style>${css}</style>${html}`;
      latestHtmlRef.current = combined;
      onHtmlChange?.(combined);
    };
    editor.on('update', sync);

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [initialHtml, onHtmlChange]);

  useEffect(() => {
    registerSaveHandler?.(async () => latestHtmlRef.current);
  }, [registerSaveHandler]);

  return (
    <div className="html-studio-grapes flex h-full min-h-0 flex-col bg-sidebar" data-testid="html-studio-visual-surface">
      <style>{`
        .html-studio-grapes .gjs-one-bg { background-color: hsl(var(--sidebar)); }
        .html-studio-grapes .gjs-two-color { color: hsl(var(--foreground)); }
        .html-studio-grapes .gjs-three-bg { background-color: hsl(var(--card)); border-color: hsl(var(--border)); }
        .html-studio-grapes .gjs-pn-panel { display: none; }
      `}</style>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
}
