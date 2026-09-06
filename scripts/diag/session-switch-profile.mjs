#!/usr/bin/env node
/**
 * PD-SAAS-FORK: session-switch diagnostic — jsonl sizes + Bridge messages API latency.
 *
 * Usage (dev stack running):
 *   node scripts/diag/session-switch-profile.mjs
 *
 * Env:
 *   SERVER_URL=http://127.0.0.1:3001
 *   DATA_ROOT=.saas-dev-data
 *   DIAG_TOP_N=12
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'session-switch-profile');
const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const DATA_ROOT = process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data');
const TOP_N = Number(process.env.DIAG_TOP_N || 12);
const USER = process.env.SAAS_E2E_USER || 'admin';
const PASS = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

function walkJsonlFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonlFiles(full, acc);
    else if (entry.name.endsWith('.jsonl')) acc.push(full);
  }
  return acc;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

async function login() {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function probeReady() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SERVER}/api/saas/health/ready`, { signal: AbortSignal.timeout(8_000) });
    return { ok: res.ok, ms: Math.round(performance.now() - t0), status: res.status };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - t0), status: 0, error: String(err) };
  }
}

async function probeMessages(token, sessionId, projectName) {
  const params = new URLSearchParams({
    projectName,
    provider: 'pilotdeck',
    limit: '120',
    direction: 'backward',
  });
  const t0 = performance.now();
  try {
    const res = await fetch(
      `${SERVER}/api/sessions/${encodeURIComponent(sessionId)}/messages?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) },
    );
    const ms = Math.round(performance.now() - t0);
    let payloadBytes = 0;
    let messageCount = 0;
    if (res.ok) {
      const text = await res.text();
      payloadBytes = Buffer.byteLength(text, 'utf8');
      try {
        const parsed = JSON.parse(text);
        messageCount = Array.isArray(parsed?.messages) ? parsed.messages.length : 0;
      } catch {
        /* ignore */
      }
    }
    return {
      ok: res.ok,
      ms,
      status: res.status,
      payloadBytes,
      messageCount,
    };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - t0), status: 0, error: String(err) };
  }
}

async function fetchSessionTargets(token) {
  const res = await fetch(`${SERVER}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`projects ${res.status}`);
  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects ?? [];
  const targets = [];
  for (const project of projects) {
    const projectName = project.name || project.id;
    for (const session of project.sessions ?? project.loadedSessions ?? []) {
      if (!session?.id || String(session.id).startsWith('new-session-')) continue;
      targets.push({ sessionId: session.id, projectName });
    }
  }
  return targets;
}

function inferSessionIdFromPath(jsonlPath) {
  const parts = jsonlPath.replace(/\\/g, '/').split('/');
  const chatsIdx = parts.lastIndexOf('chats');
  if (chatsIdx >= 0 && parts[chatsIdx + 1]) {
    const base = parts[chatsIdx + 1].replace(/\.jsonl$/, '');
    return base.startsWith('web-s_') ? base : `web-s_${base}`;
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonlFiles = walkJsonlFiles(path.join(DATA_ROOT, 'tenants'));
  const diskStats = jsonlFiles.map((filePath) => {
    const stat = fs.statSync(filePath);
    return {
      filePath: path.relative(REPO_ROOT, filePath),
      bytes: stat.size,
      mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
      sessionId: inferSessionIdFromPath(filePath),
      mtime: stat.mtime.toISOString(),
    };
  }).sort((a, b) => b.bytes - a.bytes);

  const totalBytes = diskStats.reduce((sum, row) => sum + row.bytes, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    dataRoot: DATA_ROOT,
    serverUrl: SERVER,
    disk: {
      jsonlCount: diskStats.length,
      totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      topLargest: diskStats.slice(0, TOP_N),
      over10Mb: diskStats.filter((r) => r.mb >= 10).length,
      over30Mb: diskStats.filter((r) => r.mb >= 30).length,
    },
    bridge: null,
    verdict: [],
  };

  let token;
  try {
    token = await login();
  } catch (err) {
    report.bridge = { error: `Bridge unreachable: ${err}` };
    report.verdict.push('Bridge 未启动或登录失败 — 请先 npm run dev');
    writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const ready = await probeReady();
  const targets = await fetchSessionTargets(token);
  const largestIds = new Set(diskStats.slice(0, TOP_N).map((r) => r.sessionId).filter(Boolean));
  const apiTargets = targets.filter((t) => largestIds.has(t.sessionId));
  const fallbackTargets = targets.slice(0, TOP_N);
  const probeList = apiTargets.length > 0 ? apiTargets : fallbackTargets;

  const probes = [];
  for (const { sessionId, projectName } of probeList) {
    const disk = diskStats.find((r) => r.sessionId === sessionId);
    const result = await probeMessages(token, sessionId, projectName);
    probes.push({
      sessionId,
      projectName,
      diskMb: disk?.mb ?? null,
      ...result,
      payloadMb: result.payloadBytes ? Number((result.payloadBytes / (1024 * 1024)).toFixed(2)) : 0,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  const latencies = probes.filter((p) => p.ok).map((p) => p.ms);
  report.bridge = {
    ready,
    sessionTargets: targets.length,
    probes,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
  };

  if (report.disk.over30Mb >= 3) {
    report.verdict.push(`磁盘侧：${report.disk.over30Mb} 个会话 jsonl ≥30MB — Bridge 尾读仍可能阻塞 event loop`);
  }
  if (report.bridge.latencyMs.p95 > 2000) {
    report.verdict.push(`Bridge messages API P95=${report.bridge.latencyMs.p95}ms — 切换会话时网络+解析是主因`);
  }
  if (ready.ms > 3000 || !ready.ok) {
    report.verdict.push(`ready 探针异常 (${ready.ms}ms) — Bridge 可能 wedged`);
  }
  const hugePayload = probes.filter((p) => p.payloadMb > 5);
  if (hugePayload.length > 0) {
    report.verdict.push(`${hugePayload.length} 个会话 API 响应 >5MB — 建议确认 SANITIZE/TAIL_READ 已开`);
  }
  if (report.verdict.length === 0) {
    report.verdict.push('Bridge 延迟与磁盘规模均在可接受范围 — 卡顿更可能来自前端全量 deliverable 扫描（已加 defer gate）');
  }

  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

function writeReport(report) {
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const outPath = path.join(OUT_DIR, `profile-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(`Wrote ${path.relative(REPO_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
