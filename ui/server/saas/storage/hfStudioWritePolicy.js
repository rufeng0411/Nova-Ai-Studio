/**
 * PD-SAAS-FORK: SaaS HyperFrames Studio write policy — hf-project whitelist + audit
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const HF_PROJECT_ROOT_RE = /(?:^|[\\/])artifacts[\\/]task-[^\\/]+[\\/]hf-project(?:[\\/]|$)/i;
const BACKUP_DIR_RE = /(?:^|[\\/])\.nova-edit-backups(?:[\\/]|$)/i;
const ALLOWED_EXT_RE = /\.(html?|css|js|mjs|json|svg|png|jpe?g|webp|woff2)$/i;

export const HF_STUDIO_MAX_BYTES = 5 * 1024 * 1024;

function sha256Content(content) {
  return createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex');
}

export function isHfStudioWritePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('../') || normalized.includes('..\\')) return false;
  if (/promo\.mp4$/i.test(normalized)) return false;
  if (!HF_PROJECT_ROOT_RE.test(normalized)) return false;
  if (BACKUP_DIR_RE.test(normalized)) return true;
  return ALLOWED_EXT_RE.test(normalized);
}

export function validateHfStudioWrite(afterContent) {
  const after = String(afterContent ?? '');
  if (Buffer.byteLength(after, 'utf8') > HF_STUDIO_MAX_BYTES) {
    return { ok: false, error: 'HF project file exceeds size limit (5MB).' };
  }
  return { ok: true };
}

export async function appendHfStudioWriteAudit(dataRoot, entry) {
  if (!dataRoot) return;
  const dir = path.join(dataRoot, 'telemetry');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  await appendFile(path.join(dir, 'hf-studio-writes.jsonl'), `${line}\n`, 'utf8');
}

export function sha256ContentHex(content) {
  return sha256Content(content);
}

export function validateHfStudioProjectDir(projectDir) {
  const project = String(projectDir || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!HF_PROJECT_ROOT_RE.test(`${project}/`)) {
    return { ok: false, error: 'projectDir must be artifacts/task-*/hf-project' };
  }
  if (!project.endsWith('/hf-project') && !project.endsWith('hf-project')) {
    return { ok: false, error: 'projectDir must end with /hf-project' };
  }
  const taskMatch = project.match(/^(artifacts\/task-[^/]+)/i);
  if (!taskMatch) {
    return { ok: false, error: 'projectDir must be under artifacts/task-*' };
  }
  return { ok: true, taskRoot: taskMatch[1] };
}

export function validateHfStudioRenderPath(projectDir, outputPath) {
  const project = String(projectDir || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const output = String(outputPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!HF_PROJECT_ROOT_RE.test(`${project}/`)) {
    return { ok: false, error: 'projectDir must be artifacts/task-*/hf-project' };
  }
  if (!project.endsWith('/hf-project') && !project.endsWith('hf-project')) {
    return { ok: false, error: 'projectDir must end with /hf-project' };
  }
  const taskMatch = project.match(/^(artifacts\/task-[^/]+)/i);
  if (!taskMatch) {
    return { ok: false, error: 'projectDir must be under artifacts/task-*' };
  }
  const taskRoot = taskMatch[1];
  if (!output.startsWith(`${taskRoot}/`)) {
    return { ok: false, error: 'outputPath must stay inside task directory' };
  }
  if (!/\.mp4$/i.test(output)) {
    return { ok: false, error: 'outputPath must be .mp4' };
  }
  return { ok: true, taskRoot };
}
