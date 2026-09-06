import fs from 'node:fs';
import path from 'node:path';

const dir =
  'F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34/artifacts/task-20260803-d6c16c17';

for (const f of ['screen-1.html', 'screen-2.html', 'screen-3.html', 'screen-4.html', 'screen-5.html']) {
  const p = path.join(dir, f);
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace(/\n\s*html\[data-theme="light"\] \.notch\{background:#1a1f24\}/g, '');
  t = t.replace(/\n\s*\.notch\{[^}]+\}/g, '');
  t = t.replace(/\n\s*<div class="notch"><\/div>/g, '');
  fs.writeFileSync(p, t);
  console.log(f, 'notch=', t.includes('notch'));
}

const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
console.log('index frame::before=', idx.includes('frame::before'));
