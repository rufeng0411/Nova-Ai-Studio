#!/usr/bin/env node
/**
 * PD-SAAS-FORK: smoke — session delete must not reappear in /api/projects after fresh fetch.
 * Requires dev stack: Bridge on PILOTDECK_UI_PORT (default 5173) with SaaS mode.
 */
import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const REPO_ROOT = process.env.SMOKE_REPO_ROOT || process.cwd();

const BASE = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PILOTDECK_UI_PORT || '5173'}`;
const ADMIN_USER = process.env.SMOKE_USER || 'admin';
const ADMIN_PASS = process.env.SMOKE_PASS || 'SAAS_ADMIN_PASSWORD';

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { response, json };
}

function fail(message) {
  console.error(`[delete-smoke] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[delete-smoke] OK: ${message}`);
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    fail(`dev server not reachable at ${BASE}/api/health — start npm run dev first`);
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const token = login.json?.token;
  if (!login.response.ok || !token) {
    fail(`login failed: ${login.response.status} ${JSON.stringify(login.json)}`);
  }
  ok('authenticated');

  const projectsResp = await request('/api/projects?fresh=1&_=' + Date.now(), { token });
  if (!projectsResp.response.ok || !Array.isArray(projectsResp.json)) {
    fail(`projects list failed: ${projectsResp.response.status}`);
  }
  const project = projectsResp.json.find((p) => p?.name) || projectsResp.json[0];
  if (!project?.name) fail('no project available for smoke test');
  ok(`using project ${project.name}`);

  const sessionId = `web-s_smoke-delete-${Date.now()}`;
  const chatDir = await resolveChatsDir(project.name);
  if (!chatDir) fail('could not resolve transcript chats dir for project');

  await mkdir(chatDir, { recursive: true });
  const transcriptPath = join(chatDir, `${sessionId}.jsonl`);
  const line = JSON.stringify({
    type: 'accepted_input',
    sessionId,
    turnId: 'turn-1',
    sequence: 1,
    createdAt: new Date().toISOString(),
    entryId: 'entry-1',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'smoke delete' }] }],
  });
  await writeFile(transcriptPath, `${line}\n`, 'utf8');
  ok(`seeded transcript ${sessionId}`);

  await new Promise((r) => setTimeout(r, 800));

  const afterSeed = await request(`/api/projects?fresh=1&_=${Date.now()}`, { token });
  const seededProject = afterSeed.json?.find((p) => p.name === project.name);
  const seededSessions = seededProject?.sessions ?? [];
  const foundBefore = seededSessions.some((s) => s.id === sessionId || s.id?.replace('web:s_', 'web-s_') === sessionId);
  if (!foundBefore) {
    await rm(transcriptPath, { force: true }).catch(() => undefined);
    fail(`seeded session not visible in sidebar within timeout (id=${sessionId})`);
  }
  ok('session visible before delete');

  const del = await request(
    `/api/projects/${encodeURIComponent(project.name)}/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE', token },
  );
  if (!del.response.ok || !(del.json?.success || del.json?.deleted)) {
    await rm(transcriptPath, { force: true }).catch(() => undefined);
    fail(`delete API failed: ${del.response.status} ${JSON.stringify(del.json)}`);
  }
  ok('delete API succeeded');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((r) => setTimeout(r, 400));
    const fresh = await request(`/api/projects?fresh=1&_=${Date.now()}`, { token });
    const refreshed = fresh.json?.find((p) => p.name === project.name);
    const stillThere = (refreshed?.sessions ?? []).some(
      (s) => s.id === sessionId || s.id?.replace('web:s_', 'web-s_') === sessionId,
    );
    if (!stillThere) {
      ok(`session absent after delete (attempt ${attempt + 1})`);
      console.log('[delete-smoke] PASS');
      return;
    }
  }

  await rm(transcriptPath, { force: true }).catch(() => undefined);
  fail(`session ${sessionId} still listed after delete + fresh polls`);
}

async function resolveChatsDir(_projectName) {
  const candidates = [
    join(REPO_ROOT, '.saas-dev-data/tenants/default/projects'),
    join(REPO_ROOT, '.pilotdeck/projects'),
  ];
  for (const base of candidates) {
    let entries = [];
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const chats = join(base, entry.name, 'chats');
      try {
        const names = await readdir(chats);
        if (names.some((name) => name.endsWith('.jsonl'))) {
          return chats;
        }
      } catch {
        // continue
      }
    }
  }
  return null;
}

main().catch((error) => {
  console.error('[delete-smoke] ERROR', error);
  process.exit(1);
});
