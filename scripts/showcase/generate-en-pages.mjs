#!/usr/bin/env node
/**
 * Generate deploy/marketing/en/* mirrors from zh pages + English copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/marketing');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function injectScripts(html) {
  if (html.includes('i18n.js')) return html;
  return html.replace(
    /(<script src="[^"]*site\.js[^"]*"><\/script>)/,
    '<script src="/shared/i18n.js?v=15"></script>\n  $1',
  );
}

function addHreflang(html, zhPath, enPath) {
  if (html.includes('hreflang=')) return html;
  const tags = `  <link rel="alternate" hreflang="zh-CN" href="https://www.novapage.online${zhPath}" />
  <link rel="alternate" hreflang="en" href="https://www.novapage.online${enPath}" />
  <link rel="alternate" hreflang="x-default" href="https://www.novapage.online${zhPath}" />
`;
  return html.replace('</head>', `${tags}</head>`);
}

function rewriteNavHrefs(html) {
  // Rewrite primary nav / brand only — never touch language-switcher hrefs
  // (blind href="/" → /en/ previously broke both lang links to /en/).
  return html.replace(
    /(<a\b[^>]*\b(?:class="[^"]*\b(?:site-nav__link|site-brand)\b[^"]*"|data-login-cta)[^>]*\bhref=")(\/[^"]*)(")/g,
    (full, pre, href, post) => {
      if (href.startsWith('/en') || href.startsWith('/login') || href.startsWith('http')) {
        return full;
      }
      if (href === '/') return `${pre}/en/${post}`;
      return `${pre}/en${href}${post}`;
    },
  );
}

function fixLangSwitcher(html, pageLocale) {
  // Normalize switcher markup; runtime i18n.js still sets peer hrefs + active.
  // IMPORTANT: do not use non-greedy [\s\S]*?<\/span> — it stops at site-lang__sep's </span>.
  const zhActive = pageLocale === 'zh';
  const block = `<span class="site-lang" data-i18n-lang>
          <a class="site-lang__link${zhActive ? ' is-active' : ''}" href="/" data-lang="zh"${zhActive ? ' aria-current="true"' : ''}>中文</a>
          <span class="site-lang__sep" aria-hidden="true">/</span>
          <a class="site-lang__link${!zhActive ? ' is-active' : ''}" href="/en/" data-lang="en"${!zhActive ? ' aria-current="true"' : ''}>EN</a>
        </span>`;
  let out = html.replace(
    /<span class="site-lang"[^>]*>\s*<a class="site-lang__link[\s\S]*?<\/a>\s*<span class="site-lang__sep"[^>]*>[\s\S]*?<\/span>\s*<a class="site-lang__link[\s\S]*?<\/a>\s*<\/span>/,
    block,
  );
  // Clean orphan fragments from older broken rewrites
  out = out.replace(/\s*<a class="site-lang__link"[^>]*>\s*EN\s*<\/a>\s*<\/span>/g, '');
  return out;
}

function zhToEnNav(html) {
  let out = html
    .replace(/lang="zh-CN"/g, 'lang="en"')
    .replace(/aria-label="主导航"/g, 'aria-label="Primary"')
    .replace(/>主页</g, '>Home<')
    .replace(/>演示案例</g, '>Showcase<')
    .replace(/>文档</g, '>Docs<')
    .replace(/>对比</g, '>Compare<')
    .replace(/>常见问题</g, '>FAQ<')
    .replace(/>联系我们</g, '>Contact<')
    .replace(/>登录</g, '>Log in<');
  out = rewriteNavHrefs(out);
  out = fixLangSwitcher(out, 'en');
  return out;
}

// —— Home EN ——
const homeZh = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let homeEn = injectScripts(zhToEnNav(homeZh));
homeEn = homeEn
  .replace(/<title>[^<]*<\/title>/, '<title>Nova Ai-Studio 2.0 · Enterprise Agent Platform</title>')
  .replace(
    /content="[^"]*对话驱动[^"]*"/,
    'content="Nova Ai-Studio 2.0 is an enterprise AI Agent platform: conversation-driven deliverables, Goal-Loop acceptance, SaaS or fully private deployment."',
  )
  .replace(/用对话，交付整个项目/g, 'Ship whole projects through conversation')
  .replace(
    /Nova Ai-Studio（novapage\.online）是企业级 AI Agent 平台：[\s\S]*?无关。/,
    'Nova Ai-Studio (novapage.online) is an enterprise AI Agent platform: understand goals, orchestrate tools, produce files, and verify with Goal-Loop — SaaS ready, or fully private. Not related to Amazon Nova / Nova Act.',
  )
  .replace(/登录 \/ 开始使用/g, 'Log in / Get started')
  .replace(/阅读产品白皮书/g, 'Read the product whitepaper')
  .replace(/>演示案例</g, '>Showcase<')
  .replace(/href="\/showcase\/">Showcase<\/a>/, 'href="/en/showcase/">Showcase</a>')
  .replace(/Token 节省/g, 'Token savings')
  .replace(/方法论/g, 'methodology');
homeEn = addHreflang(homeEn, '/', '/en/');
// fix brand home link
homeEn = homeEn.replace(/<a class="site-brand" href="\/en\/">/, '<a class="site-brand" href="/en/">');
ensureDir(path.join(root, 'en'));
fs.writeFileSync(path.join(root, 'en/index.html'), homeEn, 'utf8');

// —— Generic page copy helper ——
function mirrorPage(relZh, relEn, transform) {
  const src = path.join(root, relZh);
  if (!fs.existsSync(src)) {
    console.warn('skip missing', relZh);
    return;
  }
  let html = fs.readFileSync(src, 'utf8');
  html = injectScripts(zhToEnNav(html));
  html = transform(html);
  const zhPath = '/' + relZh.replace(/index\.html$/, '').replace(/\/?$/, '/').replace(/^\//, '');
  const enPath = '/' + relEn.replace(/index\.html$/, '').replace(/\/?$/, '/');
  html = addHreflang(html, zhPath.startsWith('/') ? zhPath : '/' + zhPath, enPath);
  ensureDir(path.dirname(path.join(root, relEn)));
  fs.writeFileSync(path.join(root, relEn), html, 'utf8');
  console.log('wrote', relEn);
}

mirrorPage('faq/index.html', 'en/faq/index.html', (h) =>
  h
    .replace(/<title>[^<]*<\/title>/, '<title>FAQ · Nova Ai-Studio</title>')
    .replace(/常见问题/g, 'FAQ')
    .replace(/产品常见问题/g, 'Product FAQ'),
);

mirrorPage('compare/index.html', 'en/compare/index.html', (h) =>
  h
    .replace(/<title>[^<]*<\/title>/, '<title>AI Agent Platform Comparison · Nova Ai-Studio</title>')
    .replace(/>对比</g, '>Compare<'),
);

mirrorPage('contact/index.html', 'en/contact/index.html', (h) =>
  h
    .replace(/<title>[^<]*<\/title>/, '<title>Contact · Nova Ai-Studio</title>')
    .replace(/联系我们/g, 'Contact us')
    .replace(/提交/g, 'Submit')
    .replace(/您的称呼/g, 'Your name')
    .replace(/公司/g, 'Company')
    .replace(/留言/g, 'Message'),
);

mirrorPage('claims/index.html', 'en/claims/index.html', (h) =>
  h
    .replace(/<title>[^<]*<\/title>/, '<title>Token methodology · Nova Ai-Studio</title>')
    .replace(/方法论/g, 'Methodology'),
);

// Showcase EN — share media/css/js with zh /showcase/ (no duplicate tree)
mirrorPage('showcase/index.html', 'en/showcase/index.html', (h) => {
  let out = h
    .replace(/<title>[^<]*<\/title>/, '<title>Showcase · Nova Studio N2</title>')
    .replace(/>演示案例</g, '>Showcase<')
    .replace(
      /均产出自 Nova Studio N2 · 真实任务成果，一站预览/g,
      'Produced with Nova Studio N2 · Real deliverables, one place to preview',
    )
    .replace(/均产出自 Nova Studio N2/g, 'Produced with Nova Studio N2')
    .replace(
      /这里不是效果图或空壳演示，而是用对话在 Nova Studio N2 里真实跑通的成果：官网与海报、短视频、长文与幻灯、调研与 GEO、品牌全案——点开即可预览，直观感受「说完即交付」的完整能力。/g,
      'Not mockups or empty shells — real work shipped through conversation in Nova Studio N2: sites &amp; posters, short video, longform &amp; decks, research &amp; GEO, full campaigns. Open any card to feel what “talk → deliver” looks like.',
    )
    .replace(
      /向下浏览分类，或点上方标签直达感兴趣的成果类型。/g,
      'Scroll to browse, or jump with the category pills above.',
    )
    // Only rewrite asset trees back to shared zh paths — never nav / base
    .replace(/(href|src)="\/en\/showcase\/(shared|assets|media)\//g, '$1="/showcase/$2/');
  out = out.replace(/<base\s+href="[^"]*"\s*\/>/, '<base href="/en/showcase/" />');
  out = out.replace(
    /(<a class="site-nav__link" href=")\/showcase\/(")/g,
    '$1/en/showcase/$2',
  );
  out = fixLangSwitcher(out, 'en');
  return out;
});

// Also inject i18n into zh pages
for (const rel of [
  'index.html',
  'faq/index.html',
  'compare/index.html',
  'contact/index.html',
  'claims/index.html',
  'docs/index.html',
  'showcase/index.html',
]) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  let html = fs.readFileSync(abs, 'utf8');
  const next = injectScripts(html);
  if (next !== html) {
    fs.writeFileSync(abs, addHreflang(next, '/' + rel.replace(/index\.html$/, '').replace(/\/?$/, '/') || '/', '/en/' + rel.replace(/index\.html$/, '').replace(/\/?$/, '/')), 'utf8');
    console.log('i18n inject', rel);
  }
}

console.log('[generate-en-pages] done');
