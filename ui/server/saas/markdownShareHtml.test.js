import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enhanceShareBodyHtml,
  renderMarkdownBodyHtml,
  rewriteMarkdownShareAssetUrls,
  wrapMarkdownShareHtmlDocument,
  wrapShareErrorHtml,
} from './markdownShareHtml.js';

describe('markdownShareHtml', () => {
  it('renders markdown body html', () => {
    const html = renderMarkdownBodyHtml('# Hello\n\n**bold**');
    assert.match(html, /<h1>/);
    assert.match(html, /<strong>/);
  });

  it('rewrites relative asset urls to public share assets', () => {
    const body = '<p><img src="assets/hero.png" alt="x"></p>';
    const out = rewriteMarkdownShareAssetUrls(body, {
      shareId: 'abcShare',
      mdRelativePath: 'artifacts/task-1/report.md',
      origin: 'https://example.com',
    });
    assert.match(out, /\/s\/abcShare\/asset\/assets\/hero\.png/);
    assert.doesNotMatch(out, /token=/);
  });

  it('wraps standalone html with seo/geo and header chrome', () => {
    const doc = wrapMarkdownShareHtmlDocument({
      title: '调研报告',
      bodyHtml: '<p>正文</p>',
      canonicalUrl: 'https://example.com/s/abc',
      description: '调研报告摘要',
      summary: '调研报告摘要更长一点',
      wordCount: 120,
      shareId: 'abc',
      seoIndexable: false,
      lang: 'zh-CN',
      fileName: 'report.md',
      origin: 'https://example.com',
    });
    assert.match(doc, /<title>调研报告 · Nova Ai Studio<\/title>/);
    assert.match(doc, /favicon\.svg/);
    assert.match(doc, /favicon\.png/);
    assert.match(doc, /og:title/);
    assert.match(doc, /twitter:card/);
    assert.match(doc, /application\/ld\+json/);
    assert.match(doc, /"@type":"Article"/);
    assert.match(doc, /"@type":"Organization"/);
    assert.match(doc, /noindex,nofollow/);
    assert.match(doc, /logo-128\.png/);
    assert.match(doc, /约 120 字/);
    assert.match(doc, /Nova Ai Studio/);
    assert.match(doc, /id="share-llm-summary"/);
    assert.match(doc, /citation_title/);
    assert.match(doc, /data-export="pdf"/);
    assert.doesNotMatch(doc, /token=/);
  });

  it('wraps share error as readable html page', () => {
    const doc = wrapShareErrorHtml('请稍后重试', { title: '打开失败' });
    assert.match(doc, /<title>打开失败 · Nova Ai Studio<\/title>/);
    assert.match(doc, /请稍后重试/);
    assert.match(doc, /logo-128\.png/);
    assert.match(doc, /favicon\.svg/);
  });

  it('wraps wide tables for horizontal scroll and marks images', () => {
    const html = enhanceShareBodyHtml(
      '<table><tr><td>https://example.com/very/long/url/path</td></tr></table><img src="a.png" alt="x">',
    );
    assert.match(html, /class="table-scroll"/);
    assert.match(html, /share-media/);
    assert.match(html, /loading="lazy"/);
  });

  it('includes pwa and responsive overflow styles', () => {
    const doc = wrapMarkdownShareHtmlDocument({
      title: '表',
      bodyHtml: '<table><tr><td>a</td></tr></table>',
      canonicalUrl: 'https://example.com/s/abc',
      shareId: 'abc',
    });
    assert.match(doc, /share\.webmanifest/);
    assert.match(doc, /apple-mobile-web-app-capable/);
    assert.match(doc, /table-scroll/);
    assert.match(doc, /orientation: landscape/);
    assert.match(doc, /overflow-x:\s*auto/);
    assert.match(doc, /viewport-fit=cover/);
  });
});
