#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Measure tail-120 messages API for sidebar sessions.
 * Env: PROD_BASE_URL, DIAG_USER, DIAG_PASS (required for CI/nightly).
 */
const BASE = process.env.PROD_BASE_URL || 'https://www.novapage.online';
const USER = process.env.DIAG_USER;
const PASS = process.env.DIAG_PASS;

if (!USER || !PASS) {
  console.error('[diag-cloud-all-sessions] set DIAG_USER and DIAG_PASS');
  process.exit(1);
}

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
})).json();
if (!login?.token) {
  console.error('[diag-cloud-all-sessions] login failed');
  process.exit(1);
}
const auth = { Authorization: `Bearer ${login.token}` };

const projects = await (await fetch(`${BASE}/api/projects`, { headers: auth })).json();
const general = (Array.isArray(projects) ? projects : projects.projects).find((p) => p.name === 'general');

console.log('Sessions in sidebar (first 5 from projects API):');
for (const s of general.sessions ?? []) {
  const sid = s.id || s.sessionId;
  const title = (s.title || s.summary || sid).slice(0, 45);
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 120_000);
  try {
    const url = `${BASE}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=general&limit=120&direction=backward`;
    const r = await fetch(url, { headers: auth, signal: ac.signal });
    const j = await r.json();
    const ms = Date.now() - t0;
    console.log(`  ${ms}ms | total=${j.total} ret=${j.messages?.length} KB=${Math.round(JSON.stringify(j).length / 1024)} | ${title}`);
  } catch (e) {
    console.log(`  ${Date.now() - t0}ms TIMEOUT | ${title}`);
  } finally {
    clearTimeout(timer);
  }
}
