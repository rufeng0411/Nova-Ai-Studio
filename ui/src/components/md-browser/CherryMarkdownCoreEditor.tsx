// PD-SAAS-FORK: Cherry Markdown core editor (lazy-loaded; no Mermaid)
import { useEffect, useId, useRef } from 'react';

type CherryInstance = {
  getMarkdown?: () => string;
  getValue?: () => string;
  setMarkdown?: (md: string) => void;
  setValue?: (md: string) => void;
  destroy?: () => void;
};

type CherryCtor = new (options: Record<string, unknown>) => CherryInstance;

type CherryMarkdownCoreEditorProps = {
  initialValue: string;
  onReady?: (api: { getMarkdown: () => string; setMarkdown: (md: string) => void }) => void;
};

export default function CherryMarkdownCoreEditor({
  initialValue,
  onReady,
}: CherryMarkdownCoreEditorProps) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `nova-md-browser-${reactId}`;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cherryRef = useRef<CherryInstance | null>(null);
  const initialRef = useRef(initialValue);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await import('cherry-markdown/dist/cherry-markdown.css');
      const mod = await import('cherry-markdown/dist/cherry-markdown.core.js');
      if (cancelled || !hostRef.current) return;

      const Cherry = (mod as { default?: CherryCtor }).default ?? (mod as unknown as CherryCtor);
      const instance = new Cherry({
        id: containerId,
        value: initialRef.current,
        locale: 'zh_CN',
        toolbars: {
          theme: 'light',
          toolbar: [
            'bold',
            'italic',
            'strikethrough',
            '|',
            'header',
            'list',
            'checklist',
            '|',
            'code',
            'table',
            'link',
            'image',
            '|',
            'toc',
            'settings',
          ],
        },
      });
      cherryRef.current = instance;
      onReadyRef.current?.({
        getMarkdown: () => {
          const fromApi = instance.getMarkdown?.() ?? instance.getValue?.();
          if (typeof fromApi === 'string' && fromApi.length > 0) return fromApi;
          const editor = (instance as { editor?: { getValue?: () => string } }).editor;
          const fromEditor = editor?.getValue?.();
          if (typeof fromEditor === 'string') return fromEditor;
          return typeof fromApi === 'string' ? fromApi : '';
        },
        setMarkdown: (md: string) => {
          if (typeof instance.setMarkdown === 'function') instance.setMarkdown(md);
          else if (typeof instance.setValue === 'function') instance.setValue(md);
        },
      });
    })();

    return () => {
      cancelled = true;
      try {
        cherryRef.current?.destroy?.();
      } catch {
        // ignore destroy races
      }
      cherryRef.current = null;
    };
  }, [containerId]);

  return <div ref={hostRef} id={containerId} className="nova-md-browser-cherry h-full min-h-0 w-full" />;
}
