// PD-SAAS-FORK: curated evidence / milestone clues during a run
import { FileText, Globe, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/app';
import type { ProcessClue } from '../../shared/processNarrative';
import { formatToolDisplayName, localizeRawProcessLabel } from '../../shared/processStepLabels';

type ProcessClueStripProps = {
  clues: ProcessClue[];
  selectedProject?: Project | null;
  onFileOpen?: (filePath: string, options?: unknown) => void;
  className?: string;
};

function clueIcon(kind: ProcessClue['kind']) {
  switch (kind) {
    case 'search':
      return Search;
    case 'fetch':
      return Globe;
    case 'milestone':
      return Sparkles;
    case 'read':
    case 'local_search':
    case 'recovery':
    case 'thinking':
    default:
      return FileText;
  }
}

export function ProcessClueStrip({
  clues,
  selectedProject,
  onFileOpen,
  className = '',
}: ProcessClueStripProps) {
  const { t } = useTranslation('chat');

  if (clues.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-2 flex flex-wrap gap-1.5 ${className}`.trim()}
      data-testid="process-clue-strip"
    >
      {clues.map((clue) => {
        const Icon = clueIcon(clue.kind);
        const prefix = (() => {
          switch (clue.kind) {
            case 'search':
              return t('process.clue.search', { defaultValue: '搜索' });
            case 'fetch':
              return t('process.clue.fetch', { defaultValue: '阅读' });
            case 'read':
              return t('process.clue.read', { defaultValue: '查阅' });
            case 'milestone':
              return t('process.clue.milestone', { defaultValue: '已生成' });
            case 'local_search':
              return clue.toolName
                ? formatToolDisplayName(clue.toolName, t)
                : t('process.clue.localSearch', { defaultValue: '检索项目' });
            case 'recovery': {
              const reason = clue.recoveryReason || clue.label || '';
              return localizeRawProcessLabel(reason, t) || t('process.clue.recovery', { defaultValue: '调整中' });
            }
            case 'thinking':
              return t('process.tool.thinking', { defaultValue: '思考' });
            default:
              return '';
          }
        })();

        if (clue.kind === 'milestone' && clue.filePath) {
          return (
            <span
              key={clue.id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-2 py-1 text-[12px] text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              <span className="shrink-0 text-success/90">{prefix}</span>
              <button
                type="button"
                className="truncate font-medium text-info hover:underline"
                onClick={() => onFileOpen?.(clue.filePath!)}
              >
                {clue.label}
              </button>
            </span>
          );
        }

        const sourceChips = clue.sources?.slice(0, 3) ?? [];

        return (
          <div
            key={clue.id}
            className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-[12px] text-muted-foreground"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            {prefix && clue.kind !== 'thinking' ? (
              <span className="shrink-0 text-foreground/80">{prefix}：</span>
            ) : null}
            {clue.kind === 'thinking' ? (
              <span className="truncate italic text-foreground/85" title={clue.detail}>
                {clue.label || prefix}
              </span>
            ) : (
              <span className="truncate text-foreground" title={clue.detail}>
                {clue.label}
              </span>
            )}
            {sourceChips.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[10rem] truncate rounded-md bg-background/80 px-1.5 py-0.5 text-[11px] text-info hover:underline"
                title={source.title}
              >
                {source.title || source.url}
              </a>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default ProcessClueStrip;
