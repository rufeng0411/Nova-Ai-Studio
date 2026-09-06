#!/usr/bin/env node
/**
 * Convert docs/skills-mcp-hot-recommendations-2026-06-17.md → styled HTML
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mdPath = path.join(root, 'docs/skills-mcp-hot-recommendations-2026-06-17.md');
const outPath = path.join(root, 'docs/skills-mcp-hot-recommendations-2026-06-17.html');

const md = fs.readFileSync(mdPath, 'utf8');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMd(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

function starsHtml(text) {
  const m = text.match(/(★+)(☆*)/);
  if (!m) return inlineMd(text);
  const filled = m[1].length;
  const empty = m[2].length;
  let html = '<span class="stars" aria-label="' + filled + '星">';
  for (let i = 0; i < filled; i++) html += '<span class="star on">★</span>';
  for (let i = 0; i < empty; i++) html += '<span class="star off">☆</span>';
  html += '</span>';
  return html;
}

function levelBadge(text) {
  const t = text.trim();
  if (!t || t === '—') return '<span class="badge muted">—</span>';
  const cls = t.startsWith('L1') ? 'l1' : t.startsWith('L2') ? 'l2' : t.startsWith('L3') ? 'l3' : 'muted';
  return `<span class="badge ${cls}">${escapeHtml(t)}</span>`;
}

function cellHtml(col, raw) {
  const text = raw.trim();
  if (col === '选') {
    const checked = text === '[x]';
    const id = 'chk-' + Math.random().toString(36).slice(2, 9);
    return `<label class="check-cell"><input type="checkbox" class="row-check" data-id="${id}"${checked ? ' checked' : ''}><span class="check-box"></span></label>`;
  }
  if (col === '星级' || col === '推荐星级') return starsHtml(text);
  if (col === 'L级') return levelBadge(text);
  if (col === '地址' && /^https?:\/\//.test(text)) {
    const short = text.length > 48 ? text.replace(/^https?:\/\//, '').slice(0, 42) + '…' : text.replace(/^https?:\/\//, '');
    return `<a class="link-out" href="${escapeHtml(text)}" target="_blank" rel="noopener" title="${escapeHtml(text)}">${escapeHtml(short)}</a>`;
  }
  if (col === 'mcp.json 片段' && text.startsWith('"')) {
    return `<code class="snippet">${escapeHtml(text)}</code>`;
  }
  if (col === '建议 Hub 落位' && text.includes('🆕')) {
    return inlineMd(text).replace('🆕', '<span class="pill-new">🆕</span>');
  }
  return inlineMd(text);
}

function parseTable(lines, startIdx) {
  const rows = [];
  let i = startIdx;
  if (i >= lines.length || !lines[i].startsWith('|')) return { rows, next: startIdx };
  const headers = lines[i].split('|').slice(1, -1).map((h) => h.trim());
  i += 2; // skip separator
  while (i < lines.length && lines[i].startsWith('|')) {
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    rows.push(cells);
    i++;
  }
  return { headers, rows, next: i };
}

function tableToHtml(headers, rows, tableId) {
  const stickyCols = new Set(['选', '名称']);
  let html = `<div class="table-wrap" role="region" aria-label="表格" tabindex="0">\n<table class="data-table" id="${tableId}">\n<thead><tr>`;
  for (const h of headers) {
    const cls = stickyCols.has(h) ? ' class="sticky"' : '';
    html += `<th${cls}>${escapeHtml(h)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    headers.forEach((h, idx) => {
      const cls = stickyCols.has(h) ? ' class="sticky"' : '';
      html += `<td${cls}>${cellHtml(h, row[idx] ?? '')}</td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function slugify(title) {
  return title
    .replace(/^#+\s*/, '')
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'section';
}

const lines = md.split(/\r?\n/);
const sections = [];
let i = 0;
let introBlocks = [];

while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith('# ')) {
    sections.push({ type: 'h1', text: line.slice(2).trim() });
    i++;
    continue;
  }
  if (line.startsWith('> ')) {
    const quotes = [];
    while (i < lines.length && lines[i].startsWith('> ')) {
      quotes.push(lines[i].slice(2));
      i++;
    }
    introBlocks.push({ type: 'quote', lines: quotes });
    continue;
  }
  if (line.startsWith('## ')) {
    const title = line.slice(3).trim();
    i++;
    if (i < lines.length && lines[i].startsWith('|')) {
      const { headers, rows, next } = parseTable(lines, i);
      sections.push({ type: 'section', title, headers, rows, id: slugify(title) });
      i = next;
      continue;
    }
    const body = [];
    while (i < lines.length && !lines[i].startsWith('## ') && !lines[i].startsWith('# ') && lines[i].trim() !== '---') {
      if (lines[i].startsWith('|')) {
        const { headers, rows, next } = parseTable(lines, i);
        body.push({ type: 'table', headers, rows });
        i = next;
        continue;
      }
      if (lines[i].trim()) body.push({ type: 'p', text: lines[i] });
      i++;
    }
    sections.push({ type: 'section', title, body, id: slugify(title) });
    continue;
  }
  if (line.trim() === '---') {
    i++;
    continue;
  }
  if (line.startsWith('*') && line.endsWith('*')) {
    sections.push({ type: 'footer', text: line.replace(/^\*|\*$/g, '') });
    i++;
    continue;
  }
  i++;
}

const toc = sections.filter((s) => s.type === 'section').map((s) => ({ title: s.title, id: s.id }));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skills / MCP 全球热榜推荐表（2026-06-17）</title>
<style>
:root {
  --bg: #eef0f3;
  --surface: #ffffff;
  --surface-2: #f7f8fa;
  --border: #dde1e8;
  --text: #1c2128;
  --text-muted: #5c6573;
  --accent: #3d6b8a;
  --accent-soft: #e8f0f5;
  --star: #c9a227;
  --l1: #2d6a4f;
  --l1-bg: #e8f5ef;
  --l2: #3d6b8a;
  --l2-bg: #e8f0f5;
  --l3: #7c5c8a;
  --l3-bg: #f3ecf5;
  --radius: 0.625rem;
  --shadow: 0 1px 3px rgba(28,33,40,.06), 0 8px 24px rgba(28,33,40,.04);
  --font: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --mono: "Cascadia Code", "SF Mono", Consolas, monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}
.layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100vh;
}
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 1.25rem 1rem;
  background: var(--surface);
  border-right: 1px solid var(--border);
}
.sidebar h2 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  margin: 0 0 .75rem;
  font-weight: 600;
}
.sidebar nav a {
  display: block;
  padding: .4rem .6rem;
  margin-bottom: 2px;
  border-radius: calc(var(--radius) - 2px);
  color: var(--text);
  text-decoration: none;
  font-size: 0.875rem;
  line-height: 1.35;
}
.sidebar nav a:hover { background: var(--surface-2); color: var(--accent); }
.sidebar .meta-link {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
}
.sidebar .meta-link a { color: var(--accent); }
.main { padding: 1.5rem 1.75rem 3rem; min-width: 0; }
.hero {
  background: linear-gradient(135deg, #2a3544 0%, #3d5266 100%);
  color: #f0f3f6;
  border-radius: var(--radius);
  padding: 1.75rem 2rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow);
}
.hero h1 {
  margin: 0 0 .5rem;
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -.02em;
}
.hero .subtitle { opacity: .85; font-size: 0.9rem; margin: 0; }
.intro-cards {
  display: grid;
  gap: .75rem;
  margin-bottom: 1.5rem;
}
.intro-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  font-size: 0.9rem;
  box-shadow: var(--shadow);
}
.intro-card strong { color: var(--accent); }
.intro-card a { color: var(--accent); }
.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.section-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.section-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--text);
}
.section-header .count {
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--surface);
  padding: .2rem .6rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.section-body { padding: 0; }
.section-body .prose {
  padding: 1rem 1.25rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.section-body .prose a { color: var(--accent); }
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.data-table th {
  text-align: left;
  padding: .65rem .75rem;
  background: #eef1f5;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 2;
}
.data-table td {
  padding: .6rem .75rem;
  border-bottom: 1px solid #eef0f3;
  vertical-align: top;
  max-width: 220px;
}
.data-table tbody tr:hover { background: #fafbfc; }
.data-table tbody tr:has(.row-check:checked) { background: var(--accent-soft); }
.data-table .sticky {
  position: sticky;
  left: 0;
  z-index: 1;
  background: inherit;
  box-shadow: 2px 0 4px rgba(0,0,0,.04);
}
.data-table th.sticky { z-index: 3; background: #eef1f5; }
.data-table td.sticky:nth-child(2) { left: 52px; }
.data-table th.sticky:nth-child(2) { left: 52px; }
.check-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-width: 36px;
}
.row-check { position: absolute; opacity: 0; width: 0; height: 0; }
.check-box {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  transition: all .15s;
}
.row-check:checked + .check-box {
  background: var(--accent);
  border-color: var(--accent);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2' d='M1 5l3 3 7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 10px;
}
.stars { white-space: nowrap; }
.star.on { color: var(--star); }
.star.off { color: #d0d4da; }
.badge {
  display: inline-block;
  padding: .15rem .45rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.badge.l1 { background: var(--l1-bg); color: var(--l1); }
.badge.l2 { background: var(--l2-bg); color: var(--l2); }
.badge.l3 { background: var(--l3-bg); color: var(--l3); }
.badge.muted { background: var(--surface-2); color: var(--text-muted); }
.pill-new { font-size: 0.85em; }
code, .snippet {
  font-family: var(--mono);
  font-size: 0.78rem;
  background: #f0f2f5;
  padding: .1rem .35rem;
  border-radius: 3px;
  word-break: break-all;
}
.snippet { display: block; max-width: 200px; }
.link-out {
  color: var(--accent);
  text-decoration: none;
  word-break: break-all;
}
.link-out:hover { text-decoration: underline; }
.simple-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.simple-table th, .simple-table td {
  padding: .6rem 1rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.simple-table th { background: var(--surface-2); color: var(--text-muted); font-size: 0.8rem; }
.footer-note {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 2rem;
  padding: 1rem;
}
.toolbar {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.toolbar button {
  font: inherit;
  font-size: 0.8rem;
  padding: .4rem .75rem;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.toolbar button:hover { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<div class="layout">
<aside class="sidebar">
  <h2>目录</h2>
  <nav>
${toc.map((t) => `    <a href="#${t.id}">${escapeHtml(t.title)}</a>`).join('\n')}
  </nav>
  <div class="meta-link">
    <a href="./skills-system-inventory-2026-06-17.md">系统基线 inventory</a><br>
    <a href="./skills-mcp-selected-batch-2026-06-17.md">接入批次表</a><br>
    <a href="./skills-mcp-hot-recommendations-2026-06-17.md">Markdown 源文件</a>
  </div>
</aside>
<main class="main">
<section class="hero">
  <h1>Skills / MCP 全球热榜推荐表</h1>
  <p class="subtitle">2026-06-17 · 877 catalog · 413 Hub 可见 · 权威双源门禁</p>
</section>
<div class="toolbar">
  <button type="button" id="btn-export">导出已勾选项</button>
  <button type="button" id="btn-clear">清除全部勾选</button>
</div>
<div class="intro-cards">
${introBlocks
  .map(
    (b) =>
      `  <div class="intro-card">${b.lines.map((l) => inlineMd(l)).join('<br>')}</div>`,
  )
  .join('\n')}
</div>
${sections
  .filter((s) => s.type === 'section')
  .map((s, idx) => {
    const tableId = `table-${idx}`;
    let body = '';
    if (s.headers && s.rows) {
      body = tableToHtml(s.headers, s.rows, tableId);
    } else if (s.body) {
      body = s.body
        .map((b) => {
          if (b.type === 'table') return tableToHtml(b.headers, b.rows, tableId + '-sub');
          if (b.type === 'p') return `<p class="prose">${inlineMd(b.text)}</p>`;
          return '';
        })
        .join('\n');
    }
    const count = s.rows?.length ?? s.body?.find((b) => b.type === 'table')?.rows?.length ?? '';
    return `<section class="section" id="${s.id}">
  <div class="section-header">
    <h2>${escapeHtml(s.title)}</h2>
    ${count ? `<span class="count">${count} 项</span>` : ''}
  </div>
  <div class="section-body">${body}</div>
</section>`;
  })
  .join('\n')}
${sections
  .filter((s) => s.type === 'footer')
  .map((s) => `<p class="footer-note">${escapeHtml(s.text)}</p>`)
  .join('\n')}
</main>
</div>
<script>
(function () {
  const KEY = 'skills-mcp-rec-2026-06-17';
  const checks = document.querySelectorAll('.row-check');
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    checks.forEach(function (el, i) {
      const k = 'r' + i;
      if (saved[k]) { el.checked = true; }
      el.addEventListener('change', function () {
        saved[k] = el.checked;
        localStorage.setItem(KEY, JSON.stringify(saved));
      });
    });
  } catch (e) { /* ignore */ }

  document.getElementById('btn-clear').addEventListener('click', function () {
    checks.forEach(function (el) { el.checked = false; });
    localStorage.removeItem(KEY);
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    const picked = [];
    checks.forEach(function (el) {
      if (!el.checked) return;
      const row = el.closest('tr');
      const nameCell = row && row.cells[1];
      if (nameCell) picked.push(nameCell.textContent.trim());
    });
    const text = picked.length ? picked.join('\\n') : '(无勾选项)';
    navigator.clipboard.writeText(text).then(function () {
      alert('已复制 ' + picked.length + ' 项到剪贴板');
    }).catch(function () { prompt('已勾选项：', text); });
  });
})();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath);
console.log('Sections:', sections.filter((s) => s.type === 'section').length);
