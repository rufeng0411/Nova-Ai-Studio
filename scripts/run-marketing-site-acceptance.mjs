#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Marketing site live acceptance (L2–L4 API + static via Bridge proxy).
 * Usage:
 *   SERVER_URL=http://127.0.0.1:7990 node scripts/run-marketing-site-acceptance.mjs
 *   node scripts/run-marketing-site-acceptance.mjs --gate
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const GATE = process.argv.includes('--gate');
const BRIDGE = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const OUT_DIR = join(REPO, 'artifacts', 'marketing-site-acceptance-20260730');
const REPORT_JSON = join(OUT_DIR, 'acceptance-results.json');

mkdirSync(OUT_DIR, { recursive: true });

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: String(detail || '') });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}: ${detail}`);
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { res, json, text };
}

async function startMarketingProxy() {
  process.env.PILOTDECK_MARKETING_SITE = '1';
  const modUrl = pathToFileURL(
    join(REPO, 'ui/server/saas/marketing/marketingStatic.js'),
  ).href;
  const { marketingStaticMiddleware } = await import(modUrl);
  const app = express();
  app.use(marketingStaticMiddleware);
  app.use('/api', async (req, res) => {
    const target = `${BRIDGE}${req.originalUrl}`;
    try {
      const headers = { ...req.headers, host: new URL(BRIDGE).host };
      delete headers['content-length'];
      const bodyChunks = [];
      for await (const chunk of req) bodyChunks.push(chunk);
      const body = Buffer.concat(bodyChunks);
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => {
        if (k === 'transfer-encoding') return;
        res.setHeader(k, v);
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch (e) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function checkBridge() {
  try {
    const { res, json } = await fetchJson(`${BRIDGE}/api/saas/health`);
    record('bridge.health', res.ok && json?.ok, `status=${res.status} backend=${json?.backend}`);
    return res.ok;
  } catch (e) {
    record('bridge.health', false, e.message);
    return false;
  }
}

async function checkFlags() {
  const { res, json } = await fetchJson(`${BRIDGE}/api/runtime/public-flags`);
  const ok =
    res.ok &&
    json?.PILOTDECK_MARKETING_CONTACT === true &&
    json?.PILOTDECK_MARKETING_ANALYTICS === true &&
    json?.PILOTDECK_REGISTER_INVITE_CODE === true;
  record(
    'bridge.public-flags',
    ok,
    JSON.stringify(json),
  );
  return json;
}

async function checkStaticPages(base) {
  const paths = ['/', '/docs/', '/contact/', '/geo/', '/for-ai/', '/faq/', '/compare/', '/claims/', '/llms.txt', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/sw.js', '/shared/analytics.js', '/shared/responsive.css', '/shared/content.css', '/assets/og-default.png'];
  for (const p of paths) {
    const res = await fetch(`${base}${p}`);
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    const htmlOk = p.endsWith('/') || p.endsWith('.html') ? /<html/i.test(text) || p === '/' : true;
    const bodyOk = text.length > 20 && (p.includes('.') ? true : htmlOk);
    record(`static.${p}`, res.status === 200 && bodyOk, `status=${res.status} ct=${ct.slice(0, 40)} bytes=${text.length}`);
  }

  const home = await (await fetch(`${base}/`)).text();
  record('static.home-four-cards', /70%|Token|Goal-Loop|企业级|400\+/.test(home), 'hero KPI copy present');
  record('static.home-jsonld', /SoftwareApplication/.test(home) && /application\/ld\+json/.test(home), 'JSON-LD SoftwareApplication');
  record('static.pwa-manifest-link', /rel=["']manifest["']/.test(home), 'manifest link');
  record('static.viewport', /viewport-fit=cover|width=device-width/.test(home), 'mobile viewport meta');
  record('static.login-cta', /\/login\?from=site/.test(home), 'production login CTA');

  const geo = await (await fetch(`${base}/geo/`)).text();
  record('static.geo-faq', /FAQPage/.test(geo) && /Agent Harness/.test(geo), 'GEO FAQ + claims');
  record('static.geo-faq-link', /href=["']\/faq\/["']/.test(geo), 'geo stub → /faq/');
  record('static.home-software-id', /#software/.test(home) && /alternateName/.test(home), 'home #software + alternateName');
  record('static.home-og', /og-default\.png/.test(home), 'home og:image');

  const faq = await (await fetch(`${base}/faq/`)).text();
  record('static.faq-page', /FAQPage/.test(faq) && /Goal-Loop/.test(faq), 'human FAQ page');
  const compare = await (await fetch(`${base}/compare/`)).text();
  record('static.compare-page', /Dify/.test(compare) && /FastGPT/.test(compare), 'compare page');
  const claims = await (await fetch(`${base}/claims/`)).text();
  record('static.claims-page', /场景依赖/.test(claims) && /70%/.test(claims), 'claims methodology');

  const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
  record(
    'static.pwa-manifest-fields',
    !!(manifest.name && manifest.start_url && (manifest.icons?.length || manifest.display)),
    JSON.stringify({ name: manifest.name, display: manifest.display, start_url: manifest.start_url }),
  );

  const sw = await (await fetch(`${base}/sw.js`)).text();
  record('static.pwa-sw', /addEventListener|caches|fetch/.test(sw), `sw bytes=${sw.length}`);
}

async function checkSeoFiles(base) {
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  record('seo.robots-sitemap', /Sitemap:\s*https:\/\/www\.novapage\.online\/sitemap\.xml/i.test(robots), robots.split('\n')[0]);
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  record('seo.sitemap-geo', sitemap.includes('/geo/'), 'geo in sitemap');
  record('seo.sitemap-faq', sitemap.includes('/faq/'), 'faq in sitemap');
  record('seo.sitemap-compare', sitemap.includes('/compare/'), 'compare in sitemap');
  record('seo.sitemap-claims', sitemap.includes('/claims/'), 'claims in sitemap');
  const llms = await (await fetch(`${base}/llms.txt`)).text();
  record('seo.llms', /Agent Harness/i.test(llms) && /400\+/.test(llms) && /Amazon Nova/i.test(llms), `bytes=${llms.length}`);
}

async function checkContactAndCollect() {
  // honeypot
  const honey = await fetch(`${BRIDGE}/api/marketing/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'x',
      email: 'a@b.com',
      phone: '1',
      company: 'c',
      message: 'm',
      website: 'http://spam.test',
      captchaId: 'x',
      captchaAnswer: 'y',
    }),
  });
  record('contact.honeypot', honey.status === 204, `status=${honey.status}`);

  // missing captcha
  const bad = await fetchJson(`${BRIDGE}/api/marketing/contact`, {
    method: 'POST',
    body: JSON.stringify({
      displayName: '验收',
      email: 'accept@example.com',
      phone: '13800138000',
      company: 'Nova验收',
      message: '集成测试诉求',
    }),
  });
  record('contact.requires-captcha', bad.res.status === 400, bad.json?.error || `status=${bad.res.status}`);

  // captcha + submit (challenge text is the answer, case-insensitive)
  const cap = await fetchJson(`${BRIDGE}/api/saas/captcha`);
  record('captcha.issue', cap.res.ok && !!cap.json?.captchaId, `id=${!!cap.json?.captchaId}`);
  if (cap.res.ok && cap.json?.captchaId && cap.json?.challenge) {
    const submit = await fetchJson(`${BRIDGE}/api/marketing/contact`, {
      method: 'POST',
      body: JSON.stringify({
        displayName: '验收同学',
        email: 'accept-marketing@example.com',
        phone: '13800138000',
        company: 'Nova验收',
        message: '主站集成验收：联系我们入库',
        captchaId: cap.json.captchaId,
        captchaAnswer: cap.json.challenge,
      }),
    });
    record('contact.submit', submit.res.ok && submit.json?.ok === true, submit.json?.error || `status=${submit.res.status}`);
  } else {
    record('contact.submit', false, 'captcha unavailable');
  }

  const collect = await fetch(`${BRIDGE}/api/marketing/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: '/acceptance-test/',
      referrer: 'https://example.com/',
      utmSource: 'accept',
      utmMedium: 'script',
      utmCampaign: 'marketing-l2',
      sessionKey: `accept_${Date.now()}`,
    }),
  });
  record('analytics.collect', collect.status === 204 || collect.status === 200, `status=${collect.status}`);
}

async function adminLogin() {
  const user = process.env.SAAS_ADMIN_USER || 'admin';
  const pass = process.env.SAAS_ADMIN_PASSWORD || 'SAAS_ADMIN_PASSWORD';
  const { res, json } = await fetchJson(`${BRIDGE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: user, password: pass }),
  });
  const token = json?.token;
  record('auth.admin-login', res.ok && !!token, `status=${res.status}`);
  return token;
}

async function checkAdmin(token) {
  if (!token) {
    record('admin.skipped', false, 'no token');
    return null;
  }
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const leads = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/leads`, { headers: h });
  const leadCount = leads.json?.leads?.length ?? 0;
  record('admin.leads', leads.res.ok && Array.isArray(leads.json?.leads) && leadCount >= 1, `count=${leadCount}`);

  const firstNew = (leads.json?.leads || []).find((l) => l.status === 'new');
  if (firstNew?.id) {
    const patched = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/leads/${firstNew.id}`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({ status: 'done' }),
    });
    record('admin.leads-patch', patched.res.ok, patched.json?.error || `id=${firstNew.id}→done`);
  } else {
    record('admin.leads-patch', false, 'no new lead to patch');
  }

  const created = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/invite-codes`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ count: 1, note: 'acceptance-20260730' }),
  });
  const code = created.json?.codes?.[0];
  record('admin.invite-create', created.res.ok && !!code, `code=${code || 'none'}`);

  const list = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/invite-codes`, { headers: h });
  record('admin.invite-list', list.res.ok && Array.isArray(list.json?.codes), `count=${list.json?.codes?.length ?? 0}`);

  if (code) {
    const revokedOther = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/invite-codes`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ count: 1, note: 'to-revoke' }),
    });
    const revokeCode = revokedOther.json?.codes?.[0];
    if (revokeCode) {
      const rev = await fetchJson(
        `${BRIDGE}/api/saas/admin/marketing/invite-codes/${encodeURIComponent(revokeCode)}/revoke`,
        { method: 'POST', headers: h, body: '{}' },
      );
      record('admin.invite-revoke', rev.res.ok, `code=${revokeCode}`);
    } else {
      record('admin.invite-revoke', false, 'could not create spare code');
    }
  }

  const analytics = await fetchJson(`${BRIDGE}/api/saas/admin/marketing/analytics?days=14`, { headers: h });
  record(
    'admin.analytics',
    analytics.res.ok && typeof analytics.json?.pv === 'number' && Array.isArray(analytics.json?.series) && analytics.json.pv >= 1,
    `pv=${analytics.json?.pv} uv=${analytics.json?.uvApprox} leads=${analytics.json?.leads}`,
  );

  return code;
}

async function checkRegisterInvite(inviteCode) {
  const capBad = await fetchJson(`${BRIDGE}/api/saas/captcha`);
  const noCode = await fetchJson(`${BRIDGE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      username: `mkt_accept_${Date.now()}`,
      password: 'testpass1',
      captchaId: capBad.json?.captchaId,
      captchaAnswer: capBad.json?.challenge,
      inviteCode: '',
    }),
  });
  record(
    'register.no-invite',
    noCode.res.status === 400 && /邀请码/.test(String(noCode.json?.error || '')),
    noCode.json?.error || `status=${noCode.res.status}`,
  );

  const capBadInv = await fetchJson(`${BRIDGE}/api/saas/captcha`);
  const badInvite = await fetchJson(`${BRIDGE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      username: `mkt_accept_${Date.now()}`,
      password: 'testpass1',
      captchaId: capBadInv.json?.captchaId,
      captchaAnswer: capBadInv.json?.challenge,
      inviteCode: 'ZZZZ',
    }),
  });
  record(
    'register.bad-invite',
    badInvite.res.status === 400 && /邀请码/.test(String(badInvite.json?.error || '')),
    badInvite.json?.error || `status=${badInvite.res.status}`,
  );

  if (!inviteCode) {
    record('register.with-invite', false, 'no invite created');
    return;
  }
  const capOk = await fetchJson(`${BRIDGE}/api/saas/captcha`);
  const username = `mkt_ok_${Date.now().toString(36)}`;
  const okReg = await fetchJson(`${BRIDGE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      username,
      password: 'testpass1',
      captchaId: capOk.json.captchaId,
      captchaAnswer: capOk.json.challenge,
      inviteCode,
    }),
  });
  record(
    'register.with-invite',
    okReg.res.ok && !!okReg.json?.token,
    okReg.json?.error || `user=${username} token=${!!okReg.json?.token}`,
  );
}

async function checkLoginPage() {
  // SPA login route via Bridge (Vite/UI)
  const res = await fetch(`${BRIDGE}/login`);
  const text = await res.text();
  // May be SPA shell
  record(
    'login.spa-route',
    res.status === 200 && (text.includes('root') || text.includes('Nova') || text.includes('script')),
    `status=${res.status} bytes=${text.length}`,
  );
}

async function checkRateLimitSoft() {
  // Do not hammer to 429 in CI; just verify endpoint stays healthy under small burst
  let ok = 0;
  for (let i = 0; i < 5; i += 1) {
    const res = await fetch(`${BRIDGE}/api/marketing/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/burst-${i}`, sessionKey: `burst_${Date.now()}_${i}` }),
    });
    if (res.status === 204 || res.status === 200) ok += 1;
  }
  record('analytics.burst-ok', ok >= 4, `ok=${ok}/5`);
}

async function main() {
  console.log(`[marketing-accept] Bridge=${BRIDGE}`);
  const healthy = await checkBridge();
  if (!healthy) {
    writeFileSync(REPORT_JSON, JSON.stringify({ bridge: BRIDGE, results }, null, 2));
    if (GATE) process.exit(1);
    return;
  }
  await checkFlags();
  await checkLoginPage();
  await checkContactAndCollect();
  await checkRateLimitSoft();
  const token = await adminLogin();
  const inviteCode = await checkAdmin(token);
  await checkRegisterInvite(inviteCode);

  let proxy;
  try {
    proxy = await startMarketingProxy();
    console.log(`[marketing-accept] marketing proxy ${proxy.base} (MARKETING_SITE forced on)`);
    await checkStaticPages(proxy.base);
    await checkSeoFiles(proxy.base);
  } catch (e) {
    record('marketing.proxy', false, e.message);
  } finally {
    if (proxy?.server) proxy.server.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    bridge: BRIDGE,
    at: new Date().toISOString(),
    pass: results.filter((r) => r.ok).length,
    fail: failed.length,
    results,
    inviteCode: inviteCode || null,
  };
  writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  console.log(`[marketing-accept] ${summary.pass} pass / ${summary.fail} fail → ${REPORT_JSON}`);

  if (GATE && failed.length) {
    console.error('[marketing-accept] GATE FAIL');
    process.exit(1);
  }
  if (!failed.length) console.log('[marketing-accept] GATE PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
