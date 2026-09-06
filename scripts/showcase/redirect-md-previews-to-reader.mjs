#!/usr/bin/env node
/**
 * Point legacy MD preview.html / compliance viewers at copy-reader.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const media = path.join(root, 'deploy/marketing/showcase/media');

const previewIds = [
  'sc-copy-product-pr',
  'sc-copy-up-review',
  'sc-copy-press-wire',
  'sc-copy-one-article-matrix',
  'sc-copy-social-matrix',
  'sc-copy-email-seq',
  'sc-mkt-competitor',
  'sc-mkt-pv-gov-bid',
  'sc-pr-thought-md',
];

const complianceIds = [
  'sc-compliance-entity',
  'sc-compliance-privacy',
  'sc-compliance-ad',
  'sc-compliance-contract',
  'sc-compliance-bid',
  'sc-compliance-policy',
];

function redirectHtml(id, title) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"/>
<meta http-equiv="refresh" content="0;url=/showcase/copy-reader.html?id=${encodeURIComponent(id)}"/>
<title>${title}</title>
<script>location.replace("/showcase/copy-reader.html?id="+encodeURIComponent(${JSON.stringify(id)}));</script>
</head><body>
<p><a href="/showcase/copy-reader.html?id=${encodeURIComponent(id)}">打开可读预览</a></p>
</body></html>
`;
}

let n = 0;
for (const id of previewIds) {
  const p = path.join(media, id, 'preview.html');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, redirectHtml(id, id), 'utf8');
  n += 1;
  console.log('preview', id);
}

const showcase = path.join(root, 'deploy/marketing/showcase');
for (const id of complianceIds) {
  const p = path.join(showcase, `viewer-${id}.html`);
  if (!fs.existsSync(p)) {
    console.log('miss viewer', id);
    continue;
  }
  fs.writeFileSync(p, redirectHtml(id, id), 'utf8');
  n += 1;
  console.log('viewer', id);
}

// also mirror under overlay media if present
const overlay = path.join(root, '.saas-dev-data/marketing-showcase');
if (fs.existsSync(overlay)) {
  for (const id of previewIds) {
    const p = path.join(overlay, 'media', id, 'preview.html');
    if (!fs.existsSync(path.dirname(p))) continue;
    fs.writeFileSync(p, redirectHtml(id, id), 'utf8');
    console.log('overlay preview', id);
  }
}

console.log('done', n);
