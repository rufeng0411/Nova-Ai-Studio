#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shells = [
  'artifacts/saas-design/demos-showcase/fullcase-campaign.html',
  'artifacts/saas-design/demos-showcase/fullcase-flywheel.html',
  'artifacts/saas-design/demos-showcase/fullcase-geo.html',
  'deploy/marketing/showcase/fullcase-campaign.html',
  'deploy/marketing/showcase/fullcase-flywheel.html',
  'deploy/marketing/showcase/fullcase-geo.html',
];

let fail = 0;
for (const rel of shells) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error('MISSING', rel);
    fail += 1;
    continue;
  }
  const t = fs.readFileSync(abs, 'utf8');
  const cjk = /[\u4e00-\u9fff]/.test(t);
  const fffd = t.includes('\uFFFD');
  const qq = /\?\?/.test(t);
  if (cjk || fffd || qq) {
    console.error('FAIL', rel, { cjk, fffd, qq });
    fail += 1;
  } else {
    console.log('OK', rel);
  }
}

const viewer = path.join(root, 'deploy/marketing/showcase/shared/fullcase-viewer.js');
const v = fs.readFileSync(viewer, 'utf8');
for (const key of ['复制提示词', '← 返回', 'Copy prompt', 'SHELL_COPY']) {
  if (!v.includes(key)) {
    console.error('viewer missing', key);
    fail += 1;
  }
}

if (fail) {
  console.error('mojibake_fail=' + fail);
  process.exit(1);
}
console.log('mojibake_fail=0');
