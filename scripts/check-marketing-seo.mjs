#!/usr/bin/env node
/**
 * PD-SAAS-FORK: marketing SEO/GEO gate — robots/sitemap/llms/JSON-LD/title·description
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(import.meta.url), '../..');
const ROOT = join(REPO, 'deploy', 'marketing');

const REQUIRED_FILES = [
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'index.html',
  'docs/index.html',
  'contact/index.html',
  'geo/index.html',
  'faq/index.html',
  'compare/index.html',
  'claims/index.html',
  'shared/analytics.js',
  'shared/content.css',
  'assets/og-default.png',
  'geo-monitor-queries.json',
];

const FAQ_QUESTIONS = [
  'Nova Ai-Studio 是什么？',
  'Nova Ai-Studio 与 Amazon Nova / Nova Act 是同一产品吗？',
  '什么是 Agent Harness？',
  '什么是 Goal-Loop？',
  '如何节省 Token？',
  '是否支持私有化部署？',
  'Nova 是否只是聊天机器人？',
  '成果如何验收？',
  '有多少能力可用？',
  '如何试用或咨询？',
];

let failed = 0;

function fail(msg) {
  console.error(`[marketing-seo] ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`[marketing-seo] ok ${msg}`);
}

if (!existsSync(ROOT)) {
  fail('missing deploy/marketing');
  process.exit(1);
}

for (const rel of REQUIRED_FILES) {
  if (!existsSync(join(ROOT, rel))) fail(`missing ${rel}`);
  else ok(rel);
}

const robots = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
if (!/Sitemap:/i.test(robots)) fail('robots.txt missing Sitemap');
else ok('robots Sitemap');
for (const path of ['/faq/', '/compare/', '/claims/']) {
  if (!robots.includes(`Allow: ${path}`)) fail(`robots missing Allow ${path}`);
  else ok(`robots Allow ${path}`);
}
if (/Disallow:\s*\/\s*$/m.test(robots) && !/Allow:\s*\//.test(robots)) {
  fail('robots appears to disallow all');
}

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
for (const loc of [
  'novapage.online/',
  'novapage.online/docs/',
  'novapage.online/contact/',
  'novapage.online/geo/',
  'novapage.online/faq/',
  'novapage.online/compare/',
  'novapage.online/claims/',
]) {
  if (!sitemap.includes(loc)) fail(`sitemap missing ${loc}`);
  else ok(`sitemap ${loc}`);
}

const llms = readFileSync(join(ROOT, 'llms.txt'), 'utf8');
if (!/Agent Harness/i.test(llms) || !/400\+/.test(llms)) fail('llms.txt missing key claims');
else ok('llms claims');
if (!/Amazon Nova/i.test(llms)) fail('llms.txt missing Amazon Nova disambiguation');
else ok('llms disambiguation');
for (const path of ['/faq/', '/claims/']) {
  if (!llms.includes(path)) fail(`llms.txt missing ${path}`);
  else ok(`llms ${path}`);
}
if (!llms.includes('/compare/') && !llms.includes('/faq/#q-compare')) {
  fail('llms.txt missing compare (/compare/ or /faq/#q-compare)');
} else ok('llms compare');

const pages = [
  ['index.html', '企业级'],
  ['contact/index.html', '联系我们'],
  ['geo/index.html', '机器可读'],
  ['docs/index.html', '白皮书'],
  ['faq/index.html', '常见问题'],
  ['claims/index.html', '方法论'],
];
for (const [rel, mustContain] of pages) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${rel} empty title`);
  else ok(`${rel} title`);
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html)) {
    fail(`${rel} empty description`);
  } else ok(`${rel} description`);
  if (!/rel=["']canonical["']/i.test(html)) fail(`${rel} missing canonical`);
  else ok(`${rel} canonical`);
  if (!/og:image/i.test(html) || !/og-default\.png/.test(html)) fail(`${rel} missing og:image`);
  else ok(`${rel} og:image`);
  if (!/twitter:card/i.test(html)) fail(`${rel} missing twitter:card`);
  else ok(`${rel} twitter:card`);
  if (html.includes('\uFFFD') || !html.includes(mustContain)) {
    fail(`${rel} encoding broken (missing "${mustContain}" or replacement chars)`);
  } else ok(`${rel} utf8`);
  if (/©\s*Nova Ai Studio\b/.test(html)) fail(`${rel} footer still uses "Nova Ai Studio" (need Nova Ai-Studio)`);
}

// /compare/ is a thin redirect into FAQ#q-compare (content lives on FAQ)
{
  const compareShell = readFileSync(join(ROOT, 'compare/index.html'), 'utf8');
  if (!/<title>[^<]+<\/title>/i.test(compareShell)) fail('compare/index.html empty title');
  else ok('compare/index.html title');
  if (!/rel=["']canonical["']/i.test(compareShell) || !/faq\/#q-compare/.test(compareShell)) {
    fail('compare/index.html missing canonical → faq/#q-compare');
  } else ok('compare/index.html canonical');
  if (!/location\.replace\(['"]\/faq\/#q-compare['"]\)/.test(compareShell)
    && !/url=\/faq\/#q-compare/.test(compareShell)) {
    fail('compare/index.html missing redirect to FAQ#q-compare');
  } else ok('compare/index.html redirect');
  if (compareShell.includes('\uFFFD')) fail('compare/index.html encoding broken');
  else ok('compare/index.html utf8');
}

const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (!/application\/ld\+json/i.test(home) || !/SoftwareApplication/i.test(home)) {
  fail('index.html missing SoftwareApplication JSON-LD');
} else ok('index JSON-LD');
if (!/#software/.test(home)) fail('index.html missing #software @id');
else ok('index #software');
if (!/alternateName/.test(home)) fail('index.html missing alternateName');
else ok('index alternateName');
if (!/disambiguatingDescription/.test(home)) fail('index.html missing disambiguatingDescription');
else ok('index disambiguatingDescription');
if (!/novapage\.online/.test(home) || !/企业级 AI Agent/.test(home)) {
  fail('index.html missing brand+category definition cues');
} else ok('index definition cues');
// claims / platform-compare stay GEO-visible (body, llms.txt, sitemap, /geo/) —
// not required in footer chrome (footer hides 平台对比 / 方法论 by product choice).
if (!/href=["']\/claims\/["']/.test(home) && !llms.includes('/claims/')) {
  fail('missing /claims/ GEO surface (home body or llms.txt)');
} else ok('claims GEO surface');
if (!/href=["']\/faq\/["']/.test(home)) {
  fail('index.html nav missing /faq/');
} else ok('index nav faq');
if (
  !/href=["']\/faq\/#q-compare["']/.test(home)
  && !/href=["']\/compare\/["']/.test(home)
  && !llms.includes('/faq/#q-compare')
  && !llms.includes('/compare/')
) {
  fail('missing platform-compare GEO surface (home, llms, or /compare/)');
} else ok('compare GEO surface');

const geo = readFileSync(join(ROOT, 'geo/index.html'), 'utf8');
if (!/FAQPage/i.test(geo)) fail('geo missing FAQPage JSON-LD');
else ok('geo FAQPage');
if (!/machine-readable|data-audience=["']ai-crawler["']/i.test(geo)) {
  fail('geo missing machine-readable / ai-crawler block');
} else ok('geo machine-readable');
if (!/#software/.test(geo)) fail('geo missing #software about');
else ok('geo #software');
if (!/href=["']\/faq\/["']/.test(geo)) fail('geo stub missing /faq/ link');
else ok('geo faq link');

const faq = readFileSync(join(ROOT, 'faq/index.html'), 'utf8');
if (!/FAQPage/i.test(faq)) fail('faq missing FAQPage JSON-LD');
else ok('faq FAQPage');
if (!/BreadcrumbList/i.test(faq)) fail('faq missing BreadcrumbList');
else ok('faq BreadcrumbList');

for (const q of FAQ_QUESTIONS) {
  if (!faq.includes(q)) fail(`faq HTML missing question: ${q}`);
  if (!geo.includes(q)) fail(`geo missing question (sync): ${q}`);
}
ok('faq/geo question sync (10)');

if (!/id=["']q-compare["']/.test(faq)) fail('faq missing #q-compare compare block');
else ok('faq #q-compare');
if (!/Dify/.test(faq) || !/FastGPT/.test(faq) || !/Coze/.test(faq)) {
  fail('faq compare table missing competitor columns');
} else ok('faq compare competitors');
if (!/compare-table/.test(faq)) fail('faq missing compare-table');
else ok('faq compare-table');

const claims = readFileSync(join(ROOT, 'claims/index.html'), 'utf8');
if (!/场景依赖/.test(claims) || !/70%/.test(claims)) fail('claims missing methodology cues');
else ok('claims methodology');

const docs = readFileSync(join(ROOT, 'docs/index.html'), 'utf8');
if (!/TechArticle|Article/i.test(docs) || !/application\/ld\+json/i.test(docs)) {
  fail('docs missing Article/TechArticle JSON-LD');
} else ok('docs JSON-LD');
if (!/BreadcrumbList/i.test(docs)) fail('docs missing BreadcrumbList');
else ok('docs BreadcrumbList');

if (/site-nav__link[^>]*>\s*面向\s*AI/i.test(home)) {
  fail('index.html still exposes human nav link 面向 AI (should be crawler-only via /geo/)');
} else ok('index no human 面向 AI nav');

if (failed) {
  console.error(`[marketing-seo] FAIL (${failed})`);
  process.exit(1);
}
console.log('[marketing-seo] PASS');
