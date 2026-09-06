#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Stress GET /api/projects with parallel force=1 requests; expect coalescing.
 */
import { spawnSync } from 'node:child_process';

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const PARALLEL = Number(process.env.PROJECTS_COALESCE_PARALLEL || 6);
const gate = process.argv.includes('--gate');

async function login() {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return (await res.json()).token;
}

async function hitProjects(token, force) {
  const t0 = performance.now();
  const res = await fetch(`${SERVER}/api/projects${force ? '?fresh=1' : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  return { ok: res.ok, status: res.status, ms: performance.now() - t0 };
}

async function main() {
  const token = await login();
  const batch = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) => hitProjects(token, i % 2 === 0)),
  );
  const ok = batch.filter((r) => r.ok).length;
  const err503 = batch.filter((r) => r.status === 503).length;
  const hardFail = batch.filter((r) => !r.ok && r.status !== 503).length;
  const pass = hardFail === 0 && ok + err503 === PARALLEL;
  console.log(
    `[projects-coalesce] parallel=${PARALLEL} ok=${ok} 503=${err503} hard=${hardFail} pass=${pass}`,
  );
  if (gate && !pass) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
