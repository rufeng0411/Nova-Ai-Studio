// PD-SAAS-FORK
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMarketingSiteEnabled, matchMarketingPath } from './marketingPathMatch.js';

describe('matchMarketingPath', () => {
  it('maps core routes', () => {
    assert.equal(matchMarketingPath('/'), 'index.html');
    assert.equal(matchMarketingPath('/docs/'), 'docs/index.html');
    assert.equal(matchMarketingPath('/contact'), 'contact/index.html');
    assert.equal(matchMarketingPath('/llms.txt'), 'llms.txt');
    assert.equal(matchMarketingPath('/robots.txt'), 'robots.txt');
    assert.equal(matchMarketingPath('/sitemap.xml'), 'sitemap.xml');
    assert.equal(matchMarketingPath('/manifest.webmanifest'), 'manifest.webmanifest');
    assert.equal(matchMarketingPath('/sw.js'), 'sw.js');
    assert.equal(matchMarketingPath('/geo/'), 'geo/index.html');
    assert.equal(matchMarketingPath('/for-ai/'), 'geo/index.html');
    assert.equal(matchMarketingPath('/faq/'), 'faq/index.html');
    assert.equal(matchMarketingPath('/compare'), 'compare/index.html');
    assert.equal(matchMarketingPath('/claims/'), 'claims/index.html');
    assert.equal(matchMarketingPath('/about/'), 'about/index.html');
    assert.equal(matchMarketingPath('/copyright'), 'copyright/index.html');
  });

  it('maps shared assets', () => {
    assert.equal(matchMarketingPath('/shared/tokens.css'), 'shared/tokens.css');
    assert.equal(matchMarketingPath('/assets/nova-logo-mark.png'), 'assets/nova-logo-mark.png');
  });

  it('rejects traversal and SPA paths', () => {
    assert.equal(matchMarketingPath('/../etc/passwd'), null);
    assert.equal(matchMarketingPath('/login'), null);
    assert.equal(matchMarketingPath('/app'), null);
    assert.equal(matchMarketingPath('/api/foo'), null);
  });

  it('maps showcase when enabled', () => {
    const on = { PILOTDECK_SHOWCASE_SITE: 'on', PILOTDECK_MARKETING_I18N: '1' };
    assert.equal(matchMarketingPath('/showcase/', on), 'showcase/index.html');
    assert.equal(
      matchMarketingPath('/showcase/fullcase-campaign.html', on),
      'showcase/fullcase-campaign.html',
    );
    assert.equal(matchMarketingPath('/showcase/shared/catalog.js', on), 'showcase/shared/catalog.js');
    assert.equal(matchMarketingPath('/showcase/', { PILOTDECK_SHOWCASE_SITE: 'off' }), null);
  });

  it('maps /en routes when i18n on', () => {
    const env = { PILOTDECK_SHOWCASE_SITE: 'on', PILOTDECK_MARKETING_I18N: '1' };
    assert.equal(matchMarketingPath('/en/', env), 'en/index.html');
    assert.equal(matchMarketingPath('/en/docs/', env), 'en/docs/index.html');
    assert.equal(matchMarketingPath('/en/showcase/', env), 'en/showcase/index.html');
    assert.equal(matchMarketingPath('/en/about/', env), 'en/about/index.html');
    assert.equal(matchMarketingPath('/en/copyright/', env), 'en/copyright/index.html');
    assert.equal(matchMarketingPath('/en/shared/tokens.css', env), 'shared/tokens.css');
  });

  it('shares showcase viewers/media under /en (no en/ copy needed)', () => {
    const env = { PILOTDECK_SHOWCASE_SITE: 'on', PILOTDECK_MARKETING_I18N: '1' };
    assert.equal(
      matchMarketingPath('/en/showcase/copy-reader.html', env),
      'showcase/copy-reader.html',
    );
    assert.equal(
      matchMarketingPath('/en/showcase/shared/copy-packs.js', env),
      'showcase/shared/copy-packs.js',
    );
    assert.equal(
      matchMarketingPath('/en/showcase/media/sc-copy-product-pr/product-pr.md', env),
      'showcase/media/sc-copy-product-pr/product-pr.md',
    );
    assert.equal(matchMarketingPath('/showcase/copy-reader.html', env), 'showcase/copy-reader.html');
  });

  it('decodes percent-encoded Chinese showcase media paths', () => {
    const on = { PILOTDECK_SHOWCASE_SITE: 'on' };
    const encoded =
      '/showcase/media/sc-fullcase-campaign/' +
      encodeURIComponent('00-执行摘要与任务总览.md');
    assert.equal(
      matchMarketingPath(encoded, on),
      'showcase/media/sc-fullcase-campaign/00-执行摘要与任务总览.md',
    );
    assert.equal(
      matchMarketingPath(
        '/showcase/media/sc-fullcase-saas-growth/' + encodeURIComponent('澜析季度增长全案.md'),
        on,
      ),
      'showcase/media/sc-fullcase-saas-growth/澜析季度增长全案.md',
    );
    // Encoded ".." must still reject after decode
    assert.equal(matchMarketingPath('/showcase/' + encodeURIComponent('..') + '/x.md', on), null);
  });
});

describe('isMarketingSiteEnabled', () => {
  it('reads env', () => {
    assert.equal(isMarketingSiteEnabled({ PILOTDECK_MARKETING_SITE: '1' }), true);
    assert.equal(isMarketingSiteEnabled({ PILOTDECK_MARKETING_SITE: '0' }), false);
    assert.equal(isMarketingSiteEnabled({}), false);
  });
});
