#!/usr/bin/env node
/**
 * PD-SAAS-FORK: gate — deploy/marketing exists, index/docs/contact present,
 * no forbidden brand leaks (PilotDeck/OpenBMB/面壁/AGPL) in HTML.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(import.meta.url), '../..');
const ROOT = join(REPO, 'deploy', 'marketing');

const REQUIRED = [
  'index.html',
  'docs/index.html',
  'contact/index.html',
  'geo/index.html',
  'faq/index.html',
  'compare/index.html',
  'claims/index.html',
  'about/index.html',
  'copyright/index.html',
  'pages/about.json',
  'pages/copyright.json',
  'showcase/index.html',
  'en/index.html',
  'en/docs/index.html',
  'en/showcase/index.html',
  'en/about/index.html',
  'en/copyright/index.html',
  'en/faq/index.html',
  'shared/marketingPage.js',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'sw.js',
  'shared/tokens.css',
  'shared/shell.css',
  'shared/motion.css',
  'shared/content.css',
  'shared/site.js',
  'shared/i18n.js',
  'shared/analytics.js',
  'shared/responsive.css',
  'assets/nova-logo-mark.png',
  'assets/og-default.png',
  'geo-monitor-queries.json',
];

// User-facing copy only (HTML + llms.txt). Markdown notes may mention env keys like PILOTDECK_*.
const FORBIDDEN = [
  /\bPilotDeck\b/,
  /\bOpenBMB\b/,
  /面壁智能/,
  /\bAGPL\b/i,
];

function walkHtml(dir, out = [], relBase = '') {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    const rel = relBase ? `${relBase}/${name}` : name;
    if (st.isDirectory()) {
      // Showcase demo media may contain historical third-party strings; skip brand scan
      if (name === 'scripts' || name === 'node_modules') continue;
      if (rel === 'showcase/media' || rel.startsWith('showcase/media/')) continue;
      walkHtml(p, out, rel);
    } else if (name.endsWith('.html') || name === 'llms.txt') {
      out.push(p);
    }
  }
  return out;
}

let failed = 0;

if (!existsSync(ROOT)) {
  console.error('[marketing-check] missing deploy/marketing');
  process.exit(1);
}

for (const rel of REQUIRED) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`[marketing-check] missing ${rel}`);
    failed += 1;
  } else {
    console.log(`[marketing-check] ok ${rel}`);
  }
}

for (const file of walkHtml(ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`[marketing-check] forbidden ${re} in ${relative(ROOT, file)}`);
      failed += 1;
    }
  }
}

if (failed) {
  console.error(`[marketing-check] FAIL (${failed})`);
  process.exit(1);
}
console.log('[marketing-check] PASS');
