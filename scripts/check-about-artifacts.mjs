#!/usr/bin/env node
/**
 * Deep validation for about/_pdf-html/*.html and about/pdf/*.pdf
 * Run: npm run brand:about-artifacts-check
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_PDF_BYTES } from './lib/aboutPdfRender.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const ABOUT = join(REPO, 'about');
const HTML_ROOT = join(ABOUT, '_pdf-html');
const PDF_ROOT = join(ABOUT, 'pdf');

const MIN_HTML_TEXT = 120;

function walk(dir, filter, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, filter, base, acc);
    } else if (filter(name)) {
      acc.push(relative(base, full).replace(/\\/g, '/'));
    }
  }
  return acc;
}

function walkMarkdownFiles(dir, base = dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'pdf' || name === '_pdf-html') continue;
      results.push(...walkMarkdownFiles(full, base));
    } else if (name.endsWith('.md')) {
      results.push(relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

function extractBodyText(html) {
  const m = html.match(/<article class="doc-body">([\s\S]*?)<\/article>/);
  if (!m) return { text: '', hasBody: false };
  const text = m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, hasBody: true };
}

function main() {
  const failures = [];
  const mdFiles = walkMarkdownFiles(ABOUT);
  const extraHtml = existsSync(join(ABOUT, 'index.html')) ? ['../index.html'] : [];

  for (const rel of mdFiles) {
    const htmlRel = rel.replace(/\.md$/, '.html');
    const pdfRel = rel.replace(/\.md$/, '.pdf');
    const htmlPath = join(HTML_ROOT, htmlRel);
    const pdfPath = join(PDF_ROOT, pdfRel);

    if (!existsSync(htmlPath)) {
      failures.push({ kind: 'missing-html', rel, path: htmlRel });
      continue;
    }
    const html = readFileSync(htmlPath, 'utf8');
    const { text, hasBody } = extractBodyText(html);
    if (!hasBody) {
      failures.push({ kind: 'no-doc-body', rel, path: htmlRel });
    } else if (text.length < MIN_HTML_TEXT) {
      failures.push({ kind: 'thin-html', rel, path: htmlRel, detail: `${text.length} chars` });
    }
    if (!html.includes('<title>')) {
      failures.push({ kind: 'no-title', rel, path: htmlRel });
    }

    if (!existsSync(pdfPath)) {
      failures.push({ kind: 'missing-pdf', rel, path: pdfRel });
      continue;
    }
    const size = statSync(pdfPath).size;
    if (size < MIN_PDF_BYTES) {
      const alt = `${pdfPath}.new`;
      if (existsSync(alt) && statSync(alt).size >= MIN_PDF_BYTES) {
        failures.push({
          kind: 'thin-pdf-pending',
          rel,
          path: pdfRel,
          detail: `${size} bytes (valid ${alt} exists, close viewer and run: node scripts/promote-about-pdf-new.mjs)`,
        });
        continue;
      }
      failures.push({ kind: 'thin-pdf', rel, path: pdfRel, detail: `${size} bytes` });
    }
  }

  const salesPdf = join(PDF_ROOT, 'sales/nova-product-features.pdf');
  if (!existsSync(salesPdf)) {
    failures.push({ kind: 'missing-pdf', rel: 'sales/nova-product-features.html', path: 'sales/nova-product-features.pdf' });
  } else if (statSync(salesPdf).size < MIN_PDF_BYTES) {
    failures.push({
      kind: 'thin-pdf',
      rel: 'sales/nova-product-features.html',
      path: 'sales/nova-product-features.pdf',
      detail: `${statSync(salesPdf).size} bytes`,
    });
  }

  const htmlCount = walk(HTML_ROOT, (n) => n.endsWith('.html')).length;
  const pdfCount = walk(PDF_ROOT, (n) => n.endsWith('.pdf')).length;

  if (failures.length) {
    console.error(`[about-artifacts] FAIL: ${failures.length} issue(s)`);
    for (const f of failures) {
      console.error(`  [${f.kind}] ${f.rel} → ${f.path}${f.detail ? ` (${f.detail})` : ''}`);
    }
    process.exit(1);
  }

  console.log(`[about-artifacts] OK: ${mdFiles.length} md ↔ ${htmlCount} html ↔ ${pdfCount} pdf`);
  console.log(`[about-artifacts] All HTML bodies ≥${MIN_HTML_TEXT} chars, all PDFs ≥${MIN_PDF_BYTES} bytes`);
}

main();
