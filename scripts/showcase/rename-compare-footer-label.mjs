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

let n = 0;
for (const rel of walk(root)) {
  const abs = path.join(root, rel);
  let html = fs.readFileSync(abs, 'utf8');
  const next = html.replace(
    /href="(\/(?:en\/)?faq\/#q-compare)">对比<\/a>/g,
    'href="$1">平台对比</a>',
  );
  if (next !== html) {
    fs.writeFileSync(abs, next, 'utf8');
    n += 1;
    console.log('patched', rel);
  }
}
console.log('[rename-compare-footer-label]', n);
