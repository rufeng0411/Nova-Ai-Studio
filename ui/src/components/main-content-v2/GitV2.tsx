import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 AlertCircle,
 Check,
 GitBranch,
 Loader2,
 RefreshCw,
 Upload,
 Wand2,
} from 'lucide-react';
import type { Project } from '../../types/app';
import { useGitPanelController } from '../git-panel/hooks/useGitPanelController';
import type { FileOpenHandler } from '../git-panel/types/types';
import { cn } from '../../lib/utils.js';

type GitV2Props = {
 selectedProject: Project | null;
 onFileOpen?: FileOpenHandler;
};

type ChangeRow = {
 path: string;
 status: 'M' | 'A' | 'D' | 'U';
 group: 'modified' | 'added' | 'deleted' | 'untracked';
};

const STATUS_COLOR: Record<ChangeRow['status'], string> = {
 M: 'text-amber-500',
 A: 'text-success',
 D: 'text-red-500',
 U: 'text-blue-500',
};

export default function GitV2({ selectedProject, onFileOpen }: GitV2Props) {
 const { t } = useTranslation();
 const controller = useGitPanelController({
 selectedProject,
 activeView: 'changes',
 onFileOpen,
 });

 const [commitMessage, setCommitMessage] = useState('');
 const [isCommitting, setIsCommitting] = useState(false);
 const [isGenerating, setIsGenerating] = useState(false);

 const { stagedRows, changeRows } = useMemo(() => {
 const status = controller.gitStatus;
 if (!status) return { stagedRows: [] as ChangeRow[], changeRows: [] as ChangeRow[] };

 const modified: ChangeRow[] = (status.modified ?? []).map((path) => ({
 path,
 status: 'M',
 group: 'modified',
 }));
 const added: ChangeRow[] = (status.added ?? []).map((path) => ({
 path,
 status: 'A',
 group: 'added',
 }));
 const deleted: ChangeRow[] = (status.deleted ?? []).map((path) => ({
 path,
 status: 'D',
 group: 'deleted',
 }));
 const untracked: ChangeRow[] = (status.untracked ?? []).map((path) => ({
 path,
 status: 'U',
 group: 'untracked',
 }));

 // Legacy panel does not expose a distinct "staged" list; we show everything under Changes
 // and let the user stage-commit them all at once from V2. Added files are grouped separately
 // as "ready to commit" for visual parity with the prototype's Staged section.
 return {
 stagedRows: added,
 changeRows: [...modified, ...deleted, ...untracked],
 };
 }, [controller.gitStatus]);

 const allChangeFiles = useMemo(
 () => [...stagedRows, ...changeRows].map((row) => row.path),
 [changeRows, stagedRows],
 );

 if (!selectedProject) {
 return (
 <div className="flex h-full items-center justify-center bg-card text-[13px] text-muted-foreground">
 {t('gitPanel.selectProject')}
 </div>
 );
 }

 const isLoading = controller.isLoading;
 const hasError = Boolean(controller.gitStatus?.error);
 const remote = controller.remoteStatus;
 const ahead = remote?.ahead ?? 0;
 const behind = remote?.behind ?? 0;

 const handleGenerate = async () => {
 if (allChangeFiles.length === 0) return;
 setIsGenerating(true);
 try {
 const message = await controller.generateCommitMessage(allChangeFiles);
 if (message) setCommitMessage(message);
 } finally {
 setIsGenerating(false);
 }
 };

 const handleCommit = async () => {
 if (!commitMessage.trim() || allChangeFiles.length === 0) return;
 setIsCommitting(true);
 try {
 const ok = await controller.commitChanges(commitMessage.trim(), allChangeFiles);
 if (ok) setCommitMessage('');
 } finally {
 setIsCommitting(false);
 }
 };

 return (
 <div className="flex h-full flex-col bg-background">
 <div className="text-xxs flex h-10 shrink-0 items-center border-b border-border px-6">
 <GitBranch className="mr-2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
 <span className="font-medium text-foreground">
 {controller.currentBranch || 'main'}
 </span>
 <span className="ml-2 text-muted-foreground">
 ↑{ahead} ↓{behind}
 </span>
 <button
 type="button"
 onClick={() => void controller.handleFetch()}
 disabled={controller.isFetching}
 className="text-xxs ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition hover:bg-muted disabled:opacity-50 dark:hover:bg-primary"
 >
 <RefreshCw
 className={cn('h-3.5 w-3.5', controller.isFetching && 'animate-spin')}
 strokeWidth={1.75}
 />
 <span>{t('gitPanel.fetch')}</span>
 </button>
 </div>

 <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-[13px]">
 {isLoading && !controller.gitStatus ? (
 <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 <span>{t('gitPanel.loadingStatus')}</span>
 </div>
 ) : hasError ? (
 <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
 <AlertCircle className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
 <div>
 <div className="font-medium">{controller.gitStatus?.error}</div>
 {controller.gitStatus?.details ? (
 <div className="text-xxs mt-1 opacity-80">{controller.gitStatus.details}</div>
 ) : null}
 </div>
 </div>
 ) : stagedRows.length === 0 && changeRows.length === 0 ? (
 <div className="py-10 text-center text-[13px] text-muted-foreground">
 {t('gitPanel.workingTreeClean')}
 </div>
 ) : (
 <div className="space-y-5">
 {stagedRows.length > 0 ? (
 <ChangeList title={t('gitPanel.staged')} rows={stagedRows} onFileOpen={onFileOpen} />
 ) : null}
 {changeRows.length > 0 ? (
 <ChangeList title={t('gitPanel.changes')} rows={changeRows} onFileOpen={onFileOpen} />
 ) : null}
 </div>
 )}
 </div>

 <div className="shrink-0 border-t border-border p-4">
 <textarea
 value={commitMessage}
 onChange={(event) => setCommitMessage(event.target.value)}
 placeholder={t('gitPanel.commitMessagePlaceholder')}
 rows={2}
 disabled={isCommitting || allChangeFiles.length === 0}
 className="w-full resize-none rounded-lg border border-border bg-transparent p-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus:border-border disabled:opacity-50 dark:placeholder:text-muted-foreground dark:focus:border-border"
 />
 <div className="mt-2 flex gap-2">
 <button
 type="button"
 onClick={() => void handleCommit()}
 disabled={isCommitting || !commitMessage.trim() || allChangeFiles.length === 0}
 className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] text-primary-foreground transition hover:opacity-90 disabled:opacity-40 dark:bg-sidebar dark:text-foreground"
 >
 {isCommitting ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
 ) : (
 <Check className="h-3.5 w-3.5" strokeWidth={2} />
 )}
 <span>{t('gitPanel.commit')}</span>
 </button>
 <button
 type="button"
 onClick={() => void handleGenerate()}
 disabled={isGenerating || allChangeFiles.length === 0}
 className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] text-foreground transition hover:bg-sidebar disabled:opacity-40 dark:hover:bg-primary"
 title={t('gitPanel.aiSuggestCommit')}
 >
 {isGenerating ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
 ) : (
 <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 <button
 type="button"
 onClick={() => void controller.handlePush()}
 disabled={controller.isPushing}
 className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] text-foreground transition hover:bg-sidebar disabled:opacity-50 dark:hover:bg-primary"
 >
 {controller.isPushing ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
 ) : (
 <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 <span>{t('gitPanel.push')}</span>
 </button>
 </div>
 {controller.operationError ? (
 <div className="text-xxs mt-2 flex items-start gap-1.5 text-red-600 dark:text-red-400">
 <AlertCircle className="mt-0.5 h-3 w-3" strokeWidth={1.75} />
 <span>{controller.operationError}</span>
 <button
 type="button"
 onClick={controller.clearOperationError}
 className="ml-auto opacity-70 hover:opacity-100"
 >
 {t('gitPanel.dismiss')}
 </button>
 </div>
 ) : null}
 </div>
 </div>
 );
}

function ChangeList({
 title,
 rows,
 onFileOpen,
}: {
 title: string;
 rows: ChangeRow[];
 onFileOpen?: FileOpenHandler;
}) {
 return (
 <div>
 <div className="text-xxs mb-2 uppercase tracking-wide text-muted-foreground">
 {title} · {rows.length}
 </div>
 <div className="space-y-1">
 {rows.map((row) => (
 <button
 key={`${row.group}:${row.path}`}
 type="button"
 onClick={() => onFileOpen?.(row.path)}
 className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted dark:hover:bg-primary"
 >
 <span
 className={cn('w-4 font-mono text-xxs', STATUS_COLOR[row.status])}
 >
 {row.status}
 </span>
 <span className="flex-1 truncate text-[13px] text-foreground">
 {row.path}
 </span>
 </button>
 ))}
 </div>
 </div>
 );
}
