#!/usr/bin/env node
/** Ensure footers include 主页/演示 (or EN peers) for links hidden from mobile top nav. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/marketing');
const files = [
  'faq/index.html',
  'compare/index.html',
  'contact/index.html',
  'claims/index.html',
  'docs/index.html',
  'en/faq/index.html',
  'en/compare/index.html',
  'en/contact/index.html',
  'en/claims/index.html',
  'en/docs/index.html',
];

for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  let html = fs.readFileSync(abs, 'utf8');
  if (!html.includes('site-bottom__meta')) continue;
  const en = rel.startsWith('en/');
  const meta = html.match(/<div class="site-bottom__meta">([\s\S]*?)<\/div>/);
  const metaHtml = meta?.[1] || '';
  const hasShowcase = en
    ? metaHtml.includes('href="/en/showcase/"')
    : metaHtml.includes('href="/showcase/"');
  if (hasShowcase) {
    console.log('ok', rel);
    continue;
  }
  const inject = en
    ? `<a href="/en/">Home</a>
          <a href="/en/showcase/">Showcase</a>
          `
    : `<a href="/">主页</a>
          <a href="/showcase/">演示案例</a>
          `;
  const next = html.replace(/<div class="site-bottom__meta">\s*/, (m) => `${m}${inject}`);
  // Drop duplicate 首页 when 主页 present
  let out = next.replace(/<a href="\/">首页<\/a>\s*/g, '');
  if (en) {
    out = out.replace(/(<a href="\/en\/">Home<\/a>\s*){2,}/g, '$1');
  }
  fs.writeFileSync(abs, out, 'utf8');
  console.log('patched', rel);
}
