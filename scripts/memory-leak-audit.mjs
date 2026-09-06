#!/usr/bin/env node
/**
 * PD-SAAS-FORK: deep memory leak audit for Nova/PilotDeck dev stack.
 *
 * Combines:
 * 1) static code-risk inventory (unbounded caches / missing cleanup)
 * 2) Node process RSS sampling under API stress
 * 3) Playwright browser JS heap sampling under session-switch stress
 *
 * Usage:
 *   npm run dev:saas   # separate terminal
 *   node scripts/memory-leak-audit.mjs
 *
 * Env:
 *   VITE_URL=http://127.0.0.1:5173
 *   SERVER_URL=http://127.0.0.1:7990
 *   MEM_AUDIT_ROUNDS=40          (default 40)
 *   MEM_AUDIT_BROWSER_ROUNDS=12  (default 12)
 *   MEM_AUDIT_RSS_MAX_GROWTH=0.25 (fail gate, default 25%)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'memory-audit');
const VITE_URL = (process.env.VITE_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const SERVER_URL = (process.env.SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const ROUNDS = Number(process.env.MEM_AUDIT_ROUNDS || 40);
const BROWSER_ROUNDS = Number(process.env.MEM_AUDIT_BROWSER_ROUNDS || 12);
const RSS_MAX_GROWTH = Number(process.env.MEM_AUDIT_RSS_MAX_GROWTH || 0.25);

/** @type {Array<{ id: string, severity: 'high' | 'medium' | 'low', area: string, detail: string, mitigation?: string }>} */
const STATIC_RISKS = [
  {
    id: 'bridge-session-state',
    severity: 'high',
    area: 'ui/server/pilotdeck-bridge.js',
    detail: 'sessionState Map 只增不减，关闭/删除会话时无 delete；长期运行会话数累积会抬高 Bridge RSS。',
    mitigation: '在 session close/delete 事件与 catalog tombstone 时 sessionState.delete(sessionKey)。',
  },
  {
    id: 'bridge-title-cache',
    severity: 'medium',
    area: 'ui/server/pilotdeck-bridge.js',
    detail: '_sessionTitleCache 进程级永久缓存，无 LRU/TTL；大量历史会话浏览后常驻内存。',
    mitigation: '改为 LRU(cap≈500) 或按 mtime 失效。',
  },
  {
    id: 'bridge-transcript-caches',
    severity: 'medium',
    area: 'ui/server/pilotdeck-bridge.js',
    detail: '_userQueriesCache/_toolSequenceCache/_subagentPromptCache 按 session 键缓存，旧 session 条目不淘汰。',
    mitigation: 'LRU 或定期 sweep；删除会话时 invalidate。',
  },
  {
    id: 'ui-session-store',
    severity: 'high',
    area: 'ui/src/stores/useSessionStore.ts',
    detail: 'storeRef Map 按 sessionId 永久保留 serverMessages/merged；切换会话不清 slot，多会话长任务会线性涨前端堆。',
    mitigation: 'LRU 保留最近 N 个 slot，或 inactive 超过 TTL 时 prune serverMessages 仅留 tail。',
  },
  {
    id: 'ui-active-turn-dedupe',
    severity: 'medium',
    area: 'ui/src/components/chat/hooks/useChatRealtimeHandlers.ts',
    detail: 'seenActiveTurnFrameRef Set 重连后不清，仅 websocket-reconnected 清 stream 累加器；长跑+多次重连可能膨胀。',
    mitigation: 'reconnect 时 seenActiveTurnFrameRef.clear() 或 cap 大小。',
  },
  {
    id: 'gateway-session-router',
    severity: 'low',
    area: 'src/gateway/SessionRouter.ts',
    detail: 'AgentSession 30min idle sweep + onSessionEvict；设计上有界，但单 session 大 transcript/tool state 仍可能短期峰值。',
    mitigation: '监控单 session RSS；长任务后显式 close。',
  },
  {
    id: 'capabilities-hub-cache',
    severity: 'low',
    area: 'ui/server/routes/capabilities.js',
    detail: 'hubResponseCache 有 HUB_RESPONSE_CACHE_MAX=48 FIFO 淘汰；Redis fallback memoryStore 有 TTL purge。',
    mitigation: '已有限界，持续观察即可。',
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function formatMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/** Windows: find PID listening on port */
function pidOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, { encoding: 'utf8' });
    const line = out.split('\n').map((l) => l.trim()).find(Boolean);
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

/** Windows WorkingSet via PowerShell */
function sampleProcessRssMb(pid) {
  if (!pid) return null;
  try {
    const ps = `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).WorkingSet64`;
    const raw = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' }).trim();
    const bytes = Number(raw);
    if (!Number.isFinite(bytes) || bytes <= 0) return null;
    return formatMb(bytes);
  } catch {
    return null;
  }
}

async function waitForServer(url, label, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/saas/captcha`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(2000);
  }
  throw new Error(`${label} 未就绪: ${url}`);
}

async function loginToken() {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const json = await res.json();
  const token = json?.token || json?.accessToken;
  if (!token) throw new Error('login response missing token');
  return token;
}

async function apiStressRound(token, sessionIds) {
  const headers = { Authorization: `Bearer ${token}` };
  const projectsRes = await fetch(`${SERVER_URL}/api/projects?fresh=1`, { headers });
  const projectsJson = await projectsRes.json();
  const projects = Array.isArray(projectsJson) ? projectsJson : projectsJson?.projects || [];

  await fetch(`${SERVER_URL}/api/capabilities/hub?locale=zh-CN`, { headers });

  for (const project of projects.slice(0, 3)) {
    const name = project?.name || project?.projectName;
    if (!name) continue;
    const listRes = await fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(name)}/sessions`, { headers });
    const sessions = await listRes.json();
    const ids = (Array.isArray(sessions) ? sessions : sessions?.sessions || [])
      .map((s) => s?.id || s?.sessionId)
      .filter(Boolean)
      .slice(0, 5);
    sessionIds.push(...ids);

    for (const sid of ids.slice(0, 3)) {
      await fetch(
        `${SERVER_URL}/api/projects/${encodeURIComponent(name)}/sessions/${encodeURIComponent(sid)}/messages?limit=120&direction=backward`,
        { headers },
      );
    }
  }

  await fetch(`${SERVER_URL}/api/saas/captcha`);
}

async function runNodeStress(token, bridgePid, gatewayPid) {
  const bridgeSamples = [];
  const gatewaySamples = [];
  const sessionIds = [];

  for (let i = 0; i < ROUNDS; i += 1) {
    await apiStressRound(token, sessionIds);
    bridgeSamples.push(sampleProcessRssMb(bridgePid));
    gatewaySamples.push(sampleProcessRssMb(gatewayPid));
    if ((i + 1) % 10 === 0) {
      console.log(`[memory-audit] API stress ${i + 1}/${ROUNDS} bridge=${bridgeSamples.at(-1)}MB gateway=${gatewaySamples.at(-1)}MB`);
    }
    await sleep(150);
  }

  const bridgeClean = bridgeSamples.filter((v) => typeof v === 'number');
  const gatewayClean = gatewaySamples.filter((v) => typeof v === 'number');

  return {
    bridge: {
      samples: bridgeClean,
      startMb: bridgeClean[0] ?? null,
      endMb: bridgeClean.at(-1) ?? null,
      peakMb: bridgeClean.length ? Math.max(...bridgeClean) : null,
      p95Mb: bridgeClean.length ? percentile(bridgeClean, 95) : null,
      growthPct: bridgeClean.length >= 2 && bridgeClean[0] > 0
        ? Number((((bridgeClean.at(-1) - bridgeClean[0]) / bridgeClean[0]) * 100).toFixed(1))
        : null,
    },
    gateway: {
      samples: gatewayClean,
      startMb: gatewayClean[0] ?? null,
      endMb: gatewayClean.at(-1) ?? null,
      peakMb: gatewayClean.length ? Math.max(...gatewayClean) : null,
      p95Mb: gatewayClean.length ? percentile(gatewayClean, 95) : null,
      growthPct: gatewayClean.length >= 2 && gatewayClean[0] > 0
        ? Number((((gatewayClean.at(-1) - gatewayClean[0]) / gatewayClean[0]) * 100).toFixed(1))
        : null,
    },
    uniqueSessionIds: [...new Set(sessionIds)].length,
  };
}

async function sampleBrowserHeap(page) {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('HeapProfiler.collectGarbage');
  } catch {
    // optional
  }
  let jsHeapUsed = null;
  let jsHeapTotal = null;
  try {
    const metrics = await client.send('Performance.getMetrics');
    const byName = Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));
    jsHeapUsed = byName.JSHeapUsedSize ?? byName.HeapUsedSize ?? null;
    jsHeapTotal = byName.JSHeapTotalSize ?? byName.HeapTotalSize ?? null;
  } catch {
    // fallback below
  }
  if (jsHeapUsed == null) {
    const perf = await page.evaluate(() => {
      const mem = performance.memory;
      if (!mem) return null;
      return { used: mem.usedJSHeapSize, total: mem.totalJSHeapSize };
    });
    if (perf) {
      jsHeapUsed = perf.used;
      jsHeapTotal = perf.total;
    }
  }
  await client.detach();
  return {
    jsHeapUsedMb: jsHeapUsed != null ? formatMb(jsHeapUsed) : null,
    jsHeapTotalMb: jsHeapTotal != null ? formatMb(jsHeapTotal) : null,
  };
}

async function runBrowserStress() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await ensurePlaywrightWorkspace(page, VITE_URL);

  const baseline = await sampleBrowserHeap(page);
  const samples = [baseline.jsHeapUsedMb];

  // Stress: reload + switch sessions via sidebar if available
  for (let i = 0; i < BROWSER_ROUNDS; i += 1) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const sidebarItems = page.locator('[data-session-id], .sidebar-session-item, a[href*="/c/"]');
    const count = await sidebarItems.count();
    if (count > 0) {
      const idx = i % Math.min(count, 8);
      await sidebarItems.nth(idx).click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(600);
    }
    const heap = await sampleBrowserHeap(page);
    if (heap.jsHeapUsedMb != null) samples.push(heap.jsHeapUsedMb);
    if ((i + 1) % 4 === 0) {
      console.log(`[memory-audit] browser round ${i + 1}/${BROWSER_ROUNDS} heap=${heap.jsHeapUsedMb}MB`);
    }
  }

  await browser.close();

  const clean = samples.filter((v) => typeof v === 'number');
  return {
    baselineMb: baseline.jsHeapUsedMb,
    endMb: clean.at(-1) ?? null,
    peakMb: clean.length ? Math.max(...clean) : null,
    growthPct: clean.length >= 2 && clean[0] > 0
      ? Number((((clean.at(-1) - clean[0]) / clean[0]) * 100).toFixed(1))
      : null,
    samples: clean,
  };
}

function evaluateReport(report) {
  const runtimeIssues = [];
  const staticIssues = STATIC_RISKS.filter((r) => r.severity === 'high').map((r) => `static:${r.id}`);

  const bridgeGrowth = report.runtime?.bridge?.growthPct;
  const gatewayGrowth = report.runtime?.gateway?.growthPct;
  const browserGrowth = report.browser?.growthPct;

  if (typeof bridgeGrowth === 'number' && bridgeGrowth / 100 > RSS_MAX_GROWTH) {
    runtimeIssues.push('runtime:bridge-rss');
  }
  if (typeof gatewayGrowth === 'number' && gatewayGrowth / 100 > RSS_MAX_GROWTH) {
    runtimeIssues.push('runtime:gateway-rss');
  }
  if (typeof browserGrowth === 'number' && browserGrowth / 100 > RSS_MAX_GROWTH) {
    runtimeIssues.push('runtime:browser-heap');
  }
  if (report.browser?.baselineMb == null && report.browser?.endMb == null) {
    runtimeIssues.push('runtime:browser-heap-unavailable');
  }

  report.staticIssues = staticIssues;
  report.runtimeIssues = runtimeIssues;
  report.issues = [...staticIssues, ...runtimeIssues];
  report.pass = runtimeIssues.length === 0;
  report.gate = {
    rssMaxGrowthPct: RSS_MAX_GROWTH * 100,
    note: 'PASS 仅看运行时 RSS/堆增幅；静态 high 风险单独列出供修复跟踪。',
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('[memory-audit] waiting for Bridge/API…');
  await waitForServer(SERVER_URL, 'Bridge');

  const bridgePid = pidOnPort(3001) || pidOnPort(3002);
  const gatewayPid = pidOnPort(18789) || pidOnPort(18790);
  console.log(`[memory-audit] bridgePid=${bridgePid ?? 'n/a'} gatewayPid=${gatewayPid ?? 'n/a'}`);

  const token = await loginToken();

  console.log(`[memory-audit] API stress rounds=${ROUNDS}…`);
  const runtime = await runNodeStress(token, bridgePid, gatewayPid);

  console.log(`[memory-audit] browser stress rounds=${BROWSER_ROUNDS}…`);
  const browser = await runBrowserStress();

  const report = {
    generatedAt: new Date().toISOString(),
    env: { VITE_URL, SERVER_URL, ROUNDS, BROWSER_ROUNDS, RSS_MAX_GROWTH },
    pids: { bridgePid, gatewayPid },
    staticRisks: STATIC_RISKS,
    runtime,
    browser,
    summary: {
      staticHighCount: STATIC_RISKS.filter((r) => r.severity === 'high').length,
      staticMediumCount: STATIC_RISKS.filter((r) => r.severity === 'medium').length,
      bridgeRssGrowthPct: runtime.bridge.growthPct,
      gatewayRssGrowthPct: runtime.gateway.growthPct,
      browserHeapGrowthPct: browser.growthPct,
    },
  };

  evaluateReport(report);

  const outPath = path.join(OUT_DIR, `memory-audit-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\n=== Memory Leak Audit Summary ===');
  console.log(`Bridge RSS: ${runtime.bridge.startMb} → ${runtime.bridge.endMb} MB (${runtime.bridge.growthPct}%)`);
  console.log(`Gateway RSS: ${runtime.gateway.startMb} → ${runtime.gateway.endMb} MB (${runtime.gateway.growthPct}%)`);
  console.log(`Browser heap: ${browser.baselineMb} → ${browser.endMb} MB (${browser.growthPct}%)`);
  console.log(`Static risks: high=${report.summary.staticHighCount} medium=${report.summary.staticMediumCount}`);
  console.log(`Issues: ${report.issues.join(', ') || 'none'}`);
  console.log(`Report: ${outPath}`);
  console.log(`PASS: ${report.pass}`);

  if (!report.pass) process.exit(1);
}

main().catch((error) => {
  console.error('[memory-audit] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
