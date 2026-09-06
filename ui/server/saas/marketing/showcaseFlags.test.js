// PD-SAAS-FORK
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getShowcaseAdminMode,
  getShowcaseSiteMode,
  isShowcaseCatalogPath,
  resolveShowcaseDataRoot,
} from './showcaseFlags.js';

describe('showcaseFlags', () => {
  it('reads site mode', () => {
    assert.equal(getShowcaseSiteMode({ PILOTDECK_SHOWCASE_SITE: 'off' }), 'off');
    assert.equal(getShowcaseSiteMode({ PILOTDECK_SHOWCASE_SITE: 'on' }), 'on');
    assert.equal(getShowcaseSiteMode({}), 'on');
  });

  it('reads admin mode', () => {
    assert.equal(getShowcaseAdminMode({ PILOTDECK_SHOWCASE_ADMIN: 'off' }), 'off');
    assert.equal(getShowcaseAdminMode({ PILOTDECK_SHOWCASE_ADMIN: 'enforce' }), 'enforce');
    assert.equal(getShowcaseAdminMode({}), 'shadow');
  });

  it('detects catalog paths', () => {
    assert.equal(isShowcaseCatalogPath('showcase/shared/catalog.js'), true);
    assert.equal(isShowcaseCatalogPath('showcase/shared/fullcases.js'), true);
    assert.equal(isShowcaseCatalogPath('showcase/shared/copy-packs.js'), true);
    assert.equal(isShowcaseCatalogPath('showcase/shared/copy-reader.js'), true);
    assert.equal(isShowcaseCatalogPath('showcase/shared/site.js'), true);
    assert.equal(isShowcaseCatalogPath('showcase/shared/demos.css'), false);
  });

  it('resolves showcase data root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-root-'));
    const resolved = resolveShowcaseDataRoot(
      { DATA_ROOT: tmp, PILOTDECK_SHOWCASE_DATA_ROOT: '' },
      tmp,
    );
    assert.equal(path.normalize(resolved ?? ''), path.normalize(path.join(tmp, 'marketing-showcase')));
    const explicit = resolveShowcaseDataRoot(
      { PILOTDECK_SHOWCASE_DATA_ROOT: '/var/showcase' },
      tmp,
    );
    assert.equal(explicit, '/var/showcase');
  });
});
