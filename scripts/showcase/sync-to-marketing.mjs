#!/usr/bin/env node
/**
 * Sync demos-showcase artifacts -> deploy/marketing/showcase and patch marketing shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'artifacts/saas-design/demos-showcase');
const DEST = path.join(ROOT, 'deploy/marketing/showcase');
const ASSET_V = '15';

function cpDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function listViewerHtml() {
  return fs.readdirSync(SRC).filter((n) => n.endsWith('-viewer.html') || n === 'video-viewer.html' || n === 'md-viewer.html' || n === 'ppt-viewer.html');
}

function patchCatalogJs(content) {
  let out = content.replace(/\?v=\d+/g, `?v=${ASSET_V}`);
  out = out.replace(/href:\s*'\.\//g, "href: '/showcase/");
  out = out.replace(/href:\s*"\.\//g, 'href: "/showcase/');
  return out;
}

function patchSiteJs(content) {
  return content
    .replace(/\?v=\d+/g, `?v=${ASSET_V}`)
    .replace(/index\.html\?v=\d+/g, `index.html?v=${ASSET_V}`);
}

function rewriteShowcaseIndex(raw) {
  let html = raw;
  html = html.replace(/<html lang="[^"]*">/, '<html lang="zh-CN">');
  html = html.replace(
    /<link rel="stylesheet" href="shared\/tokens\.css\?v=\d+" \/>\s*\n\s*<link rel="stylesheet" href="shared\/demos\.css\?v=\d+" \/>/,
    `<link rel="stylesheet" href="/shared/tokens.css?v=${ASSET_V}" />\n  <link rel="stylesheet" href="/shared/shell.css?v=${ASSET_V}" />\n  <link rel="stylesheet" href="/showcase/shared/demos.css?v=${ASSET_V}" />`,
  );
  html = html.replace(/href="assets\//g, 'href="/showcase/assets/');
  html = html.replace(/src="assets\//g, 'src="/showcase/assets/');
  html = html.replace(
    /<script src="shared\/catalog\.js\?v=\d+"[^>]*><\/script>/,
    `<script src="/showcase/shared/catalog.js?v=${ASSET_V}"></script>`,
  );
  html = html.replace(
    /<script src="shared\/site\.js\?v=\d+"[^>]*><\/script>/,
    `<script src="/showcase/shared/site.js?v=${ASSET_V}"></script>`,
  );

  const navBlock = `  <header class="site-top">
    <a class="site-brand" href="/">
      <img src="/showcase/assets/nova-logo-mark.png" alt="" width="28" height="28" />
      <span class="site-brand__name">Nova Ai-Studio <span>2.0</span></span>
    </a>
    <nav class="site-nav" aria-label="主导航">
      <a class="site-nav__link" href="/">主页</a>
      <a class="site-nav__link" href="/showcase/" aria-current="page">演示案例</a>
      <a class="site-nav__link" href="/docs/">文档</a>
      <a class="site-nav__link" href="/compare/">对比</a>
      <a class="site-nav__link" href="/faq/">常见问题</a>
      <a class="site-nav__link" href="/contact/">联系我们</a>
      <a class="btn btn--primary btn--sm" href="/login?from=site" data-login-cta>登录</a>
    </nav>
  </header>`;

  html = html.replace(/<header class="site-top">[\s\S]*?<\/header>/, navBlock);

  if (!html.includes('<base href="/showcase/"')) {
    html = html.replace(/<head>\s*\n/, `<head>\n  <base href="/showcase/" />\n`);
  }

  return html;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('[sync-to-marketing] missing source', SRC);
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });

  copyFile(path.join(SRC, 'index.html'), path.join(DEST, 'index.html'));
  for (const name of listViewerHtml()) {
    copyFile(path.join(SRC, name), path.join(DEST, name));
  }
  for (const name of ['fullcase-campaign.html', 'fullcase-flywheel.html', 'fullcase-geo.html']) {
    const p = path.join(SRC, name);
    if (fs.existsSync(p)) copyFile(p, path.join(DEST, name));
  }

  cpDir(path.join(SRC, 'shared'), path.join(DEST, 'shared'));
  cpDir(path.join(SRC, 'media'), path.join(DEST, 'media'));
  if (fs.existsSync(path.join(SRC, 'assets'))) {
    cpDir(path.join(SRC, 'assets'), path.join(DEST, 'assets'));
  }

  const catalogPath = path.join(DEST, 'shared/catalog.js');
  fs.writeFileSync(catalogPath, patchCatalogJs(fs.readFileSync(catalogPath, 'utf8')), 'utf8');
  const sitePath = path.join(DEST, 'shared/site.js');
  fs.writeFileSync(sitePath, patchSiteJs(fs.readFileSync(sitePath, 'utf8')), 'utf8');

  const indexPath = path.join(DEST, 'index.html');
  fs.writeFileSync(indexPath, rewriteShowcaseIndex(fs.readFileSync(indexPath, 'utf8')), 'utf8');

  console.log('[sync-to-marketing] synced to', DEST);
}

main();