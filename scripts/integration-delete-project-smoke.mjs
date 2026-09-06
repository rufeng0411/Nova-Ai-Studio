#!/usr/bin/env node
/**
 * PD-SAAS-FORK: smoke — project delete must purge workspace row, catalog, and sidebar list.
 */
const BASE = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PILOTDECK_UI_PORT || '5173'}`;
const ADMIN_USER = process.env.SMOKE_USER || 'admin';
const ADMIN_PASS = process.env.SMOKE_PASS || 'SAAS_ADMIN_PASSWORD';

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
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
  console.error(`[delete-project-smoke] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[delete-project-smoke] OK: ${message}`);
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    fail(`dev server not reachable at ${BASE}/api/health`);
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const token = login.json?.token;
  if (!login.response.ok || !token) {
    fail(`login failed: ${login.response.status}`);
  }
  ok('authenticated');

  const displayName = `smoke-del-${Date.now()}`;
  const create = await request('/api/projects/create-workspace', {
    method: 'POST',
    token,
    body: { displayName },
  });
  if (!create.response.ok || !create.json?.project?.name) {
    fail(`create-workspace failed: ${create.response.status} ${JSON.stringify(create.json)}`);
  }
  const projectName = create.json.project.name;
  ok(`created workspace ${projectName}`);

  await new Promise((r) => setTimeout(r, 600));

  const afterCreate = await request(`/api/projects?fresh=1&_=${Date.now()}`, { token });
  if (!Array.isArray(afterCreate.json) || !afterCreate.json.some((p) => p.name === projectName)) {
    fail(`project ${projectName} not visible after create`);
  }
  ok('project visible before delete');

  const del = await request(
    `/api/projects/${encodeURIComponent(projectName)}?force=true`,
    { method: 'DELETE', token },
  );
  if (!del.response.ok || !(del.json?.success || del.json?.deleted)) {
    fail(`delete project failed: ${del.response.status} ${JSON.stringify(del.json)}`);
  }
  ok('delete API succeeded');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((r) => setTimeout(r, 400));
    const fresh = await request(`/api/projects?fresh=1&_=${Date.now()}`, { token });
    const stillThere = Array.isArray(fresh.json) && fresh.json.some((p) => p.name === projectName);
    if (!stillThere) {
      ok(`project absent after delete (attempt ${attempt + 1})`);
      console.log('[delete-project-smoke] PASS');
      return;
    }
  }

  fail(`project ${projectName} still listed after delete + fresh polls`);
}

main().catch((error) => {
  console.error('[delete-project-smoke] ERROR', error);
  process.exit(1);
});
