import { Copy, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import { cn } from '../../../../lib/utils';
import FallbackPreviewAdapter from '../fallback/FallbackPreviewAdapter';

type TextContentPreviewProps = {
  content: string;
  code?: boolean;
  title?: string;
};

export function TextContentPreview({ content, code = false, title, embedInChrome = false }: TextContentPreviewProps & { embedInChrome?: boolean }) {
  const [query, setQuery] = useState('');
  const lines = useMemo(() => content.split(/\r?\n/), [content]);
  const queryLower = query.trim().toLowerCase();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {title && !embedInChrome ? <span className="max-w-48 truncate text-xs text-muted-foreground">{title}</span> : null}
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索当前文件"
          className="h-7 flex-1 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-primary/50"
        />
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => void navigator.clipboard?.writeText(content)}
        >
          <Copy className="h-3.5 w-3.5" />
          复制
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <pre
          className={cn(
            'm-0 whitespace-pre-wrap break-words text-[12px] leading-6 text-foreground',
            code && 'font-mono',
          )}
        >
          {lines.map((line, index) => {
            const hit = queryLower && line.toLowerCase().includes(queryLower);
            return (
              <div key={`${index}-${line}`} className={cn('flex gap-3 rounded px-1', hit && 'bg-primary/10')}>
                <span className="w-10 shrink-0 select-none text-right text-muted-foreground">
                  {index + 1}
                </span>
                <span>{line || ' '}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

type TextPreviewAdapterProps = {
  projectName: string;
  apiPath: string;
  projectRoot?: string;
  code?: boolean;
  title?: string;
  embedInChrome?: boolean;
};

export default function TextPreviewAdapter({
  projectName,
  apiPath,
  projectRoot,
  code = false,
  title,
  embedInChrome = false,
}: TextPreviewAdapterProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    loadProjectTextContent(projectName, apiPath, projectRoot)
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, projectName, projectRoot]);

  if (error) {
    return <FallbackPreviewAdapter message="文本预览加载失败，请下载后查看。" />;
  }

  return <TextContentPreview content={content} code={code} title={title} embedInChrome={embedInChrome} />;
}
