import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countMarkdownWords,
  extractMarkdownSummary,
  extractMarkdownTitle,
  inferMarkdownLang,
} from './markdownShareWordCount.js';

describe('markdownShareWordCount', () => {
  it('extracts ATX H1 as document title over filename fallback', () => {
    const md = '# 数据源溯源\n\n第一段说明联网检索来源。\n';
    assert.equal(extractMarkdownTitle(md, 'data-sources'), '数据源溯源');
  });

  it('falls back when no H1', () => {
    assert.equal(extractMarkdownTitle('只有段落', 'report'), 'report');
  });

  it('summary strips H1 and keeps body prose', () => {
    const md = '# 标题\n\n这是摘要正文内容，用于 SEO 与 GEO。\n';
    const summary = extractMarkdownSummary(md, 80);
    assert.doesNotMatch(summary, /^标题/);
    assert.match(summary, /摘要正文|SEO|GEO/);
  });

  it('counts CJK and latin words', () => {
    assert.ok(countMarkdownWords('你好 world') >= 2);
  });

  it('infers zh when CJK dominates', () => {
    assert.equal(inferMarkdownLang('这是一份完整的中文市场调研报告正文内容较多'), 'zh-CN');
  });
});
