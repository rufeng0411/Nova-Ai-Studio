/** PD-SAAS-FORK: High-fidelity Open Design hero previews (curated top 20) */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOdPreviewPalette, extractHexColorsFromMarkdown, normalizeHexColor } from './preflightCatalogPalettes.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OD_DS_DIR = path.join(REPO_ROOT, 'skills/open-design/references/design-systems');

/** Curated systems with brand-faithful hero layouts (Playwright → WebP). */
export const OD_HERO_PREVIEW_IDS = [
  'linear-app',
  'stripe',
  'notion',
  'vercel',
  'supabase',
  'perplexity',
  'elevenlabs',
  'framer',
  'coinbase',
  'posthog',
  'openai',
  'mistral-ai',
  'resend',
  'airbnb',
  'tesla',
  'bugatti',
  'atelier-zero',
  'zapier',
  'claude',
  'figma',
];

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title, body, { width = 1280, height = 800, bg = '#fff', font = 'Inter, system-ui, sans-serif' } = {}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${width}px;height:${height}px;overflow:hidden;font-family:${font}}
  body{background:${bg}}
  </style></head><body>${body}</body></html>`;
}

function pick(md, colors, idx, fallback) {
  const hexes = extractHexColorsFromMarkdown(md, 24);
  return normalizeHexColor(hexes[idx]) ?? colors[idx] ?? fallback;
}

function parseTagline(md) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (/^>\s*Category:/.test(lines[i]) && lines[i + 1]?.startsWith('>')) {
      return lines[i + 1].replace(/^>\s*/, '').trim();
    }
  }
  return '';
}

export function loadOdHeroContext(id) {
  const mdPath = path.join(OD_DS_DIR, `${id}.md`);
  if (!existsSync(mdPath)) return null;
  const md = readFileSync(mdPath, 'utf8');
  const titleMatch = md.match(/^#\s+Design System Inspired by\s+(.+)$/m);
  const label = titleMatch?.[1]?.trim() ?? id;
  const categoryMatch = md.match(/^>\s*Category:\s*(.+)$/m);
  const accentGuess = md.match(/#[0-9a-fA-F]{6}/)?.[0];
  const colors = buildOdPreviewPalette(md, accentGuess);
  return { id, label, category: categoryMatch?.[1]?.trim() ?? '', tagline: parseTagline(md), colors, md };
}

const HERO_BUILDERS = {
  'linear-app': (ctx) => {
    const [accent, dark, light, muted] = ctx.colors;
    return shell(ctx.label, `
<div style="height:800px;background:${dark};color:${light};display:grid;grid-template-columns:200px 1fr;">
  <aside style="border-right:1px solid ${muted}33;padding:20px 14px;">
    <div style="width:20px;height:20px;border-radius:5px;background:${accent};margin-bottom:18px;"></div>
    ${['Inbox', 'My issues', 'Projects', 'Roadmap'].map((t, i) => `
      <div style="font-size:11px;padding:7px 9px;border-radius:7px;margin-bottom:3px;color:${i === 1 ? light : muted};background:${i === 1 ? `${accent}33` : 'transparent'};">${t}</div>`).join('')}
  </aside>
  <main style="padding:32px 36px;">
    <div style="font-size:10px;color:${accent};letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;">${esc(ctx.tagline || 'Productivity')}</div>
    <h1 style="font-size:44px;font-weight:600;letter-spacing:-0.045em;line-height:1.05;margin-bottom:12px;">Issue tracking<br/>for high-performance teams</h1>
    <p style="font-size:13px;color:${muted};max-width:46ch;line-height:1.55;margin-bottom:22px;">${esc(ctx.label)} — precise dark UI, semi-transparent borders, single violet accent.</p>
    <div style="display:flex;gap:10px;margin-bottom:24px;">
      <span style="background:${accent};color:#fff;padding:9px 16px;border-radius:7px;font-size:12px;">Get started</span>
      <span style="border:1px solid ${muted}44;padding:9px 16px;border-radius:7px;font-size:12px;color:${muted};">Demo</span>
    </div>
    <div style="background:${pick(ctx.md, ctx.colors, 3, '#191a1b')};border:1px solid ${muted}22;border-radius:12px;padding:16px;height:380px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${[0, 1, 2, 3, 4, 5].map(() => `<div style="background:${dark};border:1px solid ${muted}18;border-radius:8px;padding:10px;"><div style="height:6px;width:60%;background:${accent};border-radius:3px;margin-bottom:8px;"></div><div style="height:4px;width:90%;background:${muted};opacity:.25;border-radius:2px;"></div></div>`).join('')}
    </div>
  </main>
</div>`, { bg: dark });
  },

  stripe: (ctx) => {
    const purple = pick(ctx.md, ctx.colors, 0, '#533afd');
    const navy = pick(ctx.md, ctx.colors, 1, '#061b31');
    const body = pick(ctx.md, ctx.colors, 4, '#64748d');
    return shell(ctx.label, `
<div style="height:800px;background:#fff;color:${navy};position:relative;overflow:hidden;">
  <div style="position:absolute;inset:-20% -10% auto auto;width:520px;height:520px;background:radial-gradient(circle, ${purple}55 0%, transparent 68%);filter:blur(8px);"></div>
  <header style="display:flex;justify-content:space-between;align-items:center;padding:18px 40px;position:relative;">
    <strong style="font-size:15px;font-weight:400;letter-spacing:-0.02em;">${esc(ctx.label)}</strong>
    <nav style="display:flex;gap:18px;font-size:12px;color:${body};"><span>Products</span><span>Solutions</span><span>Pricing</span></nav>
  </header>
  <section style="padding:48px 40px 32px;max-width:640px;position:relative;">
    <h1 style="font-size:52px;font-weight:300;letter-spacing:-0.04em;line-height:1.04;margin-bottom:16px;">Financial infrastructure<br/>to grow your revenue</h1>
    <p style="font-size:16px;font-weight:300;line-height:1.5;color:${body};margin-bottom:24px;">Light sohne-style headlines, navy text, signature purple CTAs and blue-tinted shadows.</p>
    <span style="display:inline-block;background:${purple};color:#fff;padding:10px 18px;border-radius:6px;font-size:14px;box-shadow:0 18px 40px rgba(50,50,93,.25);">Start now</span>
  </section>
  <div style="margin:0 40px;background:#fff;border-radius:10px;border:1px solid #e5edf5;box-shadow:0 30px 60px rgba(50,50,93,.18);padding:20px;height:320px;display:grid;grid-template-columns:1.1fr 1fr;gap:16px;">
    <div style="background:linear-gradient(135deg,${purple}18,#f6f9fc);border-radius:8px;padding:16px;"><div style="font-size:11px;color:${body};margin-bottom:8px;">Payments</div><div style="font-size:28px;font-weight:300;letter-spacing:-0.03em;">$24,580.00</div></div>
    <div style="display:grid;grid-template-rows:1fr 1fr;gap:10px;"><div style="background:#f6f9fc;border-radius:8px;"></div><div style="background:#f6f9fc;border-radius:8px;"></div></div>
  </div>
</div>`);
  },

  notion: (ctx) => {
    const ink = pick(ctx.md, ctx.colors, 1, '#37352f');
    const paper = pick(ctx.md, ctx.colors, 2, '#ffffff');
    const muted = pick(ctx.md, ctx.colors, 3, '#9b9a97');
    return shell(ctx.label, `
<div style="height:800px;background:${paper};color:${ink};display:grid;grid-template-columns:220px 1fr;">
  <aside style="padding:16px 12px;border-right:1px solid #ececea;font-size:12px;color:${muted};">
    <div style="font-weight:600;color:${ink};margin-bottom:14px;">${esc(ctx.label)} workspace</div>
    ${['Getting started', 'Roadmap', 'Tasks', 'Wiki'].map((t) => `<div style="padding:5px 8px;border-radius:4px;margin-bottom:2px;">${t}</div>`).join('')}
  </aside>
  <main style="padding:56px 80px 40px;">
    <div style="font-size:12px;color:${muted};margin-bottom:8px;">Product spec</div>
    <h1 style="font-size:40px;font-weight:700;letter-spacing:-0.03em;margin-bottom:18px;">Build a calm, block-based workspace</h1>
    <div style="border-left:3px solid #ececea;padding-left:14px;margin-bottom:14px;color:${muted};font-size:14px;line-height:1.6;">Notion-like soft neutrals, editorial blocks, generous whitespace.</div>
    <div style="display:grid;gap:8px;margin-top:20px;">
      ${['Goals for Q3', 'Launch checklist', 'Customer feedback'].map((t) => `
        <div style="display:flex;gap:8px;align-items:center;font-size:14px;"><span style="width:14px;height:14px;border:1.5px solid ${muted};border-radius:3px;display:inline-block;"></span>${t}</div>`).join('')}
    </div>
  </main>
</div>`, { bg: paper });
  },

  vercel: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#000;color:#fff;padding:28px 36px;">
  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;">
    <strong style="font-size:14px;letter-spacing:-0.02em;">▲ ${esc(ctx.label)}</strong>
    <span style="font-size:11px;color:#888;">Develop · Preview · Ship</span>
  </header>
  <h1 style="font-size:48px;font-weight:700;letter-spacing:-0.045em;line-height:1.02;max-width:12ch;margin-bottom:14px;">Develop. Preview. Ship.</h1>
  <p style="font-size:14px;color:#a1a1a1;max-width:42ch;line-height:1.55;margin-bottom:28px;">Pure black canvas, high-contrast type, deployment dashboard metaphor.</p>
  <div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px;height:420px;font-family:ui-monospace,monospace;font-size:11px;color:#ccc;">
    <div style="color:#50e3c2;margin-bottom:8px;">✓ Production deploy — 1.2s</div>
    <div style="opacity:.7;">preview.acme.app · edge · iad1</div>
    <div style="margin-top:20px;height:280px;border-radius:8px;background:linear-gradient(180deg,#1a1a1a,#050505);border:1px solid #222;"></div>
  </div>
</div>`, { bg: '#000' }),

  supabase: (ctx) => {
    const green = pick(ctx.md, ctx.colors, 0, '#3ecf8e');
    const dark = pick(ctx.md, ctx.colors, 1, '#1c1c1c');
    return shell(ctx.label, `
<div style="height:800px;background:${dark};color:#ededed;padding:28px 36px;">
  <header style="display:flex;justify-content:space-between;margin-bottom:32px;"><strong>${esc(ctx.label)}</strong><span style="color:${green};font-size:12px;">Postgres platform</span></header>
  <h1 style="font-size:42px;font-weight:700;letter-spacing:-0.04em;margin-bottom:12px;">Build in a weekend.<br/>Scale to millions.</h1>
  <p style="color:#9ca3af;font-size:14px;max-width:40ch;line-height:1.55;margin-bottom:22px;">Dark dev UI with emerald accent — auth, database, storage, edge functions.</p>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
    ${['Database', 'Auth', 'Storage', 'Edge'].map((t) => `<div style="background:#242424;border:1px solid #333;border-radius:10px;padding:14px;font-size:12px;"><div style="width:8px;height:8px;border-radius:50%;background:${green};margin-bottom:8px;"></div>${t}</div>`).join('')}
  </div>
  <div style="background:#121212;border:1px solid #2a2a2a;border-radius:12px;padding:14px;height:340px;font-family:ui-monospace,monospace;font-size:11px;color:#8f8f8f;">
    <span style="color:${green};">select</span> * <span style="color:#79b8ff;">from</span> projects <span style="color:#79b8ff;">where</span> active = true;
  </div>
</div>`, { bg: dark });
  },

  perplexity: (ctx) => {
    const accent = pick(ctx.md, ctx.colors, 0, '#20b8cd');
    return shell(ctx.label, `
<div style="height:800px;background:#fcfcf9;color:#13343b;display:flex;flex-direction:column;align-items:center;padding:48px 40px;">
  <strong style="font-size:18px;margin-bottom:28px;align-self:flex-start;">${esc(ctx.label)}</strong>
  <h1 style="font-size:36px;font-weight:500;letter-spacing:-0.03em;text-align:center;margin-bottom:20px;">Where knowledge begins</h1>
  <div style="width:min(680px,100%);background:#fff;border:1px solid #dce3e8;border-radius:16px;padding:14px 16px;display:flex;gap:10px;box-shadow:0 8px 30px rgba(19,52,59,.08);margin-bottom:20px;">
    <span style="flex:1;font-size:14px;color:#6b7c80;">Ask anything…</span>
    <span style="background:${accent};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">→</span>
  </div>
  <div style="width:min(680px,100%);display:grid;gap:8px;">
    ${['Summarize this market report', 'Compare pricing models', 'Draft a product brief'].map((q) => `
      <div style="background:#fff;border:1px solid #e8eeef;border-radius:10px;padding:12px 14px;font-size:13px;color:#4a5c60;">${q}</div>`).join('')}
  </div>
</div>`);
  },

  elevenlabs: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#000;color:#fff;padding:32px 40px;display:flex;flex-direction:column;">
  <strong style="font-size:16px;margin-bottom:auto;">${esc(ctx.label)}</strong>
  <h1 style="font-size:46px;font-weight:600;letter-spacing:-0.04em;line-height:1.05;margin-bottom:12px;">The most realistic<br/>voice AI platform</h1>
  <p style="color:#999;font-size:14px;margin-bottom:24px;">Dark cinematic hero + waveform visualization.</p>
  <div style="height:180px;display:flex;align-items:flex-end;gap:4px;margin-top:auto;">
    ${Array.from({ length: 48 }, (_, i) => `<div style="flex:1;height:${20 + Math.abs(Math.sin(i * 0.45)) * 80}%;background:linear-gradient(180deg,#fff,#666);border-radius:2px;opacity:.85;"></div>`).join('')}
  </div>
</div>`, { bg: '#000' }),

  framer: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#000;color:#fff;padding:28px 32px;">
  <header style="display:flex;justify-content:space-between;margin-bottom:24px;"><strong>${esc(ctx.label)}</strong><span style="font-size:11px;color:#666;">Design · Publish · Scale</span></header>
  <h1 style="font-size:44px;font-weight:600;letter-spacing:-0.04em;line-height:1.05;margin-bottom:16px;">Design and publish<br/>stunning sites</h1>
  <div style="height:520px;border-radius:16px;border:1px solid #222;background:linear-gradient(145deg,#111,#000);box-shadow:0 40px 100px rgba(0,0,0,.8);overflow:hidden;position:relative;">
    <div style="position:absolute;inset:10% 8%;border-radius:12px;background:linear-gradient(135deg,#222,#444);border:1px solid #333;"></div>
  </div>
</div>`, { bg: '#000' }),

  coinbase: (ctx) => {
    const blue = pick(ctx.md, ctx.colors, 0, '#0052ff');
    return shell(ctx.label, `
<div style="height:800px;background:#fff;color:#0a0b0d;padding:32px 40px;">
  <strong style="font-size:16px;color:${blue};">${esc(ctx.label)}</strong>
  <h1 style="font-size:46px;font-weight:600;letter-spacing:-0.04em;margin:24px 0 12px;max-width:11ch;line-height:1.02;">Jump start<br/>your crypto portfolio</h1>
  <p style="color:#5b616e;font-size:15px;max-width:38ch;line-height:1.55;margin-bottom:22px;">Clean fintech blue, bold headlines, asset cards.</p>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
    ${['BTC', 'ETH', 'SOL'].map((t, i) => `
      <div style="border:1px solid #eee;border-radius:14px;padding:16px;background:#fafafa;">
        <div style="font-size:12px;color:#888;margin-bottom:8px;">${t}</div>
        <div style="font-size:24px;font-weight:600;color:${blue};">+${(12 - i * 3.2).toFixed(1)}%</div>
      </div>`).join('')}
  </div>
</div>`);
  },

  posthog: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#eeefe9;color:#1d4aff;padding:28px 34px;">
  <strong style="font-size:15px;color:#000;">${esc(ctx.label)}</strong>
  <h1 style="font-size:40px;font-weight:700;color:#000;letter-spacing:-0.03em;margin:20px 0 12px;">We make dev tools<br/>that don't suck</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;">
    <div style="background:#fff;border-radius:12px;padding:16px;border:2px solid #000;min-height:200px;"><div style="font-size:12px;font-weight:700;margin-bottom:8px;">Product analytics</div><div style="height:120px;background:linear-gradient(180deg,#1d4aff33,transparent);border-radius:8px;"></div></div>
    <div style="background:#f9d10a;border-radius:12px;padding:16px;border:2px solid #000;min-height:200px;"><div style="font-size:12px;font-weight:700;">Session replay</div></div>
  </div>
</div>`, { bg: '#eeefe9' }),

  openai: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#fff;color:#0d0d0d;padding:40px;display:flex;flex-direction:column;align-items:center;">
  <strong style="font-size:15px;align-self:flex-start;margin-bottom:40px;">${esc(ctx.label)}</strong>
  <h1 style="font-size:42px;font-weight:500;letter-spacing:-0.03em;text-align:center;margin-bottom:24px;">What can I help with?</h1>
  <div style="width:min(640px,100%);border:1px solid #e5e5e5;border-radius:24px;padding:16px 20px;box-shadow:0 4px 24px rgba(0,0,0,.06);font-size:14px;color:#8f8f8f;">Message ChatGPT…</div>
  <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center;">
    ${['Write', 'Plan', 'Analyze', 'Code'].map((t) => `<span style="border:1px solid #e5e5e5;border-radius:999px;padding:8px 14px;font-size:12px;color:#333;">${t}</span>`).join('')}
  </div>
</div>`),

  'mistral-ai': (ctx) => shell(ctx.label, `
<div style="height:800px;background:#fff;color:#111;padding:36px 40px;position:relative;overflow:hidden;">
  <div style="position:absolute;right:-80px;top:-80px;width:400px;height:400px;background:radial-gradient(circle,#ff7000 0%,transparent 70%);opacity:.35;"></div>
  <strong style="font-size:16px;position:relative;">${esc(ctx.label)}</strong>
  <h1 style="font-size:46px;font-weight:600;letter-spacing:-0.04em;margin:28px 0 12px;position:relative;max-width:12ch;line-height:1.02;">Frontier AI.<br/>In your hands.</h1>
  <p style="color:#555;font-size:14px;max-width:36ch;line-height:1.55;position:relative;">Warm orange accent on clean European tech layout.</p>
</div>`),

  resend: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#0a0a0a;color:#ededed;padding:32px 40px;font-family:ui-monospace,SFMono-Regular,monospace;">
  <div style="font-family:Inter,sans-serif;font-size:15px;font-weight:600;margin-bottom:28px;">${esc(ctx.label)}</div>
  <h1 style="font-family:Inter,sans-serif;font-size:40px;font-weight:600;letter-spacing:-0.03em;margin-bottom:14px;">Email for developers</h1>
  <div style="background:#111;border:1px solid #222;border-radius:10px;padding:16px;margin-top:24px;font-size:12px;line-height:1.7;color:#aaa;">
    <span style="color:#52e4a8;">POST</span> /emails<br/>
    { "from": "onboarding@acme.com", "to": "user@example.com", "subject": "Welcome" }
  </div>
</div>`, { bg: '#0a0a0a' }),

  airbnb: (ctx) => {
    const coral = pick(ctx.md, ctx.colors, 0, '#ff385c');
    return shell(ctx.label, `
<div style="height:800px;background:#fff;color:#222;padding:24px 32px;">
  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <strong style="color:${coral};font-size:18px;">${esc(ctx.label)}</strong>
    <div style="flex:1;max-width:320px;margin:0 20px;border:1px solid #ddd;border-radius:999px;padding:10px 16px;font-size:13px;color:#888;">Anywhere · Any week · Add guests</div>
  </header>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
    ${['Lakefront', 'Design', 'Countryside', 'Trending'].map((t, i) => `
      <div style="border-radius:12px;overflow:hidden;">
        <div style="height:140px;background:linear-gradient(${120 + i * 30}deg,${coral}aa,#ffd7d7);"></div>
        <div style="padding:8px 2px;font-size:12px;font-weight:600;">${t}</div>
      </div>`).join('')}
  </div>
</div>`);
  },

  tesla: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;">
  <h1 style="font-size:52px;font-weight:500;letter-spacing:-0.02em;margin-bottom:10px;">Model Y</h1>
  <p style="color:#aaa;font-size:14px;margin-bottom:24px;">Minimal automotive hero — full-bleed product, sparse UI.</p>
  <div style="display:flex;gap:16px;font-size:13px;">
    <span style="border-bottom:2px solid #e82127;padding-bottom:4px;">Order now</span>
    <span style="color:#888;">View inventory</span>
  </div>
  <div style="margin-top:auto;width:100%;height:380px;background:linear-gradient(180deg,transparent,#111);border-radius:20px;"></div>
</div>`, { bg: '#000' }),

  bugatti: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#0a0a0a;color:#f5f5f5;padding:32px 40px;display:flex;flex-direction:column;justify-content:flex-end;font-family:Georgia,'Times New Roman',serif;">
  <div style="font-family:Inter,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#888;margin-bottom:16px;">Automotive · Luxury</div>
  <h1 style="font-size:88px;line-height:.92;font-weight:400;letter-spacing:-0.02em;text-transform:uppercase;margin-bottom:12px;">${esc(ctx.label)}</h1>
  <p style="font-family:Inter,sans-serif;font-size:13px;color:#aaa;max-width:36ch;line-height:1.55;">Monumental display type, couture spacing, black canvas.</p>
</div>`, { bg: '#0a0a0a', font: 'Georgia, serif' }),

  'atelier-zero': (ctx) => shell(ctx.label, `
<div style="height:800px;background:#f6f2ec;color:#1a1a1a;padding:36px 48px;display:grid;grid-template-columns:1.2fr .8fr;gap:32px;">
  <div>
    <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#888;margin-bottom:12px;">Editorial Studio</div>
    <h1 style="font-family:Georgia,serif;font-size:48px;line-height:1.06;margin-bottom:16px;">${esc(ctx.label)}</h1>
    <p style="font-size:15px;line-height:1.65;color:#555;max-width:38ch;">Museum-catalog calm, serif headlines, collage-ready layout.</p>
  </div>
  <div style="background:linear-gradient(180deg,#ddd5c8,#b8aa98);min-height:520px;border-radius:2px;"></div>
</div>`, { font: 'Georgia, serif' }),

  zapier: (ctx) => {
    const orange = pick(ctx.md, ctx.colors, 0, '#ff4a00');
    return shell(ctx.label, `
<div style="height:800px;background:#fff;color:#201515;padding:32px 40px;">
  <strong style="font-size:16px;color:${orange};">${esc(ctx.label)}</strong>
  <h1 style="font-size:44px;font-weight:700;letter-spacing:-0.03em;margin:22px 0 12px;max-width:12ch;line-height:1.04;">Automate your work.<br/>Grow your business.</h1>
  <div style="display:flex;align-items:center;gap:12px;margin-top:28px;">
    ${['Trigger', '→', 'Action', '→', 'Result'].map((t, i) => `
      <div style="${i % 2 ? 'font-size:20px;color:#ccc;' : `background:${i === 0 ? orange : '#f4f5fb'};color:${i === 0 ? '#fff' : '#333'};padding:16px 20px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid #eee;`}">${t}</div>`).join('')}
  </div>
</div>`);
  },

  claude: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#f5f0eb;color:#2b1810;padding:40px 48px;">
  <strong style="font-size:16px;">${esc(ctx.label)}</strong>
  <h1 style="font-family:Georgia,serif;font-size:44px;line-height:1.08;margin:24px 0 14px;max-width:11ch;">Meet Claude</h1>
  <p style="font-size:15px;line-height:1.6;color:#6b5348;max-width:38ch;margin-bottom:24px;">Warm terracotta editorial — human, literary, trustworthy.</p>
  <div style="background:#fff;border-radius:16px;border:1px solid #e8ddd4;padding:18px;max-width:520px;font-size:14px;color:#888;">How can Claude help you today?</div>
</div>`, { bg: '#f5f0eb' }),

  figma: (ctx) => shell(ctx.label, `
<div style="height:800px;background:#fff;color:#111;padding:32px 40px;">
  <header style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
    <div style="display:flex;gap:4px;">
      ${['#f24e1e', '#a259ff', '#1abcfe', '#0acf83'].map((c) => `<span style="width:10px;height:10px;border-radius:50%;background:${c};"></span>`).join('')}
    </div>
    <strong style="font-size:16px;">${esc(ctx.label)}</strong>
  </header>
  <h1 style="font-size:44px;font-weight:700;letter-spacing:-0.04em;margin-bottom:14px;">Think bigger.<br/>Build faster.</h1>
  <div style="height:420px;border-radius:12px;border:1px solid #eee;background:linear-gradient(135deg,#f5f5f5,#fff);display:grid;grid-template-columns:48px 1fr 240px;">
    <div style="border-right:1px solid #eee;background:#fafafa;"></div>
    <div style="padding:20px;"><div style="height:100%;border:1px dashed #ddd;border-radius:8px;"></div></div>
    <div style="border-left:1px solid #eee;background:#fafafa;padding:12px;font-size:11px;color:#888;">Properties</div>
  </div>
</div>`),
};

export function isOdHeroPreviewId(id) {
  return OD_HERO_PREVIEW_IDS.includes(id);
}

export function buildOdHeroPreviewHtml(ctx) {
  const builder = HERO_BUILDERS[ctx.id];
  if (!builder) return null;
  return builder(ctx);
}

export function buildOdHeroPreviewForId(id) {
  const ctx = loadOdHeroContext(id);
  if (!ctx) return null;
  return buildOdHeroPreviewHtml(ctx);
}
