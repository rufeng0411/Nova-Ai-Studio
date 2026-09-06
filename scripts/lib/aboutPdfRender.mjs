/**
 * Shared Playwright PDF rendering for /about documents.
 * Uses a fresh page per document to avoid blank PDFs from page reuse.
 */
import { mkdirSync, statSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const MIN_PDF_BYTES = 15_000;

async function commitPdf(tmpPath, pdfPath) {
  const size = statSync(tmpPath).size;
  if (size < MIN_PDF_BYTES) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    throw new Error(`PDF too small (${size} bytes), likely blank: ${pdfPath}`);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (existsSync(pdfPath)) {
        unlinkSync(pdfPath);
      }
      renameSync(tmpPath, pdfPath);
      return size;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
      if (code === 'EBUSY' && attempt === 4) {
        const fallback = `${pdfPath}.new`;
        if (existsSync(fallback)) {
          unlinkSync(fallback);
        }
        renameSync(tmpPath, fallback);
        console.warn(`[about-pdf] target locked, wrote ${fallback} (close viewer and rename)`);
        return statSync(fallback).size;
      }
      if (attempt === 4 || code !== 'EBUSY') {
        throw err;
      }
      await sleep(300 * (attempt + 1));
    }
  }
  throw new Error(`Failed to write PDF: ${pdfPath}`);
}

/**
 * @param {import('playwright').Browser} browser
 * @param {string} html
 * @param {string} pdfPath
 * @param {{ landscape?: boolean }} opts
 */
export async function renderHtmlToPdf(browser, html, pdfPath, opts = {}) {
  const { landscape = false } = opts;
  const page = await browser.newPage();
  try {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(600);
    try {
      await page.evaluate(async () => {
        if (window.mermaid) {
          const nodes = document.querySelectorAll('.mermaid:not([data-processed])');
          if (nodes.length) {
            await mermaid.run({ nodes });
          }
        }
      });
      await page.waitForTimeout(500);
    } catch {
      // Mermaid is optional for PDF; do not fail the whole render.
    }

    mkdirSync(dirname(pdfPath), { recursive: true });
    const tmpPath = `${pdfPath}.tmp`;
    await page.pdf({
      path: tmpPath,
      format: 'A4',
      landscape: Boolean(landscape),
      printBackground: true,
      margin: { top: '16mm', bottom: '14mm', left: '10mm', right: '10mm' },
      preferCSSPageSize: true,
    });

    return await commitPdf(tmpPath, pdfPath);
  } finally {
    await page.close();
  }
}

/**
 * @param {import('playwright').Browser} browser
 */
export async function renderExistingHtmlToPdf(browser, html, pdfPath, landscape = false) {
  const page = await browser.newPage();
  try {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1000);
    mkdirSync(dirname(pdfPath), { recursive: true });
    const tmpPath = `${pdfPath}.tmp`;
    await page.pdf({
      path: tmpPath,
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return await commitPdf(tmpPath, pdfPath);
  } finally {
    await page.close();
  }
}
