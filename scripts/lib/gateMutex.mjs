/**
 * PD-SAAS-FORK: Mutual exclusion for production gate phases (E2E vs http-load spike).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_LOCK_PATH = path.join(REPO_ROOT, 'artifacts', 'pre-production-test', '.gate-lock');
const STALE_MS = Number(process.env.GATE_LOCK_STALE_MS || 4 * 60 * 60 * 1000);

export const GATE_PHASES = ['offline', 'e2e', 'load', 'live'];

/** @param {string} [lockPath] */
export function getGateLockPath(lockPath = process.env.GATE_LOCK_PATH) {
  return lockPath?.trim() ? path.resolve(lockPath) : DEFAULT_LOCK_PATH;
}

/**
 * @param {string} lockPath
 * @returns {{ pid: number, phase: string, holder: string, startedAt: string } | null}
 */
export function readGateLock(lockPath = getGateLockPath()) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {number} pid
 */
export function isProcessAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ lockPath?: string, phase: string, holder?: string, force?: boolean }} opts
 */
export function acquireGateLock(opts) {
  const lockPath = getGateLockPath(opts.lockPath);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const existing = readGateLock(lockPath);
  if (existing && !opts.force) {
    const age = Date.now() - Date.parse(existing.startedAt || 0);
    const alive = isProcessAlive(existing.pid);
    if (alive && age < STALE_MS) {
      return {
        ok: false,
        reason: `gate lock held by ${existing.holder || 'unknown'} phase=${existing.phase} pid=${existing.pid}`,
        lock: existing,
      };
    }
  }
  const payload = {
    pid: process.pid,
    phase: opts.phase,
    holder: opts.holder || process.argv[1] || 'gate',
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(lockPath, `${JSON.stringify(payload)}\n`, 'utf8');
  return { ok: true, lock: payload };
}

/** @param {{ lockPath?: string, phase?: string }} [opts] */
export function releaseGateLock(opts = {}) {
  const lockPath = getGateLockPath(opts.lockPath);
  const existing = readGateLock(lockPath);
  if (!existing) return { ok: true, released: false };
  if (existing.pid !== process.pid && isProcessAlive(existing.pid)) {
    return { ok: false, reason: 'lock owned by another process', lock: existing };
  }
  try {
    fs.unlinkSync(lockPath);
    return { ok: true, released: true };
  } catch {
    return { ok: true, released: false };
  }
}

/**
 * @param {string} requestedPhase
 * @param {string} [lockPath]
 */
export function assertGatePhaseAllowed(requestedPhase, lockPath = getGateLockPath()) {
  const existing = readGateLock(lockPath);
  if (!existing) return { ok: true };
  const alive = isProcessAlive(existing.pid);
  const age = Date.now() - Date.parse(existing.startedAt || 0);
  if (!alive || age >= STALE_MS) return { ok: true, stale: true };
  if (existing.phase === requestedPhase) return { ok: true };
  const conflicts =
    (existing.phase === 'e2e' && requestedPhase === 'load') ||
    (existing.phase === 'load' && requestedPhase === 'e2e') ||
    (existing.phase === 'live' && (requestedPhase === 'load' || requestedPhase === 'e2e'));
  if (conflicts) {
    return {
      ok: false,
      reason: `phase ${requestedPhase} conflicts with active ${existing.phase} (pid=${existing.pid})`,
      lock: existing,
    };
  }
  return { ok: true };
}
