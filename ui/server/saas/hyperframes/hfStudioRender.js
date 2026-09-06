/**
 * PD-SAAS-FORK: Bridge HyperFrames Studio render API (async jobs + atomic write)
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getDataRoot } from '../tenant/paths.js';
import { getSaasRequestContext } from '../context.js';
import {
  appendHfStudioWriteAudit,
  validateHfStudioRenderPath,
} from '../storage/hfStudioWritePolicy.js';
import { acquirePromoRenderLock } from './hfPromoLock.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RENDER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'render-hyperframes.mjs');

const jobs = new Map();
let activeRenders = 0;

function maxConcurrent() {
  const raw = Number.parseInt(process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT ?? '1', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function jobFilePath(jobId) {
  return path.join(getDataRoot(), 'telemetry', 'hf-studio-jobs', `${jobId}.json`);
}

async function persistJob(job) {
  const file = jobFilePath(job.jobId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(job), 'utf8');
}

async function appendRenderAudit(entry) {
  const dir = path.join(getDataRoot(), 'telemetry');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'hf-studio-renders.jsonl'),
    `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
    { flag: 'a' },
  );
}

async function ffprobeDurationSec(filePath) {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.on('close', () => {
      const value = Number.parseFloat(stdout.trim());
      resolve(Number.isFinite(value) ? value : undefined);
    });
    child.on('error', () => resolve(undefined));
  });
}

async function runRenderJob(job, projectRoot) {
  const projectAbs = path.resolve(projectRoot, job.projectDir);
  const outputRel = job.outputPath;
  const outputAbs = path.resolve(projectRoot, outputRel);
  const taskDir = path.dirname(outputAbs);
  const partialDir = path.join(taskDir, '.hf-render');
  const partialPath = path.join(partialDir, `${job.jobId}.mp4.partial`);
  const logPath = path.join(partialDir, `${job.jobId}.log`);

  await mkdir(partialDir, { recursive: true });

  const lock = await acquirePromoRenderLock(taskDir, 'bridge');
  if (!lock.ok) {
    job.status = 'failed';
    job.error = lock.error ?? 'render_in_progress';
    await persistJob(job);
    return;
  }

  try {
    job.status = 'running';
    await persistJob(job);

    await new Promise((resolve, reject) => {
      const args = [
        RENDER_SCRIPT,
        '--project-dir', projectAbs,
        '--output', partialPath,
        '--quality', job.quality ?? 'draft',
      ];
      if (job.width) args.push('--width', String(job.width));
      if (job.height) args.push('--height', String(job.height));

      const child = spawn(process.execPath, args, {
        cwd: REPO_ROOT,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', async (code) => {
        const log = `${stdout}\n${stderr}`.slice(-8000);
        await writeFile(logPath, log, 'utf8').catch(() => {});
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `render exited ${code}`));
          return;
        }
        resolve(undefined);
      });
    });

    const info = await stat(partialPath);
    if (!info.isFile() || info.size <= 0) {
      throw new Error('render_empty');
    }

    const durationSec = await ffprobeDurationSec(partialPath);
    await rename(partialPath, outputAbs);

    job.status = 'completed';
    job.bytes = info.size;
    job.durationSec = durationSec;
    job.outputPath = outputRel;
    await persistJob(job);

    const ctx = getSaasRequestContext();
    await appendRenderAudit({
      tenantId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
      projectDir: job.projectDir,
      outputPath: job.outputPath,
      quality: job.quality,
      bytes: job.bytes,
      durationSec: job.durationSec,
      exitCode: 0,
      jobId: job.jobId,
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    await persistJob(job);
    const ctx = getSaasRequestContext();
    await appendRenderAudit({
      tenantId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
      projectDir: job.projectDir,
      outputPath: job.outputPath,
      quality: job.quality,
      exitCode: 1,
      error: job.error,
      jobId: job.jobId,
    });
  } finally {
    await lock.release?.();
    activeRenders = Math.max(0, activeRenders - 1);
  }
}

export function getHfRenderJob(jobId) {
  return jobs.get(jobId) ?? null;
}

export async function createHfRenderJob(projectRoot, body) {
  const validation = validateHfStudioRenderPath(body.projectDir, body.outputPath);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.status = 403;
    throw err;
  }

  if (activeRenders >= maxConcurrent()) {
    const err = new Error('HyperFrames render queue full');
    err.status = 503;
    err.retryAfter = 5;
    throw err;
  }

  const ctx = getSaasRequestContext();
  const userJobs = [...jobs.values()].filter(
    (j) => j.userId === ctx?.userId && (j.status === 'queued' || j.status === 'running'),
  );
  if (userJobs.length >= 1) {
    const err = new Error('User already has an active render job');
    err.status = 503;
    err.retryAfter = 3;
    throw err;
  }

  const jobId = randomUUID();
  const outputPath = body.outputPath
    ?? `${validation.taskRoot}/promo.mp4`;

  const job = {
    jobId,
    status: 'queued',
    projectDir: body.projectDir.replace(/\\/g, '/'),
    outputPath: outputPath.replace(/\\/g, '/'),
    quality: body.quality === 'high' ? 'high' : 'draft',
    width: body.width,
    height: body.height,
    userId: ctx?.userId ?? null,
    tenantId: ctx?.tenantId ?? null,
    createdAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);
  activeRenders += 1;
  await persistJob(job);

  setImmediate(() => {
    runRenderJob(job, projectRoot).catch((error) => {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      persistJob(job).catch(() => {});
      activeRenders = Math.max(0, activeRenders - 1);
    });
  });

  return job;
}

export async function runHfDoctor(projectDir, projectRoot) {
  const validation = validateHfStudioProjectDir(projectDir);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.status = 403;
    throw err;
  }
  const projectAbs = path.resolve(projectRoot, projectDir);
  return new Promise((resolve) => {
    const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['hyperframes', 'doctor', '--json'], {
      cwd: projectAbs,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    let stdout = '';
    proc.stdout?.on('data', (c) => { stdout += c.toString(); });
    proc.on('close', () => {
      try {
        const start = stdout.indexOf('{');
        const end = stdout.lastIndexOf('}');
        const payload = start >= 0 ? JSON.parse(stdout.slice(start, end + 1)) : { ok: false };
        resolve(payload);
      } catch {
        resolve({ ok: false, checks: [] });
      }
    });
    proc.on('error', () => resolve({ ok: false, checks: [] }));
  });
}

export { appendHfStudioWriteAudit };
