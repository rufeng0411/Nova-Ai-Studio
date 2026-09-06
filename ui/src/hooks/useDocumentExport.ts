// PD-SAAS-FORK: poll async document export jobs from UI preview toolbar
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { triggerAuthFileDownload } from '../utils/triggerAuthFileDownload';
import type { ExportCapability } from '../shared/documentExportMatrix';
import {
  isExportCapClickable,
  isLocalExportEngine,
  normalizeServerExportCapabilities,
} from '../shared/documentExportMatrix';
import { isSlideDeckBundlePath } from '../shared/resolveExportScope';
import { resolveHfProjectDirFromApiPath } from '../shared/hfStudioPathResolve';
import { renderHfProjectWithPolling } from '../shared/hfStudioApi';
import { useResolvedProjectApiPath } from '../shared/hooks/useResolvedProjectApiPath';
import { computeExportPollMaxAttempts } from '../shared/exportPollTimeout';

export type ExportCapabilitiesResponse = {
  scopeId: string;
  bundle: boolean;
  pageCount?: number;
  bundleHint?: number;
  capabilities: ExportCapability[];
  sourcePath: string;
};

export type ExportJobState = {
  status: 'idle' | 'running' | 'downloading' | 'done' | 'failed';
  activeFormat?: string;
  activeEngine?: string;
  progress: number;
  progressPage?: number;
  progressTotal?: number;
  error?: string;
  resultPath?: string;
  downloadUrl?: string;
  /** Auto-download after export failed — UI may offer one-tap retry */
  autoDownloadFailed?: boolean;
};

const POLL_MS = 1200;
const DEFAULT_MAX_POLL = 150;
const CAPS_LOAD_TIMEOUT_MS = 4000;

function isActiveJobStatus(status: ExportJobState['status']): boolean {
  return status === 'running' || status === 'downloading' || status === 'done' || status === 'failed';
}

export function useDocumentExport(
  projectName: string | undefined,
  sourcePath: string | undefined,
  projectRoot?: string,
) {
  const { resolvedApiPath } = useResolvedProjectApiPath(projectName, sourcePath, projectRoot);
  const effectiveSourcePath = resolvedApiPath || sourcePath;
  const [caps, setCaps] = useState<ExportCapabilitiesResponse | null>(null);
  const [capsLoaded, setCapsLoaded] = useState(false);
  const [job, setJob] = useState<ExportJobState>({ status: 'idle', progress: 0 });
  const pollRef = useRef(0);
  const pollLimitRef = useRef(DEFAULT_MAX_POLL);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleIdleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setJob((prev) => (prev.status === 'done' ? { status: 'idle', progress: 0 } : prev));
    }, 3500);
  }, []);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const loadCapabilities = useCallback(async () => {
    if (!projectName || !effectiveSourcePath) {
      setCaps(null);
      setCapsLoaded(false);
      return;
    }
    try {
      const data = await api.getExportCapabilities(projectName, effectiveSourcePath);
      setCaps({
        ...data,
        capabilities: normalizeServerExportCapabilities(data.capabilities ?? []),
      });
      setCapsLoaded(true);
      setJob((prev) => (isActiveJobStatus(prev.status) ? prev : { status: 'idle', progress: 0 }));
    } catch {
      // PD-SAAS-FORK: still unblock local PDF/compose exports when capabilities API fails.
      setCaps(null);
      setCapsLoaded(true);
      setJob((prev) => (isActiveJobStatus(prev.status) ? prev : { status: 'idle', progress: 0 }));
    }
  }, [effectiveSourcePath, projectName]);

  useEffect(() => {
    setCapsLoaded(false);
    void loadCapabilities();
    const timer = setTimeout(() => {
      setCapsLoaded(true);
    }, CAPS_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loadCapabilities]);

  const pollJob = useCallback(
    async (jobId: string, cap: ExportCapability, pageCount?: number) => {
      if (!projectName) return;
      pollRef.current = 0;
      pollLimitRef.current = computeExportPollMaxAttempts(pageCount ?? cap.pageCount, cap.engine, POLL_MS);
      while (pollRef.current < pollLimitRef.current) {
        pollRef.current += 1;
        const snapshot = await api.pollExportJob(projectName, jobId);
        const discoveredPages =
          typeof snapshot.progressTotal === 'number' && snapshot.progressTotal > 0
            ? snapshot.progressTotal
            : typeof snapshot.pageCount === 'number' && snapshot.pageCount > 0
              ? snapshot.pageCount
              : undefined;
        if (discoveredPages) {
          const needed = computeExportPollMaxAttempts(discoveredPages, cap.engine, POLL_MS);
          if (needed > pollLimitRef.current) {
            pollLimitRef.current = needed;
          }
        }
        if (snapshot.status === 'done') {
          const resultPath = typeof snapshot.relativePath === 'string' ? snapshot.relativePath : '';
          const downloadUrl = resultPath ? api.fileDownloadUrl(projectName, resultPath) : undefined;
          if (typeof window !== 'undefined' && resultPath) {
            window.dispatchEvent(
              new CustomEvent('pilotdeck:files-changed', { detail: { projectName, paths: [resultPath] } }),
            );
          }
          setJob((prev) => ({
            status: 'downloading',
            progress: 100,
            activeFormat: cap.format,
            activeEngine: cap.engine,
            resultPath,
            downloadUrl,
            progressPage: prev.progressPage,
            progressTotal: prev.progressTotal,
          }));
          if (resultPath) {
            const dl = await triggerAuthFileDownload(projectName, resultPath);
            setJob((prev) => ({
              status: 'done',
              progress: 100,
              activeFormat: cap.format,
              activeEngine: cap.engine,
              resultPath,
              downloadUrl,
              autoDownloadFailed: !dl.ok,
              error: dl.ok ? undefined : dl.reason,
              progressPage: prev.progressTotal ?? prev.progressPage,
              progressTotal: prev.progressTotal,
            }));
            scheduleIdleReset();
          } else {
            setJob({
              status: 'failed',
              progress: 0,
              activeFormat: cap.format,
              activeEngine: cap.engine,
              error: 'export_missing_output',
            });
          }
          return;
        }
        if (snapshot.status === 'failed') {
          setJob({
            status: 'failed',
            progress: 0,
            activeFormat: cap.format,
            activeEngine: cap.engine,
            error: snapshot.error || 'export_failed',
          });
          return;
        }
        setJob({
          status: 'running',
          progress: typeof snapshot.progress === 'number' ? snapshot.progress : 30,
          activeFormat: cap.format,
          activeEngine: cap.engine,
          progressPage: typeof snapshot.progressPage === 'number' ? snapshot.progressPage : undefined,
          progressTotal:
            typeof snapshot.progressTotal === 'number'
              ? snapshot.progressTotal
              : typeof snapshot.pageCount === 'number'
                ? snapshot.pageCount
                : undefined,
        });
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      setJob({ status: 'failed', progress: 0, error: 'export_timeout' });
    },
    [projectName, scheduleIdleReset],
  );

  const retryDownload = useCallback(async () => {
    if (!projectName || !job.resultPath) return;
    setJob((prev) => ({ ...prev, status: 'downloading', autoDownloadFailed: false, error: undefined }));
    const dl = await triggerAuthFileDownload(projectName, job.resultPath);
    setJob((prev) => ({
      ...prev,
      status: dl.ok ? 'done' : 'failed',
      autoDownloadFailed: !dl.ok,
      error: dl.ok ? undefined : dl.reason,
    }));
    if (dl.ok) scheduleIdleReset();
  }, [job.resultPath, projectName, scheduleIdleReset]);

  const startExport = useCallback(
    async (cap: ExportCapability) => {
      if (!projectName || !effectiveSourcePath) return;
      const canStart =
        isLocalExportEngine(cap.engine) ||
        (capsLoaded && cap.enabled !== false);
      if (!canStart) return;
      setJob({ status: 'running', progress: 5, activeFormat: cap.format, activeEngine: cap.engine });
      try {
        if (cap.engine === 'hf_render') {
          const projectDir = resolveHfProjectDirFromApiPath(effectiveSourcePath);
          if (!projectDir) {
            throw new Error('hf_project_not_found');
          }
          const quality = cap.recommended ? 'draft' : 'high';
          const taskDir = projectDir.replace(/\/hf-project$/i, '');
          const jobResult = await renderHfProjectWithPolling(projectName, {
            projectDir,
            outputPath: `${taskDir}/promo.mp4`,
            quality,
            taskArtifactDir: taskDir,
          });
          if (jobResult.status !== 'completed' || !jobResult.outputPath) {
            throw new Error(jobResult.error ?? 'hf_render_failed');
          }
          const resultPath = jobResult.outputPath;
          const downloadUrl = api.fileDownloadUrl(projectName, resultPath);
          setJob({
            status: 'done',
            progress: 100,
            activeFormat: cap.format,
            activeEngine: cap.engine,
            resultPath,
            downloadUrl,
          });
          scheduleIdleReset();
          return;
        }
        const effectiveSource = caps?.sourcePath || effectiveSourcePath;
        const bundle =
          cap.bundle ||
          (isSlideDeckBundlePath(effectiveSource) &&
            (cap.engine === 'compose_images' || cap.engine === 'ocr_editable_pptx'));
        const { jobId } = await api.startExportJob(projectName, {
          sourcePath: effectiveSource,
          format: cap.format,
          engine: cap.engine,
          bundle,
        });
        if (!jobId) {
          throw new Error('export_job_missing');
        }
        await pollJob(jobId, cap, caps?.pageCount ?? cap.pageCount);
      } catch (error) {
        setJob({
          status: 'failed',
          progress: 0,
          activeFormat: cap.format,
          activeEngine: cap.engine,
          error: error instanceof Error ? error.message : 'export_failed',
        });
      }
    },
    [caps?.sourcePath, capsLoaded, effectiveSourcePath, pollJob, projectName],
  );

  const resetJob = useCallback(() => {
    setJob({ status: 'idle', progress: 0 });
  }, []);

  return {
    caps,
    capsLoaded,
    capabilities: caps?.capabilities ?? [],
    scopeId: caps?.scopeId,
    bundle: caps?.bundle,
    pageCount: caps?.pageCount,
    job,
    startExport,
    retryDownload,
    reloadCapabilities: loadCapabilities,
    resetJob,
  };
}
