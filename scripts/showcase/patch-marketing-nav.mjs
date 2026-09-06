#!/usr/bin/env node
/**
 * Patch marketing HTML nav to: 主页 · 演示案例 · 文档 · 对比 · FAQ · 联系 · [lang] · 登录
 *
 * Presentation (owned by shell.css — do not put display rules in HTML):
 * - PC / tablet (>720px): full TEXT labels; icons always hidden
 * - Phone (≤720px): short TEXT only — 演示 / 文档 / 联系 (+ 登录);
 *   home/compare/faq go to footer; lang shows inactive locale only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/marketing');

const NAV_RE = /<nav class="site-nav"[^>]*>[\s\S]*?<\/nav>/;

function navHtml(opts) {
  const { current, lang = 'zh', withLang = true } = opts;
  /** @param {{ href: string, label: string, short?: string, id: string, mobile?: boolean }} o */
  const link = (o) => {
    const cur = current === o.id ? ' aria-current="page"' : '';
    const mobile = o.mobile ? ' data-nav-mobile="1"' : '';
    const label = `<span class="site-nav__label">${o.label}</span>`;
    const short = o.short
      ? `<span class="site-nav__short" aria-hidden="true">${o.short}</span>`
      : '';
    return `        <a class="site-nav__link" href="${o.href}" data-nav="${o.id}"${mobile}${cur} aria-label="${o.label}">${label}${short}</a>`;
  };
  const home = lang === 'en' ? '/en/' : '/';
  const showcase = lang === 'en' ? '/en/showcase/' : '/showcase/';
  const docs = lang === 'en' ? '/en/docs/' : '/docs/';
  const compare = lang === 'en' ? '/en/compare/' : '/compare/';
  const faq = lang === 'en' ? '/en/faq/' : '/faq/';
  const contact = lang === 'en' ? '/en/contact/' : '/contact/';
  const labels =
    lang === 'en'
      ? {
          home: 'Home',
          showcase: 'Showcase',
          showcaseShort: 'Demo',
          docs: 'Docs',
          docsShort: 'Docs',
          compare: 'Compare',
          faq: 'FAQ',
          contact: 'Contact',
          contactShort: 'Contact',
          login: 'Log in',
        }
      : {
          home: '主页',
          showcase: '演示案例',
          showcaseShort: '演示',
          docs: '文档',
          docsShort: '文档',
          compare: '对比',
          faq: '常见问题',
          contact: '联系我们',
          contactShort: '联系',
          login: '登录',
        };

  const langSwitch =
    withLang &&
    `        <span class="site-lang" data-i18n-lang>
          <a class="site-lang__link${lang === 'zh' ? ' is-active' : ''}" href="/" data-lang="zh"${lang === 'zh' ? ' aria-current="true"' : ''} aria-label="中文">中文</a>
          <span class="site-lang__sep" aria-hidden="true">/</span>
          <a class="site-lang__link${lang === 'en' ? ' is-active' : ''}" href="/en/" data-lang="en"${lang === 'en' ? ' aria-current="true"' : ''} aria-label="English">EN</a>
        </span>`;

  return `<nav class="site-nav" aria-label="${lang === 'en' ? 'Primary' : '主导航'}">
${link({ href: home, label: labels.home, id: 'home' })}
${link({ href: showcase, label: labels.showcase, short: labels.showcaseShort, id: 'showcase', mobile: true })}
${link({ href: docs, label: labels.docs, short: labels.docsShort, id: 'docs', mobile: true })}
${link({ href: compare, label: labels.compare, id: 'compare' })}
${link({ href: faq, label: labels.faq, id: 'faq' })}
${link({ href: contact, label: labels.contact, short: labels.contactShort, id: 'contact', mobile: true })}
${langSwitch || ''}
        <a class="btn btn--primary btn--sm site-nav__login" href="/login?from=site" data-login-cta aria-label="${labels.login}"><span class="site-nav__label">${labels.login}</span></a>
      </nav>`;
}

function detectCurrent(fileRel) {
  if (fileRel.includes('showcase')) return 'showcase';
  if (fileRel.startsWith('docs') || fileRel.includes('/docs/')) return 'docs';
  if (fileRel.includes('compare')) return 'compare';
  if (fileRel.includes('faq')) return 'faq';
  if (fileRel.includes('contact')) return 'contact';
  if (fileRel.includes('claims')) return 'home';
  if (fileRel === 'index.html' || (fileRel.endsWith('/index.html') && !fileRel.includes('/'))) return 'home';
  return '';
}

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.join(base, name).replace(/\\/g, '/');
    if (fs.statSync(abs).isDirectory()) {
      if (name === 'media' || name === 'shared' || name === 'assets' || name === 'source') continue;
      out.push(...walk(abs, rel));
    } else if (name.endsWith('.html')) {
      out.push(rel);
    }
  }
  return out;
}

let n = 0;
for (const rel of walk(root)) {
  if (rel.startsWith('showcase/') && !rel.endsWith('index.html')) continue;
  const abs = path.join(root, rel);
  let html = fs.readFileSync(abs, 'utf8');
  if (!NAV_RE.test(html)) continue;
  const lang = rel.startsWith('en/') ? 'en' : 'zh';
  let current = detectCurrent(rel.replace(/^en\//, ''));
  if (rel === 'index.html' || rel === 'en/index.html') current = 'home';
  const next = navHtml({ current, lang, withLang: true });
  const updated = html.replace(NAV_RE, next);
  if (updated !== html) {
    fs.writeFileSync(abs, updated, 'utf8');
    n += 1;
    console.log('patched', rel);
  }
}

const adapt = path.join(root, 'scripts/adapt-docs.mjs');
if (fs.existsSync(adapt)) {
  let src = fs.readFileSync(adapt, 'utf8');
  const newShell = `const shellTop = \`<header class="site-top">
  <a class="site-brand" href="/">
    <img src="../assets/nova-logo-mark.png" alt="" width="28" height="28" />
    <span class="site-brand__name">Nova Ai-Studio <span>2.0</span></span>
  </a>
${navHtml({ current: 'docs', lang: 'zh', withLang: true }).replace(/^/gm, '  ').trimStart()}
</header>\`;`;
  src = src.replace(/const shellTop = `[\s\S]*?`;/, newShell);
  fs.writeFileSync(adapt, src, 'utf8');
  console.log('patched adapt-docs.mjs');
}

console.log('[patch-marketing-nav] files:', n);
