#!/usr/bin/env node
/** Remove top-nav Compare links; rewrite footer /compare/ → FAQ#q-compare */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/marketing');

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.join(base, name).replace(/\\/g, '/');
    if (fs.statSync(abs).isDirectory()) {
      if (['media', 'shared', 'assets', 'pages', 'scripts'].includes(name)) continue;
      out.push(...walk(abs, rel));
    } else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

let n = 0;
for (const rel of walk(root)) {
  if (rel === 'compare/index.html' || rel === 'en/compare/index.html') continue;
  const abs = path.join(root, rel);
  let html = fs.readFileSync(abs, 'utf8');
  const before = html;

  // Remove entire compare nav link (with optional short label span)
  html = html.replace(
    /\s*<a class="site-nav__link"[^>]*href="\/(?:en\/)?compare\/?"[^>]*>[\s\S]*?<\/a>/g,
    '',
  );

  // Footer / claim-meta: point compare → faq#q-compare
  html = html.replace(/href="\/compare\/?"/g, 'href="/faq/#q-compare"');
  html = html.replace(/href="\/en\/compare\/?"/g, 'href="/en/faq/#q-compare"');

  // Label polish in claim-meta lines that said 对比页
  html = html.replace(/对比页/g, '平台对比');
  html = html.replace(/Compare page/g, 'platform comparison');

  if (html !== before) {
    fs.writeFileSync(abs, html, 'utf8');
    n += 1;
    console.log('patched', rel);
  }
}
console.log('[strip-compare-nav] files:', n);
