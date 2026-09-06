// PD-SAAS-FORK: Bridge HyperFrames render API client
import { authenticatedFetch } from '../utils/api';
import { dispatchHfDeliverableUpdated } from './hfStudioBridge';

export type HfRenderQuality = 'draft' | 'high';

export type HfRenderJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type HfRenderJob = {
  jobId: string;
  status: HfRenderJobStatus;
  quality?: HfRenderQuality;
  outputPath?: string;
  bytes?: number;
  durationSec?: number;
  error?: string;
  retryAfterMs?: number;
};

export type HfDoctorResult = {
  ok: boolean;
  checks?: Array<{ name: string; ok: boolean; message?: string }>;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHfDoctor(projectName: string): Promise<HfDoctorResult> {
  const response = await authenticatedFetch(
    `/api/projects/${encodeURIComponent(projectName)}/hyperframes/doctor`,
  );
  if (!response.ok) {
    return { ok: false };
  }
  return response.json() as Promise<HfDoctorResult>;
}

export async function startHfRender(
  projectName: string,
  body: {
    projectDir: string;
    outputPath?: string;
    quality?: HfRenderQuality;
    width?: number;
    height?: number;
  },
): Promise<HfRenderJob> {
  const response = await authenticatedFetch(
    `/api/projects/${encodeURIComponent(projectName)}/hyperframes/render`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (response.status === 503) {
    const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '5', 10);
    return {
      jobId: '',
      status: 'failed',
      error: 'queue_full',
      retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : 5000,
    };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `render_start_failed:${response.status}`);
  }
  return response.json() as Promise<HfRenderJob>;
}

export async function pollHfRenderJob(
  projectName: string,
  jobId: string,
): Promise<HfRenderJob> {
  const response = await authenticatedFetch(
    `/api/projects/${encodeURIComponent(projectName)}/hyperframes/render/${encodeURIComponent(jobId)}`,
  );
  if (!response.ok) {
    throw new Error(`render_poll_failed:${response.status}`);
  }
  return response.json() as Promise<HfRenderJob>;
}

export async function renderHfProjectWithPolling(
  projectName: string,
  body: {
    projectDir: string;
    outputPath?: string;
    quality?: HfRenderQuality;
    taskArtifactDir?: string;
    sessionId?: string;
  },
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<HfRenderJob> {
  const maxAttempts = options?.maxAttempts ?? 900;
  const intervalMs = options?.intervalMs ?? 2000;
  let attempt = 0;
  let job = await startHfRender(projectName, body);
  while (job.error === 'queue_full' && attempt < 3) {
    await sleep(job.retryAfterMs ?? 5000);
    job = await startHfRender(projectName, body);
    attempt += 1;
  }
  if (!job.jobId) {
    throw new Error(job.error ?? 'render_start_failed');
  }
  for (let i = 0; i < maxAttempts; i += 1) {
    if (job.status === 'completed' || job.status === 'failed') break;
    await sleep(intervalMs);
    job = await pollHfRenderJob(projectName, job.jobId);
  }
  if (job.status === 'completed' && job.outputPath) {
    dispatchHfDeliverableUpdated({
      promoPath: job.outputPath,
      taskArtifactDir: body.taskArtifactDir,
      sessionId: body.sessionId,
    });
  }
  return job;
}
