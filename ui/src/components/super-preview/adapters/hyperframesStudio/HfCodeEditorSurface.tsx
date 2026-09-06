// PD-SAAS-FORK: simple multi-file code editor for hf-project
import { useEffect, useState } from 'react';
import { api } from '../../../../utils/api';

type HfCodeEditorSurfaceProps = {
  projectName: string;
  projectRoot?: string;
  activePath: string;
  onDirtyChange: (dirty: boolean) => void;
  onContentChange: (content: string) => void;
  registerSaveHandler: (handler: () => Promise<string>) => void;
};

export default function HfCodeEditorSurface({
  projectName,
  activePath,
  onDirtyChange,
  onContentChange,
  registerSaveHandler,
}: HfCodeEditorSurfaceProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const response = await api.readFile(projectName, activePath);
      const text = response.ok ? await response.text() : '';
      if (cancelled) return;
      setContent(text);
      onContentChange(text);
      onDirtyChange(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activePath, onContentChange, onDirtyChange, projectName]);

  useEffect(() => {
    registerSaveHandler(async () => content);
  }, [content, registerSaveHandler]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">…</div>;
  }

  return (
    <textarea
      className="h-full w-full resize-none bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
      value={content}
      spellCheck={false}
      onChange={(event) => {
        setContent(event.target.value);
        onContentChange(event.target.value);
        onDirtyChange(true);
      }}
    />
  );
}
