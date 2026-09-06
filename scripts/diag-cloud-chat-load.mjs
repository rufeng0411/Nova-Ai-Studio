#!/usr/bin/env node
/**
 * PD-SAAS-FORK: diagnose cloud login + conversation load latency.
 * Usage: node scripts/diag-cloud-chat-load.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PROD_BASE_URL || 'https://www.novapage.online';
const USER = process.env.DIAG_USER || '84434775@qq.com';
const PASS = process.env.DIAG_PASS || 'Cs@19820208';

function ms(start) {
  return `${Date.now() - start}ms`;
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    console.log(`[OK] ${label}: ${ms(t0)}`);
    return { ok: true, ms: Date.now() - t0, result };
  } catch (err) {
    console.log(`[FAIL] ${label}: ${ms(t0)} — ${err instanceof Error ? err.message : err}`);
    return { ok: false, ms: Date.now() - t0, error: err };
  }
}

async function main() {
  console.log(`\n=== Cloud chat load diagnostic ===`);
  console.log(`BASE=${BASE}`);
  console.log(`USER=${USER}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiTimings = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    const path = new URL(url).pathname;
    if (
      path.includes('/messages')
      || path.includes('/projects')
      || path.includes('/auth/login')
      || path.includes('/sessions')
      || path.includes('/capabilities')
    ) {
      let size = 0;
      try {
        const buf = await resp.body();
        size = buf.length;
      } catch {
        size = -1;
      }
      apiTimings.push({
        path,
        status: resp.status(),
        ms: resp.request().timing()?.responseEnd ?? 0,
        size,
        query: new URL(url).search.slice(0, 120),
      });
    }
  });

  await timed('Navigate login page', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#saas-login-username', { timeout: 30_000 });
  });

  const login = await timed('Login API + redirect', async () => {
    await page.locator('#saas-login-username').fill(USER);
    await page.locator('#saas-login-password').fill(PASS);
    const loginResp = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.status() === 200,
      { timeout: 45_000 },
    );
    await page.getByRole('button', { name: /登录工作区|Sign in/i }).click();
    await loginResp;
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
  });

  const tailPaginationEnabled = await page.evaluate(() => {
    // Vite injects at build time; also check runtime behavior via fetch params later.
    return import.meta?.env?.VITE_TAIL_MESSAGE_PAGINATION ?? 'unknown';
  }).catch(() => 'n/a (not in module context)');

  console.log(`\nTail pagination flag (page): ${tailPaginationEnabled}`);

  const projectsStart = Date.now();
  await timed('Navigate /p/general', async () => {
    await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  });

  await timed('Wait composer visible', async () => {
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90_000 });
  });
  console.log(`Total to composer: ${Date.now() - projectsStart}ms`);

  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  if (!token) {
    console.error('No auth token after login');
    await browser.close();
    process.exit(1);
  }

  const request = context.request;
  const auth = { Authorization: `Bearer ${token}` };

  const projectsRes = await timed('GET /api/projects', async () => {
    const r = await request.get(`${BASE}/api/projects`, { headers: auth });
    if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
    return r.json();
  });

  const projects = Array.isArray(projectsRes.result)
    ? projectsRes.result
    : projectsRes.result?.projects ?? [];
  console.log(`Projects count: ${projects.length}`);

  let heaviestSession = null;
  let maxMessages = 0;
  for (const p of projects) {
    const sessions = p.sessions ?? [];
    for (const s of sessions) {
      const sid = s.id || s.sessionId;
      if (!sid) continue;
      const msgCount = s.messageCount ?? s.messages?.length ?? 0;
      if (msgCount > maxMessages || !heaviestSession) {
        maxMessages = msgCount;
        heaviestSession = { projectName: p.name || p.id, sessionId: sid, msgCount };
      }
    }
  }

  if (!heaviestSession) {
    const general = projects.find((p) => p.name === 'general' || p.id === 'general') ?? projects[0];
    const sessions = general?.sessions ?? [];
    if (sessions.length > 0) {
      heaviestSession = {
        projectName: general.name || general.id,
        sessionId: sessions[0].id || sessions[0].sessionId,
        msgCount: '?',
      };
    }
  }

  if (!heaviestSession) {
    console.log('No sessions found for message timing');
    await browser.close();
    return;
  }

  console.log(`\nTest session: ${heaviestSession.projectName} / ${heaviestSession.sessionId} (listed count: ${heaviestSession.msgCount})`);

  const sid = heaviestSession.sessionId;
  const pn = heaviestSession.projectName;

  const fullFetch = await timed('GET messages (no limit — full load)', async () => {
    const r = await request.get(
      `${BASE}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=${encodeURIComponent(pn)}`,
      { headers: auth },
    );
    if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
    const body = await r.json();
    const messages = body.messages ?? body;
    return {
      count: Array.isArray(messages) ? messages.length : 0,
      total: body.total,
      bytes: JSON.stringify(body).length,
    };
  });

  const tailFetch = await timed('GET messages (limit=120 backward)', async () => {
    const r = await request.get(
      `${BASE}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=${encodeURIComponent(pn)}&limit=120&direction=backward`,
      { headers: auth },
    );
    if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
    const body = await r.json();
    const messages = body.messages ?? body;
    return {
      count: Array.isArray(messages) ? messages.length : 0,
      total: body.total,
      nextCursor: body.nextCursor,
      bytes: JSON.stringify(body).length,
    };
  });

  console.log('\n--- Message API comparison ---');
  if (fullFetch.ok) {
    console.log(`Full:  ${fullFetch.result.count} msgs, total=${fullFetch.result.total}, ~${Math.round(fullFetch.result.bytes / 1024)}KB, ${fullFetch.ms}ms`);
  }
  if (tailFetch.ok) {
    console.log(`Tail:  ${tailFetch.result.count} msgs, total=${tailFetch.result.total}, nextCursor=${tailFetch.result.nextCursor}, ~${Math.round(tailFetch.result.bytes / 1024)}KB, ${tailFetch.ms}ms`);
    if (fullFetch.ok && tailFetch.ms > fullFetch.ms * 0.8) {
      console.log('⚠ Tail pagination does NOT reduce server time significantly (likely full transcript parse before slice)');
    }
  }

  const uiLoadStart = Date.now();
  await timed('Click session in sidebar (UI load)', async () => {
    const sessionLink = page.locator(`[data-session-id="${sid}"], a[href*="${sid}"]`).first();
    if (await sessionLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const msgResp = page.waitForResponse(
        (r) => r.url().includes('/messages') && r.status() === 200,
        { timeout: 120_000 },
      );
      await sessionLink.click();
      await msgResp;
    } else {
      await page.goto(`${BASE}/p/${encodeURIComponent(pn)}/s/${encodeURIComponent(sid)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForResponse(
        (r) => r.url().includes('/messages') && r.status() === 200,
        { timeout: 120_000 },
      );
    }
    await page.locator('[data-testid="chat-message"], .chat-message, [class*="MessageRow"]').first()
      .waitFor({ state: 'visible', timeout: 120_000 })
      .catch(() => page.waitForTimeout(3000));
  });
  console.log(`UI session paint: ${Date.now() - uiLoadStart}ms`);

  const bundleCheck = await timed('Check built JS for tail pagination flag', async () => {
    const r = await request.get(`${BASE}/`);
    const html = await r.text();
    const jsMatch = html.match(/assets\/index-[^"]+\.js/);
    if (!jsMatch) return { found: false };
    const jsUrl = `${BASE}/${jsMatch[0]}`;
    const js = await (await request.get(jsUrl)).text();
    const hasTailTrue = js.includes('VITE_TAIL_MESSAGE_PAGINATION","true') || js.includes('VITE_TAIL_MESSAGE_PAGINATION": "true"');
    const hasTailFalse = js.includes('VITE_TAIL_MESSAGE_PAGINATION","false') || js.includes('VITE_TAIL_MESSAGE_PAGINATION": "false"');
    return { jsUrl, hasTailTrue, hasTailFalse };
  });

  if (bundleCheck.ok) {
    console.log('\n--- Production bundle ---');
    console.log(JSON.stringify(bundleCheck.result, null, 2));
  }

  console.log('\n--- Captured API calls (sample) ---');
  for (const row of apiTimings.slice(-20)) {
    console.log(`${row.status} ${row.path}${row.query} (~${Math.round(row.size / 1024)}KB)`);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
