import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { CodeEditorFile } from '../../types/types';

type CodeEditorLoadErrorProps = {
 file: CodeEditorFile;
 isDarkMode: boolean;
 isSidebar: boolean;
 errorMessage: string;
 onRetry: () => void;
 onClose: () => void;
 labels: {
 title: string;
 description: string;
 retry: string;
 close: string;
 };
};

// Shown when the file failed to load. Intentionally does NOT mount a
// CodeMirror surface or expose a Save button — both would risk writing
// stale/empty buffer content back to disk on Ctrl+S.
export default function CodeEditorLoadError({
 file,
 isSidebar,
 errorMessage,
 onRetry,
 onClose,
 labels,
}: CodeEditorLoadErrorProps) {
 const body = (
 <div className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-warning dark:bg-amber-900/30">
 <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
 </div>
 <div className="space-y-1">
 <h3 className="text-sm font-semibold text-foreground">
 {labels.title}
 </h3>
 <p className="text-xs text-muted-foreground">{labels.description}</p>
 <p className="truncate font-mono text-xxs text-muted-foreground">
 {file.path}
 </p>
 </div>
 <pre className="max-h-32 w-full overflow-auto whitespace-pre-wrap rounded-md border border-border bg-sidebar px-3 py-2 text-left font-mono text-xxs text-foreground">
 {errorMessage}
 </pre>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onRetry}
 className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-neutral-700 dark:bg-muted dark:text-foreground dark:hover:bg-neutral-300"
 >
 <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
 {labels.retry}
 </button>
 <button
 type="button"
 onClick={onClose}
 className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-sidebar dark:hover:bg-primary"
 >
 <X className="h-3.5 w-3.5" strokeWidth={1.75} />
 {labels.close}
 </button>
 </div>
 </div>
 );

 if (isSidebar) {
 return (
 <div className="flex h-full w-full items-center justify-center bg-background">
 {body}
 </div>
 );
 }

 return (
 <div className="fixed inset-0 z-[9999] md:flex md:items-center md:justify-center md:bg-black/40 md:backdrop-blur-sm">
 <div className="flex h-full w-full items-center justify-center bg-background md:h-auto md:w-auto md:rounded-xl md:border md:border-border dark:md:border-primary/30">
 {body}
 </div>
 </div>
 );
}
