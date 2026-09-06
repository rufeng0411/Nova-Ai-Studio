import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertShareCreateRateLimit,
  buildAbsolutePublicShareUrl,
  generateShareId,
  mapShareLinkRow,
  resetShareCreateRateLimitForTests,
} from './markdownShareLinks.js';
import { countMarkdownWords, inferMarkdownLang } from './markdownShareWordCount.js';

describe('markdownShareLinks helpers', () => {
  it('generates high-entropy url-safe ids', () => {
    const id = generateShareId();
    assert.match(id, /^[A-Za-z0-9_-]{22}$/);
    assert.notEqual(generateShareId(), id);
  });

  it('maps db rows', () => {
    const mapped = mapShareLinkRow({
      id: 'abc',
      tenant_id: 't1',
      user_id: 2,
      project_key: 'general',
      relative_path: 'artifacts/a.md',
      hint_dir: null,
      title: 'a',
      word_count: 12,
      seo_indexable: 0,
      revoked_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });
    assert.equal(mapped.tenantId, 't1');
    assert.equal(mapped.seoIndexable, false);
    assert.equal(mapped.wordCount, 12);
  });

  it('builds absolute urls without jwt', () => {
    const url = buildAbsolutePublicShareUrl('sid123', {
      env: { PUBLIC_SHARE_ORIGIN: 'https://www.example.com/' },
    });
    assert.equal(url, 'https://www.example.com/s/sid123');
    assert.doesNotMatch(url, /token=/);
  });

  it('rate limits create bursts', () => {
    resetShareCreateRateLimitForTests();
    for (let i = 0; i < 10; i += 1) {
      assertShareCreateRateLimit('u1', { limit: 10 });
    }
    assert.throws(() => assertShareCreateRateLimit('u1', { limit: 10 }), /rate limit/i);
  });
});

describe('markdownShareWordCount', () => {
  it('counts cjk and latin separately', () => {
    assert.equal(countMarkdownWords('你好世界 hello world'), 6);
    assert.equal(inferMarkdownLang('这是中文报告内容较多'), 'zh-CN');
    assert.equal(inferMarkdownLang('This is mostly English text for GEO.'), 'en');
  });
});
