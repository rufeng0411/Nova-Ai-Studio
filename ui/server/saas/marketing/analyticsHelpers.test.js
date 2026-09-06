import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyBrowser,
  classifyChannel,
  classifyDevice,
  normalizeReferrerHost,
  pctDelta,
  rankTop,
} from './analyticsHelpers.js';

describe('marketing analyticsHelpers', () => {
  it('normalizes referrer hosts', () => {
    assert.equal(normalizeReferrerHost(''), '(直接访问)');
    assert.equal(normalizeReferrerHost('https://www.google.com/search?q=a'), 'google.com');
    assert.equal(normalizeReferrerHost('https://mp.weixin.qq.com/s/x'), 'mp.weixin.qq.com');
  });

  it('classifies devices and browsers', () => {
    assert.equal(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'mobile');
    assert.equal(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'), 'desktop');
    assert.equal(classifyDevice('Googlebot/2.1'), 'bot');
    assert.equal(classifyBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'), 'Chrome');
    assert.equal(classifyBrowser('Mozilla/5.0 Edg/120.0.0.0'), 'Edge');
  });

  it('classifies traffic channels', () => {
    assert.equal(classifyChannel({}), '直接访问');
    assert.equal(
      classifyChannel({ utmSource: 'newsletter', utmMedium: 'email' }),
      '邮件',
    );
    assert.equal(
      classifyChannel({ utmSource: 'baidu', utmMedium: 'cpc' }),
      '付费投放',
    );
    assert.equal(
      classifyChannel({ referrer: 'https://www.google.com/' }),
      '自然搜索',
    );
    assert.equal(
      classifyChannel({ referrer: 'https://partner.example.com/blog' }),
      '站外引用',
    );
  });

  it('ranks and deltas', () => {
    const ranked = rankTop(
      [
        { label: 'a', count: 2 },
        { label: 'a', count: 3 },
        { label: 'b', count: 9 },
      ],
      10,
    );
    assert.equal(ranked[0].label, 'b');
    assert.equal(ranked[1].count, 5);
    assert.equal(pctDelta(120, 100), 20);
    assert.equal(pctDelta(50, 0), 100);
  });
});
