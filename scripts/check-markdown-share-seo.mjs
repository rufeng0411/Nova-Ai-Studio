#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Markdown 公开分享页 SEO / GEO / LLM 可见性门禁
 * — favicon、title 品牌后缀、description/summary、canonical、OG/Twitter、JSON-LD、正文摘要块
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  wrapMarkdownShareHtmlDocument,
  wrapShareErrorHtml,
  extractMarkdownTitle,
  extractMarkdownSummary,
} from '../ui/server/saas/markdownShareHtml.js';

const REPO = join(fileURLToPath(import.meta.url), '../..');
const PUBLIC = join(REPO, 'ui', 'public');

let failed = 0;

function fail(msg) {
  console.error(`[markdown-share-seo] FAIL ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`[markdown-share-seo] ok ${msg}`);
}

const REQUIRED_ASSETS = [
  'favicon.svg',
  'favicon.png',
  'logo-128.png',
  'logo-256.png',
  'icons/icon-192x192.png',
  'share.webmanifest',
];

for (const rel of REQUIRED_ASSETS) {
  if (!existsSync(join(PUBLIC, rel))) fail(`missing public asset ${rel}`);
  else ok(`asset ${rel}`);
}

const mdSample = `# 数据源溯源

本报告汇总了联网检索与附件来源，供成果验收与 GEO 引用。

第二段补充更多上下文，确保摘要提取不依赖文件名 data-sources。
`;

const extractedTitle = extractMarkdownTitle(mdSample, 'data-sources');
if (extractedTitle !== '数据源溯源') {
  fail(`extractMarkdownTitle expected 数据源溯源, got ${extractedTitle}`);
} else ok('extractMarkdownTitle from H1');

const summary = extractMarkdownSummary(mdSample, 280);
if (!summary || summary.length < 12) fail(`extractMarkdownSummary too short: ${summary}`);
else if (!/联网|检索|来源|验收|GEO/.test(summary)) fail(`extractMarkdownSummary missing body: ${summary}`);
else ok('extractMarkdownSummary');

const doc = wrapMarkdownShareHtmlDocument({
  title: extractedTitle,
  bodyHtml: '<h1>数据源溯源</h1><p>正文段落</p>',
  canonicalUrl: 'https://example.com/s/shareSeoTest',
  description: summary.slice(0, 160),
  summary,
  wordCount: 88,
  shareId: 'shareSeoTest',
  seoIndexable: false,
  lang: 'zh-CN',
  fileName: 'data-sources.md',
  datePublished: '2026-08-03T00:00:00.000Z',
  dateModified: '2026-08-03T12:00:00.000Z',
  ogImageUrl: 'https://example.com/logo-256.png',
  origin: 'https://example.com',
});

const checks = [
  [/favicon\.svg/, 'favicon.svg link'],
  [/favicon\.png/, 'favicon.png link'],
  [/apple-touch-icon/, 'apple-touch-icon'],
  [/<title>数据源溯源 · Nova Ai Studio<\/title>/, 'branded <title>'],
  [/name=["']description["']\s+content=["'][^"']{8,}/i, 'meta description'],
  [/name=["']summary["']\s+content=["'][^"']{8,}/i, 'meta summary'],
  [/name=["']abstract["']/i, 'meta abstract'],
  [/name=["']citation_title["']\s+content=["']数据源溯源["']/i, 'citation_title'],
  [/name=["']robots["']\s+content=["']noindex,nofollow["']/i, 'default robots noindex'],
  [/rel=["']canonical["']\s+href=["']https:\/\/example\.com\/s\/shareSeoTest["']/i, 'canonical'],
  [/property=["']og:title["']/i, 'og:title'],
  [/property=["']og:description["']/i, 'og:description'],
  [/property=["']og:image["']/i, 'og:image'],
  [/property=["']og:type["']\s+content=["']article["']/i, 'og:type article'],
  [/name=["']twitter:card["']/i, 'twitter:card'],
  [/application\/ld\+json/, 'JSON-LD script'],
  [/"@type"\s*:\s*"Article"/, 'JSON-LD Article'],
  [/"@type"\s*:\s*"Organization"/, 'JSON-LD Organization'],
  [/"@type"\s*:\s*"WebPage"/, 'JSON-LD WebPage'],
  [/id=["']share-llm-summary["']/, 'visible LLM/GEO abstract block'],
  [/>摘要</, 'abstract label zh'],
  [/由 Nova Ai Studio 生成的公开阅读页/, 'publisher line in abstract'],
  [/name=["']ai-content["']\s+content=["']document["']/i, 'ai-content meta'],
  [/Nova Ai Studio/, 'brand string present'],
];

for (const [re, label] of checks) {
  if (!re.test(doc)) fail(label);
  else ok(label);
}

if (/href=["']\/favicon\.ico["']/i.test(doc) && !/favicon\.(svg|png)/i.test(doc)) {
  fail('only favicon.ico without svg/png');
}

const indexable = wrapMarkdownShareHtmlDocument({
  title: '可索引文档',
  bodyHtml: '<p>ok</p>',
  canonicalUrl: 'https://example.com/s/ix',
  description: '可索引说明文字足够长',
  summary: '可索引说明文字足够长供摘要',
  shareId: 'ix',
  seoIndexable: true,
  origin: 'https://example.com',
});
if (!/name=["']robots["']\s+content=["']index,follow/i.test(indexable)) {
  fail('seoIndexable robots index,follow');
} else ok('seoIndexable robots');

const err = wrapShareErrorHtml('请重新分享', { title: '链接已失效' });
if (!/<title>链接已失效 · Nova Ai Studio<\/title>/.test(err)) fail('error page branded title');
else ok('error page branded title');
if (!/favicon\.svg/.test(err) || !/favicon\.png/.test(err)) fail('error page favicons');
else ok('error page favicons');

if (failed > 0) {
  console.error(`[markdown-share-seo] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[markdown-share-seo] all checks passed');
