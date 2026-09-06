import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  assertMarketingPageSlug,
  getMarketingPagePublic,
  isMarketingPagesCmsEnabled,
  loadMarketingPage,
  renderMarketingMarkdown,
  saveMarketingPage,
  sanitizeMarketingHtml,
} from './marketingPages.js';

describe('marketingPages', () => {
  it('slug allowlist', () => {
    assert.equal(assertMarketingPageSlug('about'), 'about');
    assert.equal(assertMarketingPageSlug('copyright'), 'copyright');
    assert.throws(() => assertMarketingPageSlug('evil'), /invalid_slug/);
  });

  it('flag defaults on', () => {
    assert.equal(isMarketingPagesCmsEnabled({}), true);
    assert.equal(isMarketingPagesCmsEnabled({ PILOTDECK_MARKETING_PAGES_CMS: '0' }), false);
  });

  it('sanitizes script and handlers', () => {
    const dirty = '<p onclick="alert(1)">Hi</p><script>x()</script><a href="javascript:alert(1)">x</a>';
    const clean = sanitizeMarketingHtml(dirty);
    assert.ok(!/script/i.test(clean));
    assert.ok(!/onclick/i.test(clean));
    assert.ok(!/javascript:/i.test(clean));
  });

  it('renders markdown to safe html', () => {
    const html = renderMarketingMarkdown('# Hello\n\n**bold**');
    assert.match(html, /<h1>/);
    assert.match(html, /<strong>/);
  });

  it('loads seed and saves overlay when CMS on', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-pages-'));
    const about = loadMarketingPage('about', { dataRoot: tmp, env: { PILOTDECK_MARKETING_PAGES_CMS: '1' } });
    assert.ok(about.title_zh.includes('关于') || about.title_zh.length > 0);
    saveMarketingPage(
      'about',
      {
        title_zh: '关于我们测试',
        title_en: 'About Test',
        body_zh_md: '中文正文',
        body_en_md: 'English body',
      },
      { dataRoot: tmp },
    );
    const pub = getMarketingPagePublic('about', 'en', {
      dataRoot: tmp,
      env: { PILOTDECK_MARKETING_PAGES_CMS: '1' },
    });
    assert.equal(pub.title, 'About Test');
    assert.match(pub.html, /English body/);
  });

  it('CMS off ignores overlay', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-pages-off-'));
    fs.mkdirSync(path.join(tmp, 'marketing', 'pages'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'marketing', 'pages', 'about.json'),
      JSON.stringify({
        title_zh: '覆盖',
        title_en: 'Overlay',
        body_zh_md: 'x',
        body_en_md: 'y',
      }),
    );
    const page = loadMarketingPage('about', {
      dataRoot: tmp,
      env: { PILOTDECK_MARKETING_PAGES_CMS: '0' },
    });
    assert.notEqual(page.title_en, 'Overlay');
  });
});
