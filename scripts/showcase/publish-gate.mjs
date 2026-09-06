#!/usr/bin/env node
/**
 * Fixture DATA_ROOT publish roundtrip (L2).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-pub-'));
process.env.DATA_ROOT = tmp;
process.env.PILOTDECK_SHOWCASE_ADMIN = 'enforce';
delete process.env.SAAS_DATABASE_URL;

const { openControlDatabase, closeControlDatabase } = await import(
  pathToFileURL(path.join(root, 'ui/server/saas/db/control.js')).href
);
const store = await import(
  pathToFileURL(path.join(root, 'ui/server/saas/marketing/showcaseStore.js')).href
);
const { regenShowcaseCatalog } = await import(
  pathToFileURL(path.join(root, 'ui/server/saas/marketing/generateShowcaseCatalog.js')).href
);

await openControlDatabase(process.env);
await store.ensureSeedSections();

const id = 'gate-item-1';
await store.upsertItem({
  id,
  section_id: 'design',
  status: 'draft',
  name_zh: '门禁样例',
  name_en: 'Gate sample',
  annotation_zh: '测试',
  annotation_en: 'test',
  prompt_zh: 'x',
  prompt_en: 'x',
  thumb: 'media/thumbs/site-south.jpg',
  href: '/showcase/media/design/south-america/index.html',
  sort_order: 1,
});

const dataRoot = path.join(tmp, 'marketing-showcase');
fs.mkdirSync(path.join(dataRoot, 'media', id), { recursive: true });
fs.writeFileSync(path.join(dataRoot, 'media', id, 'thumb.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

await store.setItemStatus(id, 'published');
const sections = await store.listSections();
const items = (await store.listItems({})).filter((r) => r.status === 'published');
await regenShowcaseCatalog({ dataRoot, sections, items });

const catalogPath = path.join(dataRoot, 'shared', 'catalog.js');
if (!fs.existsSync(catalogPath)) {
  console.error('FAIL catalog missing');
  process.exit(1);
}
const cat = fs.readFileSync(catalogPath, 'utf8');
if (!cat.includes(id)) {
  console.error('FAIL published item not in catalog');
  process.exit(1);
}

await store.setItemStatus(id, 'archived');
const items2 = (await store.listItems({})).filter((r) => r.status === 'published');
await regenShowcaseCatalog({ dataRoot, sections, items: items2 });
const cat2 = fs.readFileSync(catalogPath, 'utf8');
if (cat2.includes(id)) {
  console.error('FAIL archived item still in public catalog');
  process.exit(1);
}

await closeControlDatabase();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('publish_roundtrip=1');
console.log('false_public_item=0');
console.log('test:showcase:publish:gate OK');
