#!/usr/bin/env node
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
      if (['media', 'shared', 'assets', 'pages'].includes(name)) continue;
      out.push(...walk(abs, rel));
    } else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

let miss = 0;
for (const rel of walk(root)) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const m = html.match(/<div class="site-bottom__meta">([\s\S]*?)<\/div>/);
  if (!m) continue;
  const en = rel.startsWith('en/');
  const a = en ? '/en/about/' : '/about/';
  const c = en ? '/en/copyright/' : '/copyright/';
  if (!m[1].includes(`href="${a}"`) || !m[1].includes(`href="${c}"`)) {
    console.error('MISSING in footer meta', rel);
    miss += 1;
  }
}
if (miss) process.exit(1);
console.log('footer_legal_ok=1');
