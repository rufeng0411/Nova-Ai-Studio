#!/usr/bin/env node
/** Regenerate a single about PDF for quick verification. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from './lib/aboutMarkdown.mjs';
import { buildHtmlDocument, initAboutPdfLogos } from './lib/aboutPdfBrand.mjs';
import { getChartEnrichment } from './lib/aboutPdfCharts.mjs';
import { rewriteAboutLinks } from './lib/aboutLinkRewrite.mjs';
import { renderHtmlToPdf } from './lib/aboutPdfRender.mjs';

const rel = process.argv[2] || 'brand/品牌手册.md';
const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const ABOUT = join(REPO, 'about');
const PDF_ROOT = join(ABOUT, 'pdf');

async function main() {
  await initAboutPdfLogos();
  const mdPath = join(ABOUT, rel);
  const md = readFileSync(mdPath, 'utf8');
  const relNorm = rel.replace(/\\/g, '/');
  const enrich = getChartEnrichment(relNorm);
  const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? relNorm;
  let bodyHtml = (enrich.before ?? '') + markdownToHtml(md) + (enrich.after ?? '');
  bodyHtml = rewriteAboutLinks(bodyHtml, relNorm, 'html', relNorm.replace(/\.md$/, '.html'));
  const html = buildHtmlDocument({
    title,
    bodyHtml,
    category: '品牌',
    cover: Boolean(enrich.cover),
    landscape: Boolean(enrich.landscape),
  });
  const pdfOut = join(PDF_ROOT, relNorm.replace(/\.md$/, '.pdf'));
  mkdirSync(dirname(pdfOut), { recursive: true });
  const browser = await chromium.launch();
  const size = await renderHtmlToPdf(browser, html, pdfOut, { landscape: enrich.landscape });
  await browser.close();
  console.log('[ok]', pdfOut, `(${Math.round(size / 1024)}KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
