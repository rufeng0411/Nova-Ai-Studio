#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getControlDriver } from '../../ui/server/saas/db/control.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const paths = [
  path.join(root, 'deploy/marketing/showcase/shared/catalog.js'),
  path.join(root, '.saas-dev-data/marketing-showcase/shared/catalog.js'),
];

for (const p of paths) {
  if (!fs.existsSync(p)) {
    console.log('miss', p);
    continue;
  }
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/("id": "office",[\s\S]*?)"title": "办公"/, '$1"title": "公关"');
  s = s.replace(/("id": "office",[\s\S]*?)"title_zh": "办公"/, '$1"title_zh": "公关"');
  s = s.replace(/("id": "office",[\s\S]*?)"title_en": "Office"/, '$1"title_en": "PR & Comms"');
  s = s.replace(/演示稿、文档与可编辑 PPT——办公交付/g, '危机、媒体日、Pitch 与公关战略——专业传播交付');
  s = s.replace(
    /Decks, docs, and editable PPT — office deliverables/g,
    'Crisis, media day, pitch, and PR strategy — professional comms',
  );
  fs.writeFileSync(p, s);
  console.log('patched', p);
}

const db = await getControlDriver();
await db.execute(
  `UPDATE showcase_sections SET title_zh=?, title_en=?, lead_zh=?, lead_en=?, updated_at=CURRENT_TIMESTAMP WHERE id='office'`,
  [
    '公关',
    'PR & Comms',
    '危机、媒体日、Pitch 与公关战略——专业传播交付',
    'Crisis, media day, pitch, and PR strategy — professional comms',
  ],
);
const row = await db.queryOne(`SELECT id, title_zh, title_en FROM showcase_sections WHERE id='office'`);
console.log('db', row);

for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  const code = fs.readFileSync(p, 'utf8');
  const m = code.match(/window\.NOVA_SHOWCASE_CATALOG\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) continue;
  const cat = Function(`return (${m[1]})`)();
  const office = cat.sections.find((s) => s.id === 'office');
  console.log(p.includes('deploy') ? 'deploy' : 'overlay', 'office=', office?.title_zh, 'items=', office?.items?.length);
}
