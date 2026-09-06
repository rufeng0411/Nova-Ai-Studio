#!/usr/bin/env node
/**
 * Strict EN marketing copy gate — language / locale / docs parity / catalog.
 * Exit 1 on FAIL. Writes artifacts/showcase-design-qa/en-copy-audit-YYYYMMDD.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mkt = path.join(root, 'deploy/marketing');
const CJK = /[\u4e00-\u9fff]/;
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const reportDir = path.join(root, 'artifacts/showcase-design-qa');
const reportPath = path.join(reportDir, `en-copy-audit-${today}.md`);

let fail = 0;
const lines = [];
const warns = [];

function ok(msg) {
  lines.push(`- OK ${msg}`);
  console.log('OK', msg);
}
function bad(msg) {
  fail += 1;
  lines.push(`- FAIL ${msg}`);
  console.error('FAIL', msg);
}
function warn(msg) {
  warns.push(msg);
  lines.push(`- WARN ${msg}`);
  console.warn('WARN', msg);
}

function stripNoise(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/hreflang="[^"]*"/gi, '')
    .replace(/aria-label="中文"/g, '')
    .replace(/>中文<\/a>/g, '>')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function walkHtml(dir, base = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.join(base, name).replace(/\\/g, '/');
    if (fs.statSync(abs).isDirectory()) out.push(...walkHtml(abs, rel));
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

// 1) CJK in EN HTML
const enHtmlDir = path.join(mkt, 'en');
for (const rel of walkHtml(enHtmlDir)) {
  const abs = path.join(enHtmlDir, rel);
  const raw = fs.readFileSync(abs, 'utf8');
  const text = stripNoise(raw);
  const hits = text.match(CJK);
  if (hits) {
    const sample = text.replace(/\s+/g, ' ').match(/[\u4e00-\u9fff]{1,20}/)?.[0] || hits[0];
    bad(`CJK in en/${rel}: …${sample}…`);
  } else ok(`no CJK en/${rel}`);
}

// 2) half-translation patterns
const sticky = [/Token savingsmethodology/i, /您的Company/, /MethodologyMethodology/];
for (const rel of walkHtml(enHtmlDir)) {
  const raw = fs.readFileSync(path.join(enHtmlDir, rel), 'utf8');
  for (const re of sticky) {
    if (re.test(raw)) bad(`half-translation in en/${rel}: ${re}`);
  }
}

// 3) locale links — page nav must stay under /en/; allow ZH lang-switch `/`, shared static roots
for (const rel of walkHtml(enHtmlDir)) {
  const raw = fs.readFileSync(path.join(enHtmlDir, rel), 'utf8');
  const hrefs = [...raw.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const h of hrefs) {
    if (
      h.startsWith('/en/')
      || h === '/en'
      || h === '/' // ZH homepage via language switcher
      || h.startsWith('/login')
      || h.startsWith('/shared/')
      || h.startsWith('/assets/')
      || h.startsWith('/showcase/shared')
      || h.startsWith('/showcase/assets')
      || h.startsWith('/showcase/media')
      || h.startsWith('/llms')
      || h.startsWith('/api/')
      || h.startsWith('/pages/')
    ) {
      continue;
    }
    if (
      h.startsWith('/docs')
      || h.startsWith('/faq')
      || h.startsWith('/compare')
      || h.startsWith('/contact')
      || h.startsWith('/claims')
      || h.startsWith('/showcase')
      || h.startsWith('/about')
      || h.startsWith('/copyright')
      || h.startsWith('/geo')
    ) {
      bad(`en/${rel} bare ZH path href="${h}" (expect /en/…)`);
    }
  }
}
ok('locale link scan done');

// 4) catalog
const catCode = fs.readFileSync(path.join(mkt, 'showcase/shared/catalog.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(catCode, sandbox);
const catalog = sandbox.window.NOVA_SHOWCASE_CATALOG;
let items = 0;
let catBad = 0;
if (catalog?.brandNote_en && CJK.test(catalog.brandNote_en)) {
  bad('catalog brandNote_en has CJK');
  catBad += 1;
}
for (const sec of catalog?.sections || []) {
  if (sec.title_en && CJK.test(sec.title_en)) {
    bad(`section ${sec.id} title_en CJK`);
    catBad += 1;
  }
  for (const it of sec.items || []) {
    items += 1;
    if (!it.name_en || CJK.test(it.name_en)) {
      bad(`item ${it.id} name_en CJK/missing`);
      catBad += 1;
    }
    if (!it.annotation_en || CJK.test(it.annotation_en)) {
      bad(`item ${it.id} annotation_en CJK/missing`);
      catBad += 1;
    }
    if (it.prompt_en && CJK.test(it.prompt_en)) warn(`item ${it.id} prompt_en still has CJK`);
  }
}
// Empty catalog (placeholder UI) is allowed; non-empty must stay EN-clean.
if (items === 0) ok('catalog items=0 (empty placeholder sections)');
else if (catBad === 0) ok(`catalog ${items} items EN clean`);
else bad(`catalog ${items} items with EN issues`);

// 5) docs structure + parity
const zhDocs = fs.readFileSync(path.join(mkt, 'docs/index.html'), 'utf8');
const enDocs = fs.readFileSync(path.join(mkt, 'en/docs/index.html'), 'utf8');
// hero--openai removed by product choice (docs jumps straight into TOC + body)
for (const k of ['sidebar', 'id="s1"', 'id="s12"', 'pin-nav-slot', 'data-pin-nav']) {
  if (!enDocs.includes(k)) bad(`en/docs missing ${k}`);
  else ok(`en/docs has ${k}`);
}
const ratio = enDocs.length / zhDocs.length;
if (ratio < 0.5) bad(`en/docs byte ratio ${ratio.toFixed(3)} < 0.50`);
else ok(`en/docs byte ratio ${ratio.toFixed(3)}`);
const zhTbl = (zhDocs.match(/<table/gi) || []).length;
const enTbl = (enDocs.match(/<table/gi) || []).length;
const tblRatio = zhTbl ? enTbl / zhTbl : 1;
if (tblRatio < 0.7) bad(`en/docs table ratio ${enTbl}/${zhTbl}=${tblRatio.toFixed(2)} < 0.70`);
else ok(`en/docs tables ${enTbl}/${zhTbl}`);

// 6) FAQ count
const zhFaq = fs.readFileSync(path.join(mkt, 'faq/index.html'), 'utf8');
const enFaq = fs.readFileSync(path.join(mkt, 'en/faq/index.html'), 'utf8');
const zhItems = (zhFaq.match(/faq-item/g) || []).length;
const enItems = (enFaq.match(/faq-item/g) || []).length;
const zhH3 = (zhFaq.match(/<h3>/g) || []).length;
const enH3 = (enFaq.match(/<h3>/g) || []).length;
if (zhItems !== enItems) bad(`faq-item ZH ${zhItems} !== EN ${enItems}`);
else ok(`faq-item count ${zhItems}`);
if (zhH3 !== enH3) bad(`faq h3 ZH ${zhH3} !== EN ${enH3}`);
else ok(`faq h3 count ${zhH3}`);
if (!enFaq.includes('id="q-compare"') || !zhFaq.includes('id="q-compare"')) {
  bad('faq missing #q-compare platform comparison block');
} else ok('faq has #q-compare');

// 7) meta lang
const enHome = fs.readFileSync(path.join(mkt, 'en/index.html'), 'utf8');
if (!/lang="en"/.test(enHome)) bad('en home missing lang=en');
else ok('en home lang=en');

// 8) contact js / i18n soft scan
for (const rel of ['shared/i18n.js', 'shared/site.js', 'contact/contact.js']) {
  const abs = path.join(mkt, rel);
  if (!fs.existsSync(abs)) continue;
  const t = fs.readFileSync(abs, 'utf8');
  // only warn — shared JS is bilingual by design
  if (CJK.test(t) && rel.includes('contact')) warn(`${rel} contains CJK (verify EN branch)`);
}

fs.mkdirSync(reportDir, { recursive: true });
const md = `# EN marketing copy audit ${today}

## Verdict: ${fail ? 'FAIL' : 'PASS'}

fails=${fail} warns=${warns.length}

${lines.join('\n')}

${warns.length ? `\n## Warnings\n${warns.map((w) => `- ${w}`).join('\n')}\n` : ''}
`;
fs.writeFileSync(reportPath, md, 'utf8');
console.log('report', reportPath);
console.log(fail ? 'en_copy_gate=0' : 'en_copy_gate=1');
process.exit(fail ? 1 : 0);
