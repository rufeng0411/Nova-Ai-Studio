import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../utils/api';

type N2BotPeekProps = {
  path: string;
  kind: string;
  page: number;
  files?: Array<{ path: string; kind: string; label: string }>;
  onClose: () => void;
  onPage: (delta: number) => void;
  onSwitch: (path: string, kind: string) => void;
  onSave?: () => void;
};

export default function N2BotPeek({
  path,
  kind,
  page,
  files,
  onClose,
  onPage,
  onSwitch,
  onSave,
}: N2BotPeekProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setError(null);
    setText(null);
    setBlobUrl(null);
    const ext = kind || path.split('.').pop() || '';
    (async () => {
      try {
        const res = await authenticatedFetch(
          `/api/file/content?path=${encodeURIComponent(path)}`,
        );
        if (!res.ok) {
          throw new Error('preview_failed');
        }
        if (['md', 'markdown', 'txt', 'html', 'htm'].includes(ext)) {
          const body = await res.text();
          if (!cancelled) setText(body);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        if (!cancelled) setBlobUrl(url);
      } catch {
        if (!cancelled) setError('这份请先下载看。');
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path, kind]);

  return (
    <div className="n2b-peek" data-testid="n2-bot-peek">
      <div className="n2b-peek-bar">
        {(files ?? []).map((file) => (
          <button
            key={file.path}
            type="button"
            className={file.path === path ? 'is-on' : ''}
            onClick={() => onSwitch(file.path, file.kind)}
          >
            {file.label}
          </button>
        ))}
        <button type="button" onClick={() => onPage(-1)}>上一页</button>
        <button type="button" onClick={() => onPage(1)}>下一页</button>
        <button type="button" onClick={onClose}>收起</button>
        {onSave && <button type="button" onClick={onSave}>保存到本机</button>}
      </div>
      <div className="n2b-peek-body">
        {error && <p>{error}</p>}
        {text && (kind === 'html' || kind === 'htm' ? (
          <iframe title="peek" srcDoc={text} sandbox="" />
        ) : (
          <pre>{text}</pre>
        ))}
        {blobUrl && (kind === 'pdf' ? (
          <iframe title="peek-pdf" src={`${blobUrl}#page=${page}`} />
        ) : (
          <img alt="" src={blobUrl} />
        ))}
      </div>
    </div>
  );
}
