#!/usr/bin/env node
/**
 * Batch render all about/*.md to branded PDFs under about/pdf/
 * Run: npm run brand:about-pdfs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from './lib/aboutMarkdown.mjs';
import { buildHtmlDocument, injectBrandChrome, initAboutPdfLogos } from './lib/aboutPdfBrand.mjs';
import { getChartEnrichment } from './lib/aboutPdfCharts.mjs';
import { renderHtmlToPdf, renderExistingHtmlToPdf } from './lib/aboutPdfRender.mjs';
import {
  rewriteAboutLinks,
  pdfReadmeHref,
  indexHrefFromRoot,
  DIR_DEFAULT_HTML,
  addBlankTargetsToLinks,
} from './lib/aboutLinkRewrite.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const ABOUT = join(REPO, 'about');
const PDF_ROOT = join(ABOUT, 'pdf');
const HTML_ROOT = join(ABOUT, '_pdf-html');

const CATEGORY_LABELS = {
  brand: '品牌',
  product: '产品',
  market: '市场',
  business: '商业',
  sales: '销售',
  design: '设计',
  trust: '信任与安全',
  press: '公关',
  en: 'English',
};

function walkMarkdownFiles(dir, base = dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'pdf' || name === '_pdf-html') continue;
      results.push(...walkMarkdownFiles(full, base));
    } else if (name.endsWith('.md')) {
      results.push(relative(base, full));
    }
  }
  return results.sort();
}

function extractTitle(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback.replace(/\.md$/, '');
}

function categoryFromPath(relPath) {
  const top = relPath.replace(/\\/g, '/').split('/')[0];
  return CATEGORY_LABELS[top] ?? 'Nova Ai-Studio';
}

async function main() {
  await initAboutPdfLogos();
  const mdFiles = walkMarkdownFiles(ABOUT);
  console.log(`[about-pdf] Found ${mdFiles.length} markdown files`);

  mkdirSync(PDF_ROOT, { recursive: true });
  mkdirSync(HTML_ROOT, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  for (const rel of mdFiles) {
    const mdPath = join(ABOUT, rel);
    const md = readFileSync(mdPath, 'utf8');
    const relNorm = rel.replace(/\\/g, '/');
    const enrich = getChartEnrichment(relNorm);
    const title = extractTitle(md, basename(rel));
    const category = categoryFromPath(relNorm);

    const before = enrich.before ?? '';
    const after = enrich.after ?? '';
    let bodyHtml = before + markdownToHtml(md) + after;
    bodyHtml = rewriteAboutLinks(bodyHtml, relNorm, 'html', relNorm.replace(/\.md$/, '.html'));

    const html = buildHtmlDocument({
      title,
      bodyHtml,
      category,
      cover: Boolean(enrich.cover),
      landscape: Boolean(enrich.landscape),
    });

    const htmlOut = join(HTML_ROOT, relNorm.replace(/\.md$/, '.html'));
    mkdirSync(dirname(htmlOut), { recursive: true });
    writeFileSync(htmlOut, addBlankTargetsToLinks(html), 'utf8');

    const pdfOut = join(PDF_ROOT, relNorm.replace(/\.md$/, '.pdf'));
    try {
      const size = await renderHtmlToPdf(browser, html, pdfOut, { landscape: enrich.landscape });
      results.push({ rel: relNorm, ok: true, pdf: pdfOut, size });
      console.log(`[OK] ${relNorm} (${Math.round(size / 1024)}KB)`);
    } catch (err) {
      results.push({ rel: relNorm, ok: false, error: String(err) });
      console.error(`[FAIL] ${relNorm}:`, err instanceof Error ? err.message : err);
    }
  }

  const salesHtml = join(ABOUT, 'sales/nova-product-features.html');
  if (existsSync(salesHtml)) {
    const pdfOut = join(PDF_ROOT, 'sales/nova-product-features.pdf');
    try {
      let html = readFileSync(salesHtml, 'utf8');
      html = injectBrandChrome(html);
      const size = await renderExistingHtmlToPdf(browser, html, pdfOut, true);
      results.push({ rel: 'sales/nova-product-features.html', ok: true, pdf: pdfOut, size });
      console.log(`[OK] sales/nova-product-features.html (${Math.round(size / 1024)}KB)`);
    } catch (err) {
      console.error('[FAIL] sales/nova-product-features.html:', err);
    }
  }

  await browser.close();

  // Promote any .pdf.new written when targets were locked (e.g. viewer open).
  try {
    const { spawnSync } = await import('node:child_process');
    spawnSync(process.execPath, [join(__dir, 'promote-about-pdf-new.mjs')], { stdio: 'inherit' });
  } catch {
    /* optional */
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n[about-pdf] Done: ${ok} OK, ${fail} failed`);
  console.log(`[about-pdf] Output: ${PDF_ROOT}`);

  const indexLines = [
    '# Nova Ai-Studio · PDF 索引',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '> 网页浏览请打开 [../index.html](../index.html)',
    '',
    '| 源文档 | PDF |',
    '|--------|-----|',
    ...results
      .filter((r) => r.ok)
      .map((r) => {
        const pdfHref = pdfReadmeHref(r.pdf, PDF_ROOT);
        const src = r.rel;
        const srcHref = `../${src}`;
        return `| [${src}](${srcHref}) | [PDF](${pdfHref}) |`;
      }),
  ];
  writeFileSync(join(PDF_ROOT, 'README.md'), indexLines.join('\n'), 'utf8');

  writeAboutIndexHtml(mdFiles, results.filter((r) => r.ok));

  if (fail > 0) process.exit(1);
}

function writeAboutIndexHtml(mdFiles, okResults) {
  const rows = mdFiles
    .map((rel) => {
      const norm = rel.replace(/\\/g, '/');
      const title = norm.replace(/\.md$/, '').split('/').pop();
      const html = indexHrefFromRoot(norm, 'html');
      const pdf = indexHrefFromRoot(norm, 'pdf');
      const md = indexHrefFromRoot(norm, 'md');
      return `<tr><td>${title}</td><td><a href="${md}" target="_blank" rel="noopener noreferrer">Markdown</a></td><td><a href="${html}" target="_blank" rel="noopener noreferrer">网页</a></td><td><a href="${pdf}" target="_blank" rel="noopener noreferrer">PDF</a></td></tr>`;
    })
    .join('\n');

  const dirRows = Object.entries(DIR_DEFAULT_HTML)
    .map(([dir, html]) => {
      const label = CATEGORY_LABELS[dir] ?? dir;
      return `<li><a href="_pdf-html/${html}" target="_blank" rel="noopener noreferrer">${label}</a>（<code>${dir}/</code>）</li>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nova Ai-Studio · 市场品牌资料库</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, "Microsoft YaHei", sans-serif; }
    body { max-width: 960px; margin: 2rem auto; padding: 0 1.25rem; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { border: 1px solid #ccc; padding: 0.45rem 0.6rem; text-align: left; }
    th { background: #f4f4f5; }
    a { color: #2563eb; }
    nav ul { padding-left: 1.2rem; }
    .note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Nova Ai-Studio · 市场品牌资料库</h1>
  <p class="meta">对外品牌：Nova Ai-Studio 2.0 · 智能体创作平台 · AI 营销创意生产平台</p>
  <div class="note">
    <strong>网页阅读</strong>：本页所有链接均为相对路径，可整包拷贝或挂载到任意子目录。
    完整导航页：<a href="_pdf-html/README.html" target="_blank" rel="noopener noreferrer">引导页（HTML）</a> ·
    Markdown 索引：<a href="README.md" target="_blank" rel="noopener noreferrer">README.md</a> ·
    PDF 索引：<a href="pdf/README.md" target="_blank" rel="noopener noreferrer">pdf/README.md</a>
  </div>
  <h2>按分类进入</h2>
  <nav><ul>${dirRows}</ul></nav>
  <h2>全部文档</h2>
  <table>
    <thead><tr><th>文档</th><th>源稿</th><th>网页</th><th>PDF</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  writeFileSync(join(ABOUT, 'index.html'), html, 'utf8');
  console.log('[about-pdf] Wrote about/index.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
