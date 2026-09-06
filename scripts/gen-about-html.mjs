#!/usr/bin/env node
/**
 * Regenerate about/_pdf-html/*.html and about/index.html only (no PDF).
 * Run: node scripts/gen-about-html.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from './lib/aboutMarkdown.mjs';
import { buildHtmlDocument, initAboutPdfLogos } from './lib/aboutPdfBrand.mjs';
import { getChartEnrichment } from './lib/aboutPdfCharts.mjs';
import {
  rewriteAboutLinks,
  indexHrefFromRoot,
  DIR_DEFAULT_HTML,
  addBlankTargetsToLinks,
} from './lib/aboutLinkRewrite.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const ABOUT = join(REPO, 'about');
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

function writeAboutIndexHtml(mdFiles) {
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

  const page = `<!DOCTYPE html>
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

  writeFileSync(join(ABOUT, 'index.html'), page, 'utf8');
}

async function main() {
  await initAboutPdfLogos();
  const mdFiles = walkMarkdownFiles(ABOUT);
  mkdirSync(HTML_ROOT, { recursive: true });

  for (const rel of mdFiles) {
    const mdPath = join(ABOUT, rel);
    const md = readFileSync(mdPath, 'utf8');
    const relNorm = rel.replace(/\\/g, '/');
    const enrich = getChartEnrichment(relNorm);
    const title = extractTitle(md, basename(rel));
    const category = categoryFromPath(relNorm);
    let bodyHtml = (enrich.before ?? '') + markdownToHtml(md) + (enrich.after ?? '');
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
    console.log(`[html] ${relNorm}`);
  }

  writeAboutIndexHtml(mdFiles);
  console.log('[html] about/index.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
