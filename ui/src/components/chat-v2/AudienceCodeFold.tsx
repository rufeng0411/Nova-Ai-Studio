// PD-SAAS-FORK: fold code blocks for non-technical audience

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { shouldFoldCodeForAudience, type AudienceMode } from '../../shared/audienceMode';

const CODE_FENCE_RE = /```[\s\S]*?```/g;

type AudienceCodeFoldProps = {
  content: string;
  audienceMode: AudienceMode;
  children: (displayContent: string) => ReactNode;
};

export function AudienceCodeFold({ content, audienceMode, children }: AudienceCodeFoldProps) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);
  const fold = shouldFoldCodeForAudience(audienceMode);
  const hasCode = useMemo(() => CODE_FENCE_RE.test(content), [content]);

  const displayContent = useMemo(() => {
    if (!fold || expanded || !hasCode) return content;
    return content.replace(
      CODE_FENCE_RE,
      `\n\n*${t('process.codeFold.working', { defaultValue: '正在编写处理脚本…' })}*\n\n`,
    );
  }, [content, expanded, fold, hasCode, t]);

  if (!fold || !hasCode) {
    return <>{children(content)}</>;
  }

  return (
    <div className="space-y-1">
      {children(displayContent)}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        )}
        {expanded
          ? t('process.codeFold.hide', { defaultValue: '收起代码细节' })
          : t('process.codeFold.show', { defaultValue: '查看代码细节' })}
      </button>
    </div>
  );
}

export default AudienceCodeFold;
