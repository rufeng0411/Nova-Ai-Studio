/**
 * Nova-branded HTML shell for /about PDF documents.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '../..');

let logoDataUrl = null;
let coverLogoDataUrl = null;

export function getLogoDataUrl() {
  if (logoDataUrl) return logoDataUrl;
  const logoPath = join(REPO, 'ui/src/assets/nova-logo-mark.png');
  const buf = readFileSync(logoPath);
  logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  return logoDataUrl;
}

/** High-res horizontal mark for cover pages (preserves aspect ratio). */
export async function initAboutPdfLogos() {
  if (coverLogoDataUrl) return;
  const source = join(REPO, 'logo-3.png');
  const trimmed = await sharp(source).trim({ threshold: 18 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const height = 96;
  const width = Math.max(1, Math.round((meta.width / meta.height) * height));
  const buf = await sharp(trimmed)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  coverLogoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
}

function getCoverLogoDataUrl() {
  return coverLogoDataUrl ?? getLogoDataUrl();
}

export function buildHtmlDocument({
  title,
  bodyHtml,
  category = 'Nova Ai-Studio',
  cover = false,
  landscape = false,
}) {
  const logo = getLogoDataUrl();
  const coverLogo = getCoverLogoDataUrl();
  const coverBlock = cover
    ? `
<section class="cover-page">
  <img class="cover-logo" src="${coverLogo}" alt="Nova" />
  <h1 class="cover-title">${escapeHtml(title)}</h1>
  <p class="cover-sub">Nova Ai Studio 2.0 · 智能体创作平台</p>
  <p class="cover-tag">官方品牌与市场资料</p>
</section>
<div class="page-break"></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    ${BASE_CSS}
    ${landscape ? '@page { size: A4 landscape; }' : '@page { size: A4 portrait; }'}
  </style>
</head>
<body class="${landscape ? 'landscape' : 'portrait'}">
  <header class="print-header">
    <img src="${logo}" alt="" class="header-logo" />
    <div class="header-text">
      <span class="header-brand">Nova Ai-Studio</span>
      <span class="header-doc">${escapeHtml(category)}</span>
    </div>
  </header>
  <footer class="print-footer">
    <span>Nova Ai Studio 2.0 · AI 营销创意生产平台</span>
    <span class="footer-page"></span>
  </footer>
  <main class="doc-main">
    ${coverBlock}
    <article class="doc-body">
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </article>
  </main>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', fontFamily: 'Inter, Microsoft YaHei, sans-serif' });
    document.addEventListener('DOMContentLoaded', async () => {
      const nodes = document.querySelectorAll('.mermaid');
      if (nodes.length && window.mermaid) {
        await mermaid.run({ nodes });
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function injectBrandChrome(html) {
  if (html.includes('print-header')) return html;
  const logo = getLogoDataUrl();
  const chrome = `
<style>
  .print-header { position: fixed; top: 0; left: 0; right: 0; height: 14mm; padding: 2mm 12mm; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e8f0; background: #fff; z-index: 100; }
  .header-logo { height: 9mm; }
  .header-brand { font-weight: 700; font-size: 9pt; color: #2d3748; }
  .print-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 10mm; padding: 2mm 12mm; display: flex; justify-content: space-between; font-size: 7pt; color: #718096; border-top: 1px solid #e2e8f0; background: #fff; }
  body { padding-top: 16mm !important; padding-bottom: 12mm !important; }
</style>
<header class="print-header">
  <img class="header-logo" src="${logo}" alt="" />
  <span class="header-brand">Nova Ai-Studio · 产品特点对照</span>
</header>
<footer class="print-footer"><span>Nova Ai Studio 2.0</span><span>官方销售资料</span></footer>`;
  return html.replace(/<body([^>]*)>/i, `<body$1>${chrome}`);
}

const BASE_CSS = `
  :root {
    --nova-ink: #1a202c;
    --nova-primary: #2d3748;
    --nova-muted: #4a5568;
    --nova-border: #e2e8f0;
    --nova-bg: #f8fafc;
    --nova-accent: #edf2f7;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', 'Microsoft YaHei', 'PingFang SC', sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: var(--nova-ink);
    margin: 0;
    background: #fff;
  }
  .print-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 14mm;
    padding: 2mm 12mm;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--nova-border);
    background: #fff;
    z-index: 100;
  }
  .header-logo { height: 9mm; width: auto; }
  .header-text { display: flex; flex-direction: column; line-height: 1.2; }
  .header-brand { font-weight: 700; font-size: 9pt; color: var(--nova-primary); }
  .header-doc { font-size: 7.5pt; color: var(--nova-muted); }
  .print-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 10mm;
    padding: 2mm 12mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7pt;
    color: #718096;
    border-top: 1px solid var(--nova-border);
    background: #fff;
  }
  .doc-main {
    padding: 18mm 14mm 14mm 14mm;
  }
  .doc-title {
    font-size: 20pt;
    font-weight: 700;
    color: var(--nova-primary);
    margin: 0 0 6mm;
    padding-bottom: 3mm;
    border-bottom: 2px solid var(--nova-primary);
  }
  .cover-page + .page-break + .doc-body .doc-title { display: none; }
  .cover-page {
    min-height: 240mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: linear-gradient(180deg, #fff 0%, var(--nova-bg) 100%);
    margin: -18mm -14mm 0;
    padding: 20mm;
  }
  .cover-logo {
    display: block;
    height: 28mm;
    width: auto;
    max-width: 75%;
    object-fit: contain;
    object-position: center;
    margin: 0 auto 16px;
  }
  .cover-title { font-size: 26pt; color: var(--nova-primary); margin: 0 0 8px; border: none; }
  .cover-sub { font-size: 12pt; color: var(--nova-muted); margin: 0 0 24px; }
  .cover-tag { font-size: 9pt; color: #718096; letter-spacing: 0.08em; text-transform: uppercase; }
  .page-break { page-break-after: always; }
  h1 { font-size: 16pt; color: var(--nova-primary); margin: 5mm 0 3mm; }
  h2 { font-size: 13pt; color: var(--nova-primary); margin: 4mm 0 2mm; border-left: 3px solid var(--nova-primary); padding-left: 8px; }
  h3 { font-size: 11pt; margin: 3mm 0 2mm; }
  h4 { font-size: 10pt; margin: 2mm 0 1mm; }
  p { margin: 0 0 2.5mm; }
  blockquote {
    margin: 3mm 0;
    padding: 3mm 4mm;
    background: var(--nova-accent);
    border-left: 3px solid var(--nova-muted);
    font-size: 9.5pt;
    color: var(--nova-muted);
  }
  hr.section-rule { border: none; border-top: 1px solid var(--nova-border); margin: 4mm 0; }
  ul, ol { margin: 0 0 3mm; padding-left: 5mm; }
  li { margin-bottom: 1mm; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 3mm 0 4mm;
    font-size: 9pt;
  }
  th {
    background: var(--nova-primary);
    color: #fff;
    font-weight: 600;
    text-align: left;
    padding: 2.5mm 3mm;
  }
  td {
    border: 1px solid var(--nova-border);
    padding: 2mm 3mm;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: var(--nova-bg); }
  code {
    font-family: Consolas, monospace;
    font-size: 8.5pt;
    background: var(--nova-accent);
    padding: 0 3px;
    border-radius: 2px;
  }
  pre {
    background: #1a202c;
    color: #e2e8f0;
    padding: 3mm;
    border-radius: 4px;
    font-size: 8pt;
    overflow-x: auto;
  }
  a { color: var(--nova-primary); }
  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 5mm;
    padding: 4mm;
    background: var(--nova-accent);
    border-radius: 6px;
  }
  .stat { flex: 1; min-width: 80px; text-align: center; }
  .stat-val { display: block; font-size: 14pt; font-weight: 700; color: var(--nova-primary); }
  .stat-lbl { font-size: 7.5pt; color: var(--nova-muted); }
  .highlight-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 5mm;
  }
  .hcard {
    background: var(--nova-bg);
    border: 1px solid var(--nova-border);
    border-radius: 4px;
    padding: 8px;
    font-size: 8.5pt;
  }
  .hcard .num { display: block; font-size: 7pt; color: #718096; margin-bottom: 2px; }
  .color-palette { display: flex; gap: 6px; margin-bottom: 5mm; }
  .swatch {
    flex: 1; height: 36px; border-radius: 4px;
    display: flex; align-items: flex-end; padding: 4px;
  }
  .swatch span { font-size: 6.5pt; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .dual-track { display: flex; gap: 10px; margin-bottom: 5mm; }
  .track {
    flex: 1; padding: 10px; border-radius: 6px;
    background: var(--nova-bg); border: 1px solid var(--nova-border);
  }
  .track.saas { background: var(--nova-primary); color: #fff; }
  .track.saas h4 { color: #fff; }
  .pricing-tiers { display: flex; gap: 6px; margin-bottom: 5mm; }
  .tier {
    flex: 1; text-align: center; padding: 8px 4px;
    border: 1px solid var(--nova-border); border-radius: 4px; font-size: 8.5pt;
  }
  .tier.featured { background: var(--nova-primary); color: #fff; border-color: var(--nova-primary); }
  .tier.featured h4 { color: #fff; }
  .tier h4 { margin: 0 0 4px; font-size: 9pt; }
  .tier p { margin: 0; font-size: 7.5pt; }
  .mermaid { margin: 4mm 0; text-align: center; }
  .risk-high { background: #fed7d7; color: #c53030; padding: 2px 6px; border-radius: 3px; font-size: 8pt; margin-right: 6px; }
  .risk-mid { background: #feebc8; color: #c05621; padding: 2px 6px; border-radius: 3px; font-size: 8pt; margin-right: 6px; }
  .landscape table { font-size: 8pt; }
  .landscape th, .landscape td { padding: 1.5mm 2mm; }
`;
