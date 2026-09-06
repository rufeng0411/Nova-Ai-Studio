#!/usr/bin/env node
const BASE = process.env.PROD_BASE_URL || 'https://www.novapage.online';
const USER = process.env.DIAG_USER || '84434775@qq.com';
const PASS = process.env.DIAG_PASS || 'Cs@19820208';

async function bench(url, auth) {
  const times = [];
  let last;
  for (let i = 0; i < 3; i += 1) {
    const t = Date.now();
    const r = await fetch(url, { headers: auth });
    last = await r.json();
    times.push(Date.now() - t);
  }
  return {
    times,
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    last,
  };
}

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('login failed', login);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${login.token}` };

  const projectsRes = await fetch(`${BASE}/api/projects`, { headers: auth });
  const projects = await projectsRes.json();
  const list = Array.isArray(projects) ? projects : projects.projects ?? [];

  for (const p of list) {
    console.log(`\nProject ${p.name || p.id}`);
    for (const s of p.sessions ?? []) {
      const sid = s.id || s.sessionId;
      const pn = p.name || p.id;
      const tailUrl = `${BASE}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=${encodeURIComponent(pn)}&limit=120&direction=backward`;
      const { avg, last } = await bench(tailUrl, auth);
      const title = (s.title || s.summary || sid).slice(0, 50);
      console.log(`  ${title}`);
      console.log(`    tail120 avg=${avg}ms total=${last.total} returned=${last.messages?.length} KB=${Math.round(JSON.stringify(last).length / 1024)}`);

      if ((last.total ?? 0) > 150) {
        const fullUrl = `${BASE}/api/sessions/${encodeURIComponent(sid)}/messages?projectName=${encodeURIComponent(pn)}`;
        const full = await bench(fullUrl, auth);
        console.log(`    FULL avg=${full.avg}ms KB=${Math.round(JSON.stringify(full.last).length / 1024)}`);
      }
    }
  }

  const html = await (await fetch(`${BASE}/`)).text();
  const m = html.match(/assets\/index-[^"]+\.js/);
  if (m) {
    const js = await (await fetch(`${BASE}/${m[0]}`)).text();
    const hasTrue = js.includes('VITE_TAIL_MESSAGE_PAGINATION","true')
      || js.includes('VITE_TAIL_MESSAGE_PAGINATION": "true"');
    const hasFalse = js.includes('VITE_TAIL_MESSAGE_PAGINATION","false')
      || js.includes('VITE_TAIL_MESSAGE_PAGINATION": "false"');
    console.log('\nProduction bundle tail pagination:', hasTrue ? 'ENABLED' : hasFalse ? 'DISABLED' : 'UNKNOWN');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
