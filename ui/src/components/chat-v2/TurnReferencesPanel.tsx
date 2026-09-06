// PD-SAAS-FORK: Per-turn web search sources receipt
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collectTurnSearchSources } from '../../shared/processNarrative';
import { cn } from '../../lib/utils';
import { SURFACE_REFERENCES, TEXT_CONTROL } from './conversationSurfaceTokens';
import type { ChatMessage } from '../chat/types/types';

type TurnReferencesPanelProps = {
  turnMessages: ChatMessage[];
  className?: string;
};

export function TurnReferencesPanel({ turnMessages, className = '' }: TurnReferencesPanelProps) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);
  const sources = collectTurnSearchSources(turnMessages);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('mt-3 overflow-hidden', SURFACE_REFERENCES, className)}
      data-testid="turn-references-panel"
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2.5 text-left',
          TEXT_CONTROL,
          'font-medium hover:bg-muted/25',
        )}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        <span>
          {t('process.references.title', { defaultValue: '参考资料来源' })}
        </span>
        <span className="ml-auto text-[12px] font-normal text-muted-foreground">
          {t('process.references.sourceCount', {
            count: sources.length,
            defaultValue: '{{count}} 条来源',
          })}
        </span>
      </button>
      {expanded ? (
        <ul className="space-y-1.5 border-t border-border/60 px-3 py-2">
          {sources.map((source) => (
            <li key={source.url} className="text-[12px] leading-5">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-info hover:underline"
              >
                {source.title || source.url}
              </a>
              {source.query ? (
                <div className="text-muted-foreground">
                  {t('process.clue.search', { defaultValue: '搜索' })}：{source.query}
                </div>
              ) : null}
              {source.snippet ? (
                <div className="line-clamp-2 text-muted-foreground/90">{source.snippet}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default TurnReferencesPanel;
