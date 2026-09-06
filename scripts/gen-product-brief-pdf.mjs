/**
 * 将 nova-product-features.html 渲染为 PDF
 * 运行: node scripts/gen-product-brief-pdf.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dir, '../about/sales/nova-product-features.html');
const pdfPath  = join(__dir, '../about/pdf/sales/nova-product-features.pdf');

const browser = await chromium.launch();
const page    = await browser.newPage();

await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });

// 等待字体加载
await page.waitForTimeout(1200);

await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
});

await browser.close();
console.log(`PDF 已生成：${pdfPath}`);
