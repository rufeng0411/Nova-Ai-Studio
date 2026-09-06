#!/usr/bin/env node
/**
 * Live smoke: backward tail pagination on running dev:saas.
 */
import assert from 'node:assert/strict';

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

async function login() {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  assert.equal(res.status, 200, 'login status');
  const body = await res.json();
  const token = body.token || body.accessToken;
  assert.ok(token, 'login token');
  return token;
}

async function main() {
  const token = await login();
  const auth = { Authorization: `Bearer ${token}` };

  const projectsRes = await fetch(`${SERVER}/api/projects`, { headers: auth });
  assert.equal(projectsRes.status, 200, 'projects status');
  const projects = await projectsRes.json();
  const list = Array.isArray(projects) ? projects : projects?.projects ?? [];
  const general = list.find((p) => p.name === 'general' || p.id === 'general');
  assert.ok(general, 'general project');

  const sessions = general.sessions ?? [];
  if (sessions.length === 0) {
    console.log('[tail-pagination-live] SKIP no sessions in general');
    return;
  }

  const sid = sessions[0].id || sessions[0].sessionId;
  const tailRes = await fetch(
    `${SERVER}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=general&limit=50&direction=backward`,
    { headers: auth },
  );
  assert.equal(tailRes.status, 200, 'backward messages status');
  const tail = await tailRes.json();
  const messages = tail.messages ?? [];
  assert.ok(messages.length <= 50, `tail page size ${messages.length}`);
  assert.equal(typeof tail.total, 'number', 'total present');

  const timestamps = messages
    .map((m) => Date.parse(m.timestamp || ''))
    .filter(Number.isFinite);
  for (let i = 1; i < timestamps.length; i += 1) {
    assert.ok(timestamps[i] >= timestamps[i - 1], 'timestamps monotonic');
  }

  if (tail.nextCursor) {
    const olderRes = await fetch(
      `${SERVER}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=general&limit=50&direction=backward&cursor=${encodeURIComponent(tail.nextCursor)}`,
      { headers: auth },
    );
    assert.equal(olderRes.status, 200, 'older page status');
    const older = await olderRes.json();
    const olderMessages = older.messages ?? [];
    const tailIds = new Set(messages.map((m) => m.id));
    for (const m of olderMessages) {
      assert.ok(!tailIds.has(m.id), `overlap id ${m.id}`);
    }
    console.log(`[tail-pagination-live] OK session=${sid} tail=${messages.length} older=${olderMessages.length} total=${tail.total}`);
  } else {
    console.log(`[tail-pagination-live] OK session=${sid} single page=${messages.length} total=${tail.total}`);
  }
}

main().catch((error) => {
  console.error('[tail-pagination-live] FAIL', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
