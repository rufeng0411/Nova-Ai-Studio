#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Full-chain conversation stability — HTTP API + Playwright (folder/deliverables/images/sessions).
 * Usage: VITE_URL=http://127.0.0.1:8081 SERVER_URL=http://127.0.0.1:7990 node scripts/ui-conversation-stability-deep-check.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';

const BASE_URL = (process.env.VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const BRIDGE_URL = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const ROUND = process.env.STABILITY_ROUND || '1';
const OUT_DIR = path.resolve('artifacts', 'media-smoke', 'ui-conversation-stability', `round-${ROUND}`);
const USER = process.env.SAAS_E2E_USER || 'admin';
const PASS = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';
const HTTP_TIMEOUT_MS = Number(process.env.STABILITY_HTTP_TIMEOUT_MS || 12_000);

const failures = [];

function fail(id, detail) {
  failures.push({ id, detail });
}

async function fetchTimed(url, options = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const ms = Date.now() - started;
    let json;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, ms, json };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runHttpProbes(token, report) {
  const auth = { Authorization: `Bearer ${token}` };

  const ready = await fetchTimed(`${BRIDGE_URL}/api/saas/health/ready`);
  report.http = { ready };
  if (!ready.ok || !ready.json?.ok) {
    fail('health_ready', `ready probe failed ${ready.status} ${ready.error || JSON.stringify(ready.json)}`);
  } else if (ready.ms > 3_000) {
    fail('health_ready_slow', `ready ${ready.ms}ms > 3000ms`);
  }

  const projects = await fetchTimed(`${BRIDGE_URL}/api/projects`, { headers: auth });
  report.http.projects = projects;
  if (!projects.ok) {
    fail('projects', `GET /api/projects ${projects.status} ${projects.error || ''}`);
    return null;
  }
  if (projects.ms > 8_000) {
    fail('projects_slow', `projects ${projects.ms}ms`);
  }

  const projectList = Array.isArray(projects.json) ? projects.json : projects.json?.projects ?? [];
  const general = projectList.find((p) => p.name === 'general' || p.id === 'general') ?? projectList[0];
  if (!general) {
    fail('projects_empty', 'no projects');
    return null;
  }

  const projectName = general.name || general.id || 'general';
  const sessions = general.sessions ?? general.loadedSessions ?? [];
  const session = sessions.find((s) => (s.messageCount ?? 0) > 0) ?? sessions[0];
  if (session?.id) {
    const messages = await fetchTimed(
      `${BRIDGE_URL}/api/sessions/${encodeURIComponent(session.id)}/messages?projectName=${encodeURIComponent(projectName)}&limit=30`,
      { headers: auth },
    );
    report.http.messages = { sessionId: session.id, ...messages };
    if (!messages.ok) {
      fail('messages', `session messages ${messages.status} ${messages.error || ''}`);
    } else if (messages.ms > 6_000) {
      fail('messages_slow', `messages ${messages.ms}ms`);
    }
  } else {
    report.http.messages = { skipped: true, reason: 'no session' };
  }

  const hub = await resolveGeneralWorkspaceCwd({ serverUrl: BRIDGE_URL });
  const fixtureRel = 'artifacts/media-smoke/stability-deep/page.html';
  const fixtureDir = 'artifacts/media-smoke/stability-deep';
  const pngRel = `${fixtureDir}/thumb.png`;
  if (hub) {
    const absHtml = path.join(hub, fixtureRel);
    const absPng = path.join(hub, pngRel);
    await fs.mkdir(path.dirname(absHtml), { recursive: true });
    await fs.writeFile(
      absHtml,
      '<!doctype html><html><head><title>Stability</title></head><body><h1>Stability Deep</h1></body></html>',
      'utf8',
    );
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await fs.writeFile(absPng, pngBuf);

    const resolveProbe = await fetchTimed(
      `${BRIDGE_URL}/api/projects/${encodeURIComponent(projectName)}/file/resolve?filePath=${encodeURIComponent(path.basename(fixtureRel))}&hintDir=${encodeURIComponent(fixtureDir)}`,
      { headers: auth },
    );
    report.http.fileResolve = resolveProbe;
    if (!resolveProbe.ok || !resolveProbe.json?.ok) {
      fail('file_resolve', `resolve failed ${resolveProbe.status} ${JSON.stringify(resolveProbe.json || resolveProbe.error)}`);
    } else if (resolveProbe.ms > 4_000) {
      fail('file_resolve_slow', `${resolveProbe.ms}ms`);
    }

    const validateProbe = await fetchTimed(
      `${BRIDGE_URL}/api/projects/${encodeURIComponent(projectName)}/deliverables/validate`,
      {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [fixtureRel, pngRel], hintDir: fixtureDir }),
      },
    );
    report.http.validate = validateProbe;
    if (!validateProbe.ok) {
      fail('validate', `validate ${validateProbe.status}`);
    } else {
      const items = validateProbe.json?.items ?? [];
      const verified = items.filter((i) => i.status === 'verified' || i.status === 'softVerified');
      if (verified.length < 1) {
        fail('validate_items', `expected verified items, got ${JSON.stringify(items)}`);
      }
      if (validateProbe.ms > 5_000) {
        fail('validate_slow', `${validateProbe.ms}ms`);
      }
    }

    const fileRead = await fetchTimed(
      `${BRIDGE_URL}/api/projects/${encodeURIComponent(projectName)}/file?filePath=${encodeURIComponent(pngRel)}`,
      { headers: auth },
    );
    report.http.fileRead = { status: fileRead.status, ms: fileRead.ms, ok: fileRead.ok };
    if (!fileRead.ok) {
      fail('file_read', `png read ${fileRead.status}`);
    }

    const filesList = await fetchTimed(
      `${BRIDGE_URL}/api/projects/${encodeURIComponent(projectName)}/files/list?path=${encodeURIComponent('artifacts/media-smoke')}`,
      { headers: auth },
    );
    report.http.filesList = filesList;
    if (!filesList.ok) {
      fail('files_list', `files/list ${filesList.status}`);
    } else if (filesList.ms > 5_000) {
      fail('files_list_slow', `${filesList.ms}ms`);
    }
  } else {
    fail('hub_cwd', 'resolveGeneralWorkspaceCwd returned null');
  }

  return { projectName, session, fixtureRel, fixtureDir, pngRel };
}

async function runPlaywrightProbes(ctx, report) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await ensurePlaywrightWorkspace(page, BASE_URL);

    const newChat = page.getByRole('button', { name: /New Chat|新建对话|新对话/i }).first();
    if (await newChat.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newChat.click({ timeout: 10_000 });
      await page.waitForTimeout(800);
    }
    const composer = page.locator('textarea').first();
    await composer.waitFor({ state: 'visible', timeout: 15_000 });
    report.playwright = { newChatComposer: true };

    if (ctx?.session?.id) {
      const sessionLink = page.locator(`[data-session-id="${ctx.session.id}"], a[href*="${ctx.session.id}"]`).first();
      if (await sessionLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await sessionLink.click();
      } else {
        const sidebarRow = page.getByText(ctx.session.title || ctx.session.name || '').first();
        if (await sidebarRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await sidebarRow.click();
        }
      }
      await page.waitForTimeout(2_000);
      const loading = page.getByText(/正在载入对话|Loading conversation/i);
      const stuck = await loading.isVisible({ timeout: 2_000 }).catch(() => false);
      if (stuck) {
        await page.waitForTimeout(8_000);
        if (await loading.isVisible().catch(() => false)) {
          fail('playwright_session_loading_stuck', 'still loading after 10s');
        }
      }
      report.playwright.oldSessionOpened = true;
    }

    const filesTab = page.getByRole('button', { name: /文件|Files/i }).first();
    if (await filesTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await filesTab.click();
      await page.waitForTimeout(2_500);
      report.playwright.filesTab = true;
    } else {
      fail('playwright_files_tab', 'files tab not visible');
    }

    const expandArtifacts = page.getByText(/^artifacts$/i).first();
    if (await expandArtifacts.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await expandArtifacts.click();
      await page.waitForTimeout(600);
    }
    const expandMediaSmoke = page.getByText(/media-smoke/i).first();
    if (await expandMediaSmoke.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await expandMediaSmoke.click();
      await page.waitForTimeout(600);
    }

    const treeNode = page.getByText(/ui-preview-test|page-a\.html|stability-deep|thumb\.png/i).first();
    report.playwright.fixtureInTree = await treeNode.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!report.playwright.fixtureInTree) {
      fail('playwright_fixture_tree', 'known artifact not visible in file tree');
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'playwright-final.png'), fullPage: true });
  } catch (error) {
    fail('playwright_error', error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: path.join(OUT_DIR, 'playwright-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    round: ROUND,
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    bridgeUrl: BRIDGE_URL,
    failures: [],
  };

  const login = await fetchTimed(`${BRIDGE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  report.http = { login };
  if (!login.ok || !login.json?.token) {
    fail('login', `login failed ${login.status} ${login.error || ''}`);
    report.failures = failures;
    report.passed = false;
    await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.error(`[ui-conversation-stability-deep] FAIL round ${ROUND}`, failures);
    process.exit(1);
  }
  if (login.ms > 5_000) {
    fail('login_slow', `${login.ms}ms`);
  }

  const ctx = await runHttpProbes(login.json.token, report);
  await runPlaywrightProbes(ctx, report);

  report.failures = failures;
  report.passed = failures.length === 0;
  report.endedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ round: ROUND, passed: report.passed, failures, httpMs: {
    login: login.ms,
    ready: report.http?.ready?.ms,
    projects: report.http?.projects?.ms,
    messages: report.http?.messages?.ms,
  } }, null, 2));
  if (!report.passed) process.exit(1);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
