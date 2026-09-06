#!/usr/bin/env node
/**
 * PD-SAAS-FORK: N2 Bot L2 live gate. Requires Gateway/Bridge. No teardown.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = join(root, `artifacts/n2-bot-acceptance-${stamp}`);
mkdirSync(outDir, { recursive: true });

const gate = process.argv.includes('--gate');
const base = (process.env.PLAYWRIGHT_BASE_URL || process.env.SERVER_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');

let healthOk = false;
try {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2500);
  const res = await fetch(`${base}/api/saas/health/ready`, { signal: ac.signal }).catch(() => null);
  clearTimeout(t);
  healthOk = Boolean(res?.ok);
} catch {
  healthOk = false;
}

if (!healthOk) {
  const summary = { l2: 'skipped', reason: 'gateway_unavailable', base };
  writeFileSync(join(outDir, 'live-summary.json'), JSON.stringify(summary, null, 2));
  console.log('[n2-bot-live] skipped — no Gateway/Bridge ready');
  process.exit(gate ? 1 : 0);
}

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.token || null;
}

async function api(token, path, init = {}) {
  return fetch(`${base}/api/saas/n2-bot${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

const token = await login();
if (!token) {
  const summary = { l2: 'fail', reason: 'login_failed', base };
  writeFileSync(join(outDir, 'live-summary.json'), JSON.stringify(summary, null, 2));
  console.error('[n2-bot-live] login failed');
  process.exit(1);
}

const failures = [];
const sessionRes = await api(token, '/session', { method: 'POST', body: '{}' });
if (sessionRes.status === 404) {
  failures.push('n2_bot_off');
} else if (!sessionRes.ok) {
  failures.push(`session_${sessionRes.status}`);
}
const sessionJson = sessionRes.ok ? await sessionRes.json().catch(() => ({})) : {};

const chatRes = await api(token, '/chat', {
  method: 'POST',
  body: JSON.stringify({ text: '你好啊' }),
});
const chatJson = chatRes.ok ? await chatRes.json().catch(() => ({})) : {};
if (chatJson.acceptTurn === true || (Array.isArray(chatJson.tools) && chatJson.tools.length > 0)) {
  failures.push('L2-8-chat-dispatched');
}

const opsBefore = await api(token, '/ops');
const opsBeforeJson = opsBefore.ok ? await opsBefore.json().catch(() => ({ items: [] })) : { items: [] };
const beforeCount = Array.isArray(opsBeforeJson.items) ? opsBeforeJson.items.length : 0;

const progressRes = await api(token, '/chat', {
  method: 'POST',
  body: JSON.stringify({ text: '进度' }),
});
if (!progressRes.ok && progressRes.status !== 200) failures.push('progress_chat');

const opsMid = await api(token, '/ops');
const opsMidJson = opsMid.ok ? await opsMid.json().catch(() => ({ items: [] })) : { items: [] };
const midCount = Array.isArray(opsMidJson.items) ? opsMidJson.items.length : 0;
if (midCount > beforeCount) failures.push('L2-2-progress-spawned-worker');

const delegateRes = await api(token, '/delegate', {
  method: 'POST',
  body: JSON.stringify({ command: '做一份 6 页周会 PPT' }),
});
if (delegateRes.status === 404) failures.push('delegate_off');
else if (!delegateRes.ok && delegateRes.status >= 500) failures.push(`delegate_${delegateRes.status}`);

const opsAfter = await api(token, '/ops');
const opsAfterJson = opsAfter.ok ? await opsAfter.json().catch(() => ({ items: [] })) : { items: [] };
const workerIds = (opsAfterJson.items || [])
  .map((item) => item.workerSessionId)
  .filter((id) => id && id !== sessionJson.sessionId);

const summary = {
  l2: failures.length ? 'fail' : 'passed',
  base,
  failures,
  stewardSessionId: sessionJson.sessionId || opsAfterJson.n2SessionId || null,
  liveWorkerSessions: workerIds,
  stewardSdmRows: 0,
};
writeFileSync(join(outDir, 'live-summary.json'), JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error('[n2-bot-live] FAIL', failures);
  process.exit(1);
}
console.log('[n2-bot-live] passed', summary.stewardSessionId);
process.exit(0);
