// PD-SAAS-FORK: @ file references as removable chips above composer text
import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../lib/utils.js';

export type FileReferenceChipsProps = {
  paths: string[];
  onRemove: (path: string) => void;
  className?: string;
};

function displayName(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim();
  const name = normalized.split('/').pop() || normalized;
  return name.length > 36 ? `${name.slice(0, 33)}…` : name;
}

export default function FileReferenceChips({ paths, onRemove, className }: FileReferenceChipsProps) {
  const { t } = useTranslation('chat');

  if (paths.length === 0) {
    return null;
  }

  return (
    <div className={cn('mb-2 flex flex-wrap gap-1.5', className)}>
      {paths.map((path) => (
        <span
          key={path}
          title={path}
          className="group/chip inline-flex max-w-full items-center gap-1 rounded-lg border border-blue-200/80 bg-blue-50/90 py-0.5 pl-2 pr-1 text-[12px] text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-100"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
          <span className="truncate font-medium">{displayName(path)}</span>
          <button
            type="button"
            aria-label={t('input.fileReference.remove', {
              name: displayName(path),
              defaultValue: `Remove reference ${displayName(path)}`,
            })}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-blue-700/0 transition hover:bg-blue-200/80 hover:text-blue-900 group-hover/chip:text-blue-700/80 dark:text-blue-200/0 dark:hover:bg-blue-900/60 dark:hover:text-blue-50 group-hover/chip:dark:text-blue-200/80"
            onClick={() => onRemove(path)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </span>
      ))}
    </div>
  );
}
