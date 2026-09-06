import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 ArrowLeft,
 ChevronDown,
 ChevronRight,
 ExternalLink,
 Loader2,
} from 'lucide-react';
import type { AlwaysOnDashboardEvent } from '../../types/app';
import { api } from '../../utils/api';
import { cn } from '../../lib/utils.js';
import { Markdown } from '../chat/view/subcomponents/Markdown';

type RunDetailProps = {
 runId?: string;
 events?: AlwaysOnDashboardEvent[];
 planId?: string;
 projectName?: string;
 projectDisplayName?: string;
 projectKey?: string;
 backLabel?: string;
 onBack: () => void;
 onOpenExecutionSession?: (projectKey: string, runId: string, projectName?: string) => void;
};

type PlanData = {
 title: string;
 status: string;
 workspace?: { strategy: string; cwd: string };
 content: string;
};

const STATUS_COLORS: Record<string, string> = {
 ready: 'bg-blue-100 text-info dark:bg-blue-900/40 ',
 queued: 'bg-amber-100 text-warning dark:bg-amber-900/40',
 running: 'bg-blue-100 text-info dark:bg-blue-900/40 ',
 completed: 'bg-emerald-100 text-success dark:bg-emerald-900/40',
 failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
 apply_failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
 applying: 'bg-amber-100 text-warning dark:bg-amber-900/40',
 applied: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
 archived: 'bg-muted text-muted-foreground',
};

function planStatusToOutcome(status?: string): string {
 if (!status) return '';
 if (status === 'completed' || status === 'applied') return 'executed';
 if (status === 'failed' || status === 'apply_failed') return 'failed';
 if (status === 'archived') return 'archived';
 return '';
}

export default function RunDetail(props: RunDetailProps) {
 const {
 runId: runIdProp,
 events = [],
 planId: directPlanId,
 projectName: directProjectName,
 projectDisplayName: directProjectDisplayName,
 projectKey: directProjectKey,
 backLabel,
 onBack,
 onOpenExecutionSession,
 } = props;
 const { t } = useTranslation('alwaysOn');

 const effectiveRunId = runIdProp || (directPlanId ? directPlanId.replace(/^plan_/, '') : '');

 const runEvents = useMemo(
 () => (effectiveRunId ? events.filter((e) => e.runId === effectiveRunId) : []),
 [events, effectiveRunId],
 );

 const { planId, projectKey, projectName, projectDisplayName, outcome } = useMemo(() => {
 if (directPlanId && directProjectName) {
 let evtOutcome = '';
 for (const e of runEvents) {
 if (e.outcome) { evtOutcome = e.outcome; break; }
 }
 return {
 planId: directPlanId,
 projectKey: directProjectKey || '',
 projectName: directProjectName,
 projectDisplayName: directProjectDisplayName || '',
 outcome: evtOutcome,
 };
 }
 let planId = '';
 let projectKey = '';
 let projectName = '';
 let projectDisplayName = '';
 let outcome = '';
 for (const e of runEvents) {
 if (e.planId && !planId) planId = e.planId;
 if (e.projectKey && !projectKey) projectKey = e.projectKey;
 if (e.projectName && !projectName) projectName = e.projectName;
 if (e.projectDisplayName && !projectDisplayName) projectDisplayName = e.projectDisplayName;
 if (e.outcome && !outcome) outcome = e.outcome;
 }
 return { planId, projectKey, projectName, projectDisplayName, outcome };
 }, [runEvents, directPlanId, directProjectName, directProjectDisplayName, directProjectKey]);

 const [plan, setPlan] = useState<PlanData | null>(null);
 const [reportMarkdown, setReportMarkdown] = useState('');
 const [loadingPlan, setLoadingPlan] = useState(false);
 const [loadingReport, setLoadingReport] = useState(false);
 const [planOpen, setPlanOpen] = useState(false);
 const [reportOpen, setReportOpen] = useState(false);

 useEffect(() => {
 if (!projectName || !planId) return;
 let cancelled = false;
 setLoadingPlan(true);
 api
 .projectDiscoveryPlans(projectName)
 .then((r: Response) => r.json())
 .then((data: { plans?: Array<Record<string, unknown>> }) => {
 if (cancelled) return;
 const match = data.plans?.find(
 (p: Record<string, unknown>) => p.id === planId,
 );
 if (match) {
 setPlan({
 title: (match.title as string) || 'Untitled',
 status: (match.status as string) || 'ready',
 workspace: match.workspace as PlanData['workspace'],
 content: ((match.content as string) || '').trim(),
 });
 }
 })
 .catch(() => {})
 .finally(() => {
 if (!cancelled) setLoadingPlan(false);
 });
 return () => { cancelled = true; };
 }, [projectName, planId]);

 useEffect(() => {
 if (!projectName || !planId) return;
 let cancelled = false;
 setLoadingReport(true);
 api
 .discoveryPlanReport(projectName, planId)
 .then((r: Response) => r.json())
 .then((data: { content?: string }) => {
 if (cancelled) return;
 setReportMarkdown((data.content || '').trim());
 })
 .catch(() => {})
 .finally(() => {
 if (!cancelled) setLoadingReport(false);
 });
 return () => { cancelled = true; };
 }, [projectName, planId]);

 const statusColor =
 STATUS_COLORS[plan?.status ?? ''] ??
 'bg-muted text-muted-foreground';

 return (
 <div className="w-full space-y-5 px-8 py-5">
 {/* Back button */}
 <button
 type="button"
 onClick={onBack}
 className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
 >
 <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
 {backLabel ?? t('dashboard.runDetail.back', { defaultValue: 'Back to events' })}
 </button>

 {/* Header card */}
 <div className="rounded-xl border border-border bg-card">
 <div className="border-b border-border px-5 py-4">
 {loadingPlan && !plan ? (
 <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
 {t('dashboard.runDetail.loading', { defaultValue: 'Loading…' })}
 </div>
 ) : (
 <>
 <h2 className="text-[16px] font-semibold text-foreground">
 {plan?.title || t('dashboard.runDetail.untitled', { defaultValue: 'Untitled Plan' })}
 </h2>
 <div className="mt-1.5 flex flex-wrap items-center gap-2">
 {projectDisplayName && (
 <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-info dark:bg-blue-900/40">
 {projectDisplayName}
 </span>
 )}
 {plan?.status && (
 <span
 className={cn(
 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
 statusColor,
 )}
 >
 {t(`plansCron.status.${plan.status}`, { defaultValue: plan.status })}
 </span>
 )}
 </div>
 </>
 )}
 </div>

 {/* Metadata grid */}
 <div className="grid grid-cols-3 divide-x divide-neutral-100 border-b border-border dark:divide-neutral-800">
 {/* Workspace strategy */}
 <div className="px-5 py-3">
 <div className="text-xxs font-medium uppercase tracking-wide text-muted-foreground">
 {t('dashboard.runDetail.workspaceStrategy', { defaultValue: 'Workspace' })}
 </div>
 <div className="mt-1 text-[13px] font-medium text-foreground">
 {plan?.workspace?.strategy || '—'}
 </div>
 </div>

 {/* Execution session */}
 <div className="px-5 py-3">
 <div className="text-xxs font-medium uppercase tracking-wide text-muted-foreground">
 {t('dashboard.runDetail.executionSession', { defaultValue: 'Execution Session' })}
 </div>
 <div className="mt-1">
 {projectKey && effectiveRunId ? (
 <button
 type="button"
 onClick={() => onOpenExecutionSession?.(projectKey, effectiveRunId, projectName)}
 className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition hover:text-info dark:text-blue-400 dark:hover:text-blue-300"
 >
 {t('dashboard.runDetail.openSession', { defaultValue: 'Open Session' })}
 <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
 </button>
 ) : (
 <span className="text-[13px] text-muted-foreground">—</span>
 )}
 </div>
 </div>

 {/* Outcome */}
 <div className="px-5 py-3">
 <div className="text-xxs font-medium uppercase tracking-wide text-muted-foreground">
 {t('dashboard.runDetail.outcome', { defaultValue: 'Outcome' })}
 </div>
 <div className="mt-1 text-[13px] font-medium text-foreground">
 {outcome || planStatusToOutcome(plan?.status) || '—'}
 </div>
 </div>
 </div>

 {/* Plan section (collapsible) */}
 <div className="border-b border-border">
 <button
 type="button"
 onClick={() => setPlanOpen((v) => !v)}
 className="flex w-full items-center gap-2 px-5 py-3 text-left transition hover:bg-sidebar dark:hover:bg-primary"
 >
 {planOpen ? (
 <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
 ) : (
 <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
 )}
 <span className="text-[13px] font-semibold text-foreground">
 {t('dashboard.runDetail.plan', { defaultValue: 'Plan' })}
 </span>
 </button>
 {planOpen && (
 <div className="px-5 pb-4">
 {loadingPlan ? (
 <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 {t('dashboard.runDetail.loading', { defaultValue: 'Loading…' })}
 </div>
 ) : plan?.content ? (
 <div className="prose prose-sm dark:prose-invert max-w-none">
 <Markdown>{plan.content}</Markdown>
 </div>
 ) : (
 <p className="py-4 text-[13px] text-muted-foreground">
 {t('dashboard.runDetail.noPlanContent', { defaultValue: 'No plan content available.' })}
 </p>
 )}
 </div>
 )}
 </div>

 {/* Report section (collapsible) */}
 <div className="border-b border-border">
 <button
 type="button"
 onClick={() => setReportOpen((v) => !v)}
 className="flex w-full items-center gap-2 px-5 py-3 text-left transition hover:bg-sidebar dark:hover:bg-primary"
 >
 {reportOpen ? (
 <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
 ) : (
 <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
 )}
 <span className="text-[13px] font-semibold text-foreground">
 {t('dashboard.runDetail.report', { defaultValue: 'Report' })}
 </span>
 </button>
 {reportOpen && (
 <div className="px-5 pb-4">
 {loadingReport ? (
 <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 {t('dashboard.runDetail.loading', { defaultValue: 'Loading…' })}
 </div>
 ) : reportMarkdown ? (
 <div className="prose prose-sm dark:prose-invert max-w-none">
 <Markdown>{reportMarkdown}</Markdown>
 </div>
 ) : (
 <p className="py-4 text-[13px] text-muted-foreground">
 {t('dashboard.runDetail.noReportContent', { defaultValue: 'No report available yet.' })}
 </p>
 )}
 </div>
 )}
 </div>

 {/* Per-plan apply/archive removed — use cycle-level actions in the plans list */}
 </div>
 </div>
 );
}
