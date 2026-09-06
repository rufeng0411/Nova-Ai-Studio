#!/usr/bin/env node
/** Inject About / Copyright links into site-bottom__meta only (never body copy). */
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
      if (name === 'media' || name === 'shared' || name === 'assets' || name === 'pages') continue;
      out.push(...walk(abs, rel));
    } else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

let n = 0;
for (const rel of walk(root)) {
  const abs = path.join(root, rel);
  let html = fs.readFileSync(abs, 'utf8');
  const metaRe = /(<div class="site-bottom__meta">)([\s\S]*?)(<\/div>)/;
  const m = html.match(metaRe);
  if (!m) continue;

  const en = rel.startsWith('en/');
  const aboutHref = en ? '/en/about/' : '/about/';
  const copyHref = en ? '/en/copyright/' : '/copyright/';
  const aboutLabel = en ? 'About' : '关于我们';
  const copyLabel = en ? 'Copyright' : '版权声明';
  const aboutA = `<a href="${aboutHref}">${aboutLabel}</a>`;
  const copyA = `<a href="${copyHref}">${copyLabel}</a>`;

  let meta = m[2];
  if (meta.includes(`href="${aboutHref}"`) && meta.includes(`href="${copyHref}"`)) continue;

  if (!meta.includes(`href="${aboutHref}"`)) {
    if (/href="\/(?:en\/)?contact\/?"/.test(meta)) {
      meta = meta.replace(
        /(<a href="\/(?:en\/)?contact\/?[^"]*">[^<]*<\/a>)/,
        `${aboutA}\n          ${copyA}\n          $1`,
      );
    } else if (/<span>[©�]/.test(meta) || /<span>&copy;/.test(meta) || /<span>©/.test(meta)) {
      meta = meta.replace(/(<span>[©�&])/, `${aboutA}\n          ${copyA}\n          $1`);
      if (!meta.includes(`href="${aboutHref}"`)) {
        meta = meta.replace(/(<span>)/, `${aboutA}\n          ${copyA}\n          $1`);
      }
    } else {
      meta = `\n          ${aboutA}\n          ${copyA}${meta}`;
    }
  } else if (!meta.includes(`href="${copyHref}"`)) {
    meta = meta.replace(
      `href="${aboutHref}">${aboutLabel}</a>`,
      `href="${aboutHref}">${aboutLabel}</a>\n          ${copyA}`,
    );
  }

  const next = html.replace(metaRe, `${m[1]}${meta}${m[3]}`);
  if (next !== html) {
    fs.writeFileSync(abs, next, 'utf8');
    n += 1;
    console.log('patched', rel);
  }
}
console.log('[patch-site-bottom-legal] files:', n);
