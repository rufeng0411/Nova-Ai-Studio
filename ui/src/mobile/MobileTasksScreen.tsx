/**
 * PD-SAAS-FORK: Mobile read-only scheduled-tasks list (plans + cron jobs
 * across projects). No create/edit forms — running cron jobs only expose a
 * gentle stop control. Reuses the same REST surface as PlansAndCronJobs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, FileText, Loader2, Square } from 'lucide-react';
import type {
  CronJobOverview,
  CronJobsOverviewResponse,
  DiscoveryPlanOverview,
  Project,
  ProjectDiscoveryPlansResponse,
} from '../types/app';
import { api } from '../utils/api';
import { cn } from '../lib/utils.js';

const POLL_INTERVAL_MS = 20_000;

type TaskRow =
  | { kind: 'plan'; id: string; title: string; project: string; status: string; createdAt: string }
  | { kind: 'cron'; id: string; title: string; project: string; status: 'scheduled' | 'running'; createdAt: string };

const PLAN_STATUS_KEY: Record<string, { key: string; defaultValue: string }> = {
  ready: { key: 'plansCron.status.created', defaultValue: 'Created' },
  queued: { key: 'plansCron.status.preparingWorkspace', defaultValue: 'Preparing' },
  running: { key: 'plansCron.status.executing', defaultValue: 'Executing' },
  completed: { key: 'plansCron.status.completedWaiting', defaultValue: 'Completed' },
  failed: { key: 'plansCron.status.failed', defaultValue: 'Failed' },
  archived: { key: 'plansCron.status.archived', defaultValue: 'Archived' },
};

function statusTone(status: string): string {
  if (status === 'running') return 'bg-primary/10 text-primary';
  if (status === 'failed') return 'bg-destructive/10 text-destructive';
  if (status === 'completed') return 'bg-success/10 text-success';
  return 'bg-muted text-muted-foreground';
}

function formatTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function MobileTasksScreen() {
  const { t } = useTranslation('alwaysOn');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const projectsRes = await api.projects();
      if (!projectsRes.ok) throw new Error(`HTTP ${projectsRes.status}`);
      const projects: Project[] = await projectsRes.json();

      const [cronRes, ...planResults] = await Promise.all([
        api.allCronJobs(),
        ...projects.map((p) => api.projectDiscoveryPlans(p.name)),
      ]);

      const next: TaskRow[] = [];

      if (cronRes.ok) {
        const payload = (await cronRes.json()) as CronJobsOverviewResponse;
        const jobs: CronJobOverview[] = Array.isArray(payload.jobs) ? payload.jobs : [];
        for (const job of jobs) {
          if (job.status !== 'scheduled' && job.status !== 'running') continue;
          const project = projects.find(
            (p) => p.name === job.projectKey || p.fullPath === job.projectKey,
          );
          next.push({
            kind: 'cron',
            id: job.id,
            title: job.prompt || job.id,
            project: project?.displayName || project?.name || '',
            status: job.status,
            createdAt: job.createdAt,
          });
        }
      }

      for (let i = 0; i < projects.length; i++) {
        const res = planResults[i];
        if (!res?.ok) continue;
        const payload = (await res.json()) as ProjectDiscoveryPlansResponse;
        const plans: DiscoveryPlanOverview[] = Array.isArray(payload.plans) ? payload.plans : [];
        for (const plan of plans) {
          next.push({
            kind: 'plan',
            id: plan.id,
            title: plan.title || plan.id,
            project: projects[i]!.displayName || projects[i]!.name,
            status: plan.status,
            createdAt: plan.createdAt,
          });
        }
      }

      next.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
      setRows(next);
    } catch {
      // Best-effort poll; keep the previous list on failure.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const handleStopCron = useCallback(
    async (id: string) => {
      setStoppingId(id);
      try {
        await api.cronStop(id);
        await refresh();
      } catch {
        // Soft-fail; next poll reconciles.
      } finally {
        setStoppingId(null);
      }
    },
    [refresh],
  );

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('plansCron.loading', { defaultValue: 'Loading plans and cron jobs…' })}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <CalendarClock className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-[13px] text-muted-foreground">
          {t('plansCron.empty', { defaultValue: 'No plans or cron jobs found.' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-3">
      {rows.map((row) => {
        const statusLabel =
          row.kind === 'cron'
            ? t(`plansCron.status.${row.status}`, {
                defaultValue: row.status === 'running' ? 'Running' : 'Scheduled',
              })
            : t(PLAN_STATUS_KEY[row.status]?.key ?? 'plansCron.status.created', {
                defaultValue: PLAN_STATUS_KEY[row.status]?.defaultValue ?? row.status,
              });
        const Icon = row.kind === 'cron' ? CalendarClock : FileText;
        return (
          <div
            key={`${row.kind}-${row.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-foreground">{row.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {row.project ? <span className="truncate">{row.project}</span> : null}
                <span className="shrink-0">{formatTime(row.createdAt)}</span>
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                statusTone(row.status),
              )}
            >
              {statusLabel}
            </span>
            {row.kind === 'cron' && row.status === 'running' ? (
              <button
                type="button"
                disabled={stoppingId === row.id}
                onClick={() => void handleStopCron(row.id)}
                aria-label={t('plansCron.actions.stop', { defaultValue: 'Stop' }) as string}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground active:bg-accent disabled:opacity-50"
              >
                {stoppingId === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
