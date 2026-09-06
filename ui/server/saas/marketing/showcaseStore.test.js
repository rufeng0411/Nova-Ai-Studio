// PD-SAAS-FORK
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeControlDatabase } from '../db/control.js';
import {
  ensureSeedSections,
  listItems,
  listSections,
  upsertItem,
  setItemStatus,
  SHOWCASE_SECTION_SEEDS,
} from './showcaseStore.js';
import { regenShowcaseCatalog } from './generateShowcaseCatalog.js';

describe('showcaseStore (sqlite)', () => {
  /** @type {string} */
  let tmpRoot;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-store-'));
    process.env.DATA_ROOT = tmpRoot;
    process.env.DEV_SAAS_SQLITE = '1';
    delete process.env.SAAS_DATABASE_URL;
    await closeControlDatabase();
  });

  after(async () => {
    await closeControlDatabase();
    delete process.env.DATA_ROOT;
    delete process.env.DEV_SAAS_SQLITE;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('seeds showcase sections including starred fullcase and compliance', async () => {
    await ensureSeedSections();
    const sections = await listSections();
    assert.equal(sections.length, SHOWCASE_SECTION_SEEDS.length);
    assert.ok(sections.some((sec) => sec.id === 'fullcase' && sec.star === 1));
    assert.ok(sections.some((sec) => sec.id === 'compliance' && sec.star === 1));
    const order = sections.map((sec) => sec.id);
    assert.ok(order.indexOf('compliance') > order.indexOf('fullcase'));
  });

  it('upserts draft item and publishes via catalog regen', async () => {
    await upsertItem({
      id: 'test-design-1',
      section_id: 'design',
      status: 'draft',
      name_zh: '测试案例',
      name_en: 'Test case',
      href: '/showcase/media/design/test/index.html',
      thumb: 'media/thumbs/test.jpg',
      sort_order: 99,
    });
    let items = await listItems({ sectionId: 'design' });
    assert.ok(items.some((row) => row.id === 'test-design-1' && row.status === 'draft'));

    await setItemStatus('test-design-1', 'published');
    items = await listItems({ status: 'published' });
    assert.ok(items.some((row) => row.id === 'test-design-1'));

    process.env.PILOTDECK_SHOWCASE_DATA_ROOT = path.join(tmpRoot, 'marketing-showcase');
    const sections = await listSections();
    const showcaseRoot = path.join(tmpRoot, 'marketing-showcase');
    const regen = regenShowcaseCatalog({
      dataRoot: showcaseRoot,
      sections,
      items,
    });
    assert.equal(regen.itemCount, 1);
    assert.ok(fs.existsSync(regen.catalogPath));
    const catalogSrc = fs.readFileSync(regen.catalogPath, 'utf8');
    assert.match(catalogSrc, /window\.NOVA_SHOWCASE_CATALOG/);
    assert.match(catalogSrc, /测试案例/);
    assert.match(catalogSrc, /name_en/);
    assert.match(catalogSrc, /emptyHint_zh/);
    assert.match(catalogSrc, /精彩案例正在整理中/);
  });

  it('publishes compliance section item into regenerated catalog with star', async () => {
    await upsertItem({
      id: 'test-compliance-1',
      section_id: 'compliance',
      status: 'draft',
      name_zh: '合规手册样例',
      name_en: 'Compliance handbook sample',
      href: '/showcase/media/compliance/handbook/index.html',
      thumb: '/showcase/media/compliance/handbook/thumb.jpg',
      sort_order: 10,
    });
    await setItemStatus('test-compliance-1', 'published');
    const sections = await listSections();
    const items = await listItems({ status: 'published' });
    const showcaseRoot = path.join(tmpRoot, 'marketing-showcase-compliance');
    const regen = regenShowcaseCatalog({
      dataRoot: showcaseRoot,
      sections,
      items,
    });
    assert.ok(regen.sectionCount >= SHOWCASE_SECTION_SEEDS.length);
    const catalogSrc = fs.readFileSync(regen.catalogPath, 'utf8');
    assert.match(catalogSrc, /"id": "compliance"/);
    assert.match(catalogSrc, /企业合规/);
    assert.match(catalogSrc, /合规手册样例/);
    const catalog = JSON.parse(
      catalogSrc.replace(/^[\s\S]*window\.NOVA_SHOWCASE_CATALOG = /, '').replace(/;\s*$/, ''),
    );
    const compliance = catalog.sections.find((sec) => sec.id === 'compliance');
    assert.ok(compliance?.star === true);
    assert.ok(compliance.items.some((it) => it.id === 'test-compliance-1'));
    const order = catalog.sections.map((sec) => sec.id);
    assert.ok(order.indexOf('compliance') > order.indexOf('fullcase'));
  });
});
