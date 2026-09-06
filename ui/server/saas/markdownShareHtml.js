// PD-SAAS-FORK: Markdown 公开分享 — SSR 独立 HTML（Logo 头尾 / SEO·GEO / 导出壳）
import path from 'node:path';
import { renderMarketingMarkdown, sanitizeMarketingHtml } from './marketing/marketingPages.js';
import {
  countMarkdownWords,
  extractMarkdownSummary,
  extractMarkdownTitle,
  inferMarkdownLang,
} from './share/markdownShareWordCount.js';

const MAX_SHARE_MD_BYTES = 2 * 1024 * 1024;

/**
 * Rewrite relative assets to public share asset URLs (no JWT).
 * @param {string} html
 * @param {{ shareId: string; mdRelativePath: string; origin: string }} ctx
 */
export function rewriteMarkdownShareAssetUrls(html, ctx) {
  const mdDir = path.posix.dirname(String(ctx.mdRelativePath || '').replace(/\\/g, '/'));
  const shareId = encodeURIComponent(String(ctx.shareId || ''));

  return String(html || '').replace(
    /(\b(?:src|href)=["'])([^"']+)(["'])/giu,
    (match, prefix, target, suffix) => {
      const trimmed = String(target || '').trim();
      if (!trimmed) return match;
      if (/^(?:https?:|data:|mailto:|tel:|#|\/api\/|\/s\/)/iu.test(trimmed)) return match;
      const joined = path.posix.normalize(path.posix.join(mdDir === '.' ? '' : mdDir, trimmed));
      // Asset URLs are relative to the markdown file directory (sandbox resolves from md dir).
      const fromMdDir = path.posix.relative(mdDir === '.' ? '' : mdDir, joined);
      const encoded = String(fromMdDir || joined)
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const assetUrl = `${ctx.origin}/s/${shareId}/asset/${encoded}`;
      return `${prefix}${assetUrl}${suffix}`;
    },
  );
}

/**
 * @param {string} md
 */
export function renderMarkdownBodyHtml(md) {
  return renderMarketingMarkdown(md);
}

/**
 * Wrap wide media so share page never deforms layout.
 * Tables → horizontal scroll; images get lazy + responsive class.
 * @param {string} html
 */
export function enhanceShareBodyHtml(html) {
  let out = String(html || '');
  out = out.replace(/<table\b[\s\S]*?<\/table>/giu, (tableHtml) => {
    if (/class=["'][^"']*\btable-scroll\b/i.test(tableHtml)) return tableHtml;
    return `<div class="table-scroll" role="region" aria-label="table" tabindex="0">${tableHtml}</div>`;
  });
  out = out.replace(/<img\b([^>]*?)>/giu, (_m, attrs) => {
    let a = String(attrs || '');
    if (!/\bclass=/i.test(a)) {
      a += ' class="share-media"';
    } else if (!/\bshare-media\b/.test(a)) {
      a = a.replace(/\bclass=(["'])([^"']*)\1/i, (_cm, q, cls) => `class=${q}${cls} share-media${q}`);
    }
    if (!/\bloading=/i.test(a)) a += ' loading="lazy"';
    if (!/\bdecoding=/i.test(a)) a += ' decoding="async"';
    return `<img${a}>`;
  });
  out = out.replace(/<(video|iframe)\b([^>]*?)>/giu, (_m, tag, attrs) => {
    let a = String(attrs || '');
    if (!/\bclass=/i.test(a)) a += ' class="share-media"';
    return `<${tag}${a}>`;
  });
  return out;
}

/**
 * @param {{
 *   title: string;
 *   bodyHtml: string;
 *   canonicalUrl: string;
 *   description?: string;
 *   summary?: string;
 *   wordCount?: number;
 *   fileName?: string;
 *   shareId?: string;
 *   seoIndexable?: boolean;
 *   lang?: string;
 *   datePublished?: string;
 *   dateModified?: string;
 *   ogImageUrl?: string;
 *   origin?: string;
 * }} input
 */
export function wrapMarkdownShareHtmlDocument(input) {
  const langRaw = input.lang || 'zh-CN';
  const lang = escapeHtml(langRaw);
  const isZh = String(langRaw).toLowerCase().startsWith('zh');
  const docTitle = String(input.title || 'Document').trim() || 'Document';
  const brandSuffix = 'Nova Ai Studio';
  const pageTitleRaw = /nova\s*ai\s*studio/i.test(docTitle)
    ? docTitle
    : `${docTitle} · ${brandSuffix}`;
  const title = escapeHtml(pageTitleRaw);
  const description = escapeHtml((input.description || docTitle).slice(0, 160));
  const summary = escapeHtml((input.summary || input.description || docTitle).slice(0, 300));
  const canonicalUrl = escapeHtml(input.canonicalUrl || '');
  const bodyHtml = enhanceShareBodyHtml(sanitizeMarketingHtml(input.bodyHtml || ''));
  const wordCount = Number(input.wordCount || 0);
  const fileName = escapeHtml(input.fileName || '');
  const shareId = escapeHtml(input.shareId || '');
  const seoIndexable = Boolean(input.seoIndexable);
  const robots = seoIndexable
    ? 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'
    : 'noindex,nofollow';
  const origin = String(input.origin || '').replace(/\/$/, '');
  const ogImageDefault = origin ? `${origin}/logo-256.png` : '/logo-256.png';
  const ogImage = escapeHtml(input.ogImageUrl || ogImageDefault);
  const datePublishedRaw = input.datePublished || new Date().toISOString();
  const dateModifiedRaw = input.dateModified || datePublishedRaw;
  const datePublished = escapeHtml(datePublishedRaw);
  const dateModified = escapeHtml(dateModifiedRaw);
  const ogLocale = isZh ? 'zh_CN' : 'en_US';
  const wordLabel = isZh ? `约 ${wordCount} 字` : `~${wordCount} words`;
  const liveHint = isZh ? '内容随原文更新' : 'Content updates with the source file';
  const pdfLabel = isZh ? '保存 PDF' : 'Save PDF';
  const docxLabel = isZh ? '保存 Word' : 'Save Word';
  const exportingLabel = isZh ? '生成中…' : 'Generating…';
  const abstractLabel = isZh ? '摘要' : 'Summary';
  const publisherLabel = isZh ? '由 Nova Ai Studio 生成的公开阅读页' : 'Public reading page generated by Nova Ai Studio';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin || 'https://www.novapage.online'}/#organization`,
        name: 'Nova Ai Studio',
        alternateName: ['Nova Ai-Studio', 'NovaPage'],
        url: origin || 'https://www.novapage.online/',
        logo: origin ? `${origin}/logo-256.png` : 'https://www.novapage.online/logo-256.png',
      },
      {
        '@type': 'WebSite',
        '@id': `${origin || 'https://www.novapage.online'}/#website`,
        name: 'Nova Ai Studio',
        url: origin || 'https://www.novapage.online/',
        publisher: { '@id': `${origin || 'https://www.novapage.online'}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': input.canonicalUrl ? `${input.canonicalUrl}#webpage` : undefined,
        url: input.canonicalUrl || undefined,
        name: pageTitleRaw,
        description: input.description || docTitle,
        inLanguage: langRaw,
        isPartOf: { '@id': `${origin || 'https://www.novapage.online'}/#website` },
        primaryImageOfPage: input.ogImageUrl || ogImageDefault,
        datePublished: datePublishedRaw,
        dateModified: dateModifiedRaw,
      },
      {
        '@type': 'Article',
        '@id': input.canonicalUrl ? `${input.canonicalUrl}#article` : undefined,
        headline: docTitle,
        name: docTitle,
        description: input.description || docTitle,
        abstract: input.summary || input.description || docTitle,
        inLanguage: langRaw,
        isAccessibleForFree: true,
        author: { '@id': `${origin || 'https://www.novapage.online'}/#organization` },
        publisher: { '@id': `${origin || 'https://www.novapage.online'}/#organization` },
        datePublished: datePublishedRaw,
        dateModified: dateModifiedRaw,
        wordCount,
        mainEntityOfPage: input.canonicalUrl || undefined,
        image: [input.ogImageUrl || ogImageDefault],
      },
    ],
  };
  const docTitleEsc = escapeHtml(docTitle);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <meta name="theme-color" content="#f4f5f7" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Nova 分享" />
  <meta name="format-detection" content="telephone=no,address=no,email=no" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="summary" content="${summary}" />
  <meta name="abstract" content="${summary}" />
  <meta name="author" content="Nova Ai Studio" />
  <meta name="publisher" content="Nova Ai Studio" />
  <meta name="application-name" content="Nova Ai Studio" />
  <meta name="generator" content="Nova Ai Studio" />
  <meta name="robots" content="${robots}" />
  <meta name="googlebot" content="${robots}" />
  <meta name="bingbot" content="${robots}" />
  <meta name="ai-content" content="document" />
  <meta name="citation_title" content="${escapeHtml(docTitle)}" />
  <meta name="citation_language" content="${lang}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Nova Ai Studio" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:alt" content="${escapeHtml(docTitle)}" />
  <meta property="article:published_time" content="${datePublished}" />
  <meta property="article:modified_time" content="${dateModified}" />
  <meta property="article:author" content="Nova Ai Studio" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}" />` : ''}
  ${canonicalUrl ? `<meta property="og:url" content="${canonicalUrl}" />` : ''}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/logo-128.png" type="image/png" sizes="128x128" />
  <link rel="shortcut icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png?v=nova2" sizes="192x192" />
  <link rel="apple-touch-icon" href="/logo-256.png" sizes="256x256" />
  <link rel="manifest" href="/share.webmanifest" />
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f5f7;
      --paper: #ffffff;
      --ink: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --brand: #4b5563;
      --content-max: 48rem;
      --pad-x: 1rem;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
    }
    *, *::before, *::after { box-sizing: border-box; }
    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      overflow-x: clip;
      max-width: 100%;
    }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.65;
      color: var(--ink);
      background: linear-gradient(180deg, #eef1f4 0%, var(--bg) 40%, #f8fafc 100%);
      min-height: 100vh;
      min-height: 100dvh;
      overflow-x: clip;
      max-width: 100%;
      padding-left: var(--safe-left);
      padding-right: var(--safe-right);
      padding-bottom: var(--safe-bottom);
    }
    .topbar {
      position: -webkit-sticky;
      position: sticky;
      top: 0;
      z-index: 20;
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      background: rgba(244, 245, 247, 0.94);
      border-bottom: 1px solid var(--line);
      padding-top: var(--safe-top);
    }
    .topbar-inner, .hint, .wrap {
      width: 100%;
      max-width: var(--content-max);
      margin-left: auto;
      margin-right: auto;
      padding-left: var(--pad-x);
      padding-right: var(--pad-x);
    }
    .topbar-inner {
      padding-top: 0.7rem;
      padding-bottom: 0.7rem;
      display: -webkit-flex;
      display: flex;
      -webkit-align-items: center;
      align-items: center;
      gap: 0.75rem;
      -webkit-flex-wrap: wrap;
      flex-wrap: wrap;
    }
    .brand {
      display: -webkit-inline-flex;
      display: inline-flex;
      -webkit-align-items: center;
      align-items: center;
      gap: 0.45rem;
      color: var(--brand);
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 600;
      -webkit-flex: 0 0 auto;
      flex: 0 0 auto;
    }
    .brand img { width: 26px; height: 26px; border-radius: 6px; display: block; }
    .title {
      -webkit-flex: 1 1 12rem;
      flex: 1 1 12rem;
      min-width: 0;
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: var(--muted);
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .actions {
      display: -webkit-inline-flex;
      display: inline-flex;
      gap: 0.4rem;
      -webkit-flex: 0 0 auto;
      flex: 0 0 auto;
    }
    .actions button {
      border: 1px solid var(--line);
      background: #fff;
      color: #374151;
      border-radius: 0.5rem;
      padding: 0.35rem 0.65rem;
      font-size: 0.78rem;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
    }
    .actions button:disabled { opacity: 0.55; cursor: wait; }
    .hint {
      margin-top: 0.55rem;
      margin-bottom: 0;
      color: var(--muted);
      font-size: 0.72rem;
    }
    .doc-abstract {
      margin-top: 0.65rem;
      margin-bottom: 0;
      padding: 0.75rem 0.9rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      background: rgba(255,255,255,0.72);
      color: #4b5563;
      font-size: 0.84rem;
      line-height: 1.55;
    }
    .doc-abstract h2 {
      margin: 0 0 0.35rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .doc-abstract p { margin: 0; }
    .doc-abstract .meta-line {
      margin-top: 0.45rem;
      font-size: 0.72rem;
      color: #9ca3af;
    }
    .wrap { padding-top: 1rem; padding-bottom: 2.5rem; }
    .card {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 0.625rem;
      padding: 1.75rem 1.5rem;
      overflow-x: auto;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
    }
    .prose { max-width: 100%; overflow-wrap: anywhere; word-wrap: break-word; }
    h1,h2,h3,h4 { line-height: 1.3; margin-top: 1.6em; margin-bottom: 0.6em; color: #111827; overflow-wrap: anywhere; }
    h1:first-child,h2:first-child,h3:first-child { margin-top: 0; }
    p,ul,ol,blockquote,pre { margin: 0.85em 0; max-width: 100%; }
    a {
      color: #374151;
      text-decoration: underline;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    img, video, svg, canvas {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      display: block;
    }
    .share-media {
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain;
    }
    iframe.share-media {
      width: 100%;
      max-width: 100%;
      aspect-ratio: 16 / 9;
      height: auto;
      min-height: 12rem;
      border: 0;
    }
    pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    pre {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: #f3f4f6;
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
      max-width: 100%;
    }
    code { background: #f3f4f6; padding: 0.12rem 0.35rem; border-radius: 0.25rem; word-break: break-word; }
    pre code { background: transparent; padding: 0; word-break: normal; }
    blockquote {
      margin: 1em 0; padding-left: 1rem; border-left: 4px solid #d1d5db; color: #4b5563;
    }
    .table-scroll {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      margin: 0.85em 0;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      background: #fff;
    }
    .table-scroll:focus { outline: 2px solid rgba(75, 85, 99, 0.35); outline-offset: 2px; }
    .table-scroll table {
      border-collapse: collapse;
      width: max-content;
      min-width: 100%;
      max-width: none;
      table-layout: auto;
      margin: 0;
    }
    .table-scroll th,
    .table-scroll td {
      border: 1px solid var(--line);
      padding: 0.5rem 0.75rem;
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      hyphens: auto;
      min-width: 4.5rem;
      max-width: 22rem;
    }
    .table-scroll th { background: #f9fafb; position: sticky; top: 0; z-index: 1; }
    .table-scroll a { word-break: break-all; }
    .footer {
      margin-top: 1.25rem;
      text-align: center;
      font-size: 0.75rem;
      color: #9ca3af;
    }
    .footer a { color: #6b7280; text-decoration: none; }
    /* Portrait default reading column */
    @media (orientation: portrait) {
      :root { --content-max: 48rem; --pad-x: 1rem; }
    }
    /* Landscape: wider column, still capped */
    @media (orientation: landscape) {
      :root { --content-max: min(72rem, 92vw); --pad-x: 1.25rem; }
      .table-scroll th, .table-scroll td { max-width: 28rem; }
    }
    @media (max-width: 640px) {
      :root { --pad-x: 0.75rem; }
      .topbar-inner { padding-top: 0.65rem; padding-bottom: 0.65rem; }
      .wrap { padding-top: 0.75rem; padding-bottom: 2rem; }
      .card { padding: 1.15rem 0.9rem; }
      .actions { width: 100%; }
      .actions button { -webkit-flex: 1; flex: 1; }
      .table-scroll th, .table-scroll td { max-width: 14rem; font-size: 0.86rem; }
    }
    @media (min-width: 1100px) and (orientation: landscape) {
      :root { --content-max: min(80rem, 90vw); }
    }
    @media print {
      .topbar, .hint, .actions, .footer { display: none !important; }
      body { background: #fff; }
      .card { border: none; padding: 0; overflow: visible; }
      .table-scroll { overflow: visible; border: none; }
      .table-scroll table { width: 100%; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/" rel="noopener noreferrer">
        <img src="/logo-128.png" alt="Nova" width="26" height="26" />
        <span>Nova Ai Studio</span>
      </a>
      <div class="title" title="${docTitleEsc}">${docTitleEsc}</div>
      <div class="meta">${escapeHtml(wordLabel)}</div>
      <div class="actions">
        <button type="button" data-export="pdf">${pdfLabel}</button>
        <button type="button" data-export="docx">${docxLabel}</button>
      </div>
    </div>
  </header>
  <p class="hint">${escapeHtml(liveHint)}</p>
  <section class="doc-abstract hint" id="share-llm-summary" aria-label="${escapeHtml(abstractLabel)}">
    <h2>${escapeHtml(abstractLabel)}</h2>
    <p itemprop="abstract">${summary || description}</p>
    <p class="meta-line">${escapeHtml(publisherLabel)}${fileName ? ` · ${fileName}` : ''} · ${escapeHtml(wordLabel)}</p>
  </section>
  <div class="wrap">
    <article class="card prose" itemscope itemtype="https://schema.org/Article">
      <meta itemprop="headline" content="${docTitleEsc}" />
      <meta itemprop="name" content="${docTitleEsc}" />
      <meta itemprop="description" content="${description}" />
      <meta itemprop="inLanguage" content="${lang}" />
      <meta itemprop="datePublished" content="${datePublished}" />
      <meta itemprop="dateModified" content="${dateModified}" />
      <meta itemprop="author" content="Nova Ai Studio" />
      <meta itemprop="publisher" content="Nova Ai Studio" />
      <meta itemprop="isAccessibleForFree" content="true" />
      ${bodyHtml}
    </article>
    <p class="footer">由 <a href="/" rel="noopener noreferrer">Nova Ai Studio</a> 生成${fileName ? ` · ${fileName}` : ''}</p>
  </div>
  <script>
  (function () {
    // Layout harden: wrap bare tables; never let wide media stretch the page.
    try {
      var root = document.querySelector('.prose');
      if (root) {
        Array.prototype.slice.call(root.querySelectorAll('table')).forEach(function (table) {
          if (table.parentElement && table.parentElement.classList.contains('table-scroll')) return;
          var wrap = document.createElement('div');
          wrap.className = 'table-scroll';
          wrap.setAttribute('role', 'region');
          wrap.setAttribute('aria-label', 'table');
          wrap.tabIndex = 0;
          table.parentNode.insertBefore(wrap, table);
          wrap.appendChild(table);
        });
        Array.prototype.slice.call(root.querySelectorAll('img,video')).forEach(function (el) {
          el.classList.add('share-media');
          el.style.maxWidth = '100%';
          el.style.height = 'auto';
        });
      }
      document.documentElement.classList.add(
        window.matchMedia('(orientation: landscape)').matches ? 'is-landscape' : 'is-portrait'
      );
    } catch (_e) {}

    var shareId = ${JSON.stringify(shareId)};
    var exportingLabel = ${JSON.stringify(exportingLabel)};
    if (!shareId) return;
    function setBusy(btn, busy) {
      if (!btn) return;
      btn.disabled = !!busy;
      if (busy) {
        btn.dataset.label = btn.textContent;
        btn.textContent = exportingLabel;
      } else if (btn.dataset.label) {
        btn.textContent = btn.dataset.label;
      }
    }
    async function runExport(format, btn) {
      setBusy(btn, true);
      try {
        var started = await fetch('/s/' + encodeURIComponent(shareId) + '/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: format })
        });
        var startBody = await started.json().catch(function () { return {}; });
        if (!started.ok) throw new Error(startBody.error || 'export failed');
        var jobId = startBody.jobId;
        for (var i = 0; i < 120; i++) {
          await new Promise(function (r) { setTimeout(r, 500); });
          var st = await fetch('/s/' + encodeURIComponent(shareId) + '/export/' + encodeURIComponent(jobId));
          var body = await st.json().catch(function () { return {}; });
          if (body.status === 'done') {
            window.location.href = '/s/' + encodeURIComponent(shareId) + '/export/' + encodeURIComponent(jobId) + '/file';
            return;
          }
          if (body.status === 'failed') throw new Error(body.error || 'export failed');
        }
        throw new Error('timeout');
      } catch (err) {
        alert((err && err.message) || 'export failed');
      } finally {
        setBusy(btn, false);
      }
    }
    document.querySelectorAll('[data-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        runExport(btn.getAttribute('data-export'), btn);
      });
    });
  })();
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export {
  MAX_SHARE_MD_BYTES,
  countMarkdownWords,
  extractMarkdownSummary,
  extractMarkdownTitle,
  inferMarkdownLang,
};

/**
 * @param {string} message
 * @param {{ status?: number; title?: string }} [opts]
 */
export function wrapShareErrorHtml(message, opts = {}) {
  const title = escapeHtml(opts.title || '无法打开分享页');
  const pageTitle = `${title} · Nova Ai Studio`;
  const body = escapeHtml(message || '请返回 Nova 重新分享');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#f4f5f7" />
  <title>${pageTitle}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  <link rel="shortcut icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png?v=nova2" />
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f4f5f7; color:#374151; font-family: system-ui, sans-serif; }
    .box { max-width:28rem; padding:1.5rem; text-align:center; }
    img { width:40px; height:40px; border-radius:8px; margin-bottom:0.75rem; }
    h1 { font-size:1.05rem; margin:0 0 .75rem; color:#111827; }
    p { margin:0; font-size:.92rem; line-height:1.6; color:#6b7280; }
    a { color:#4b5563; text-decoration:none; }
  </style>
</head>
<body><div class="box">
  <img src="/logo-128.png" alt="Nova" width="40" height="40" />
  <h1>${title}</h1>
  <p>${body}</p>
  <p style="margin-top:1rem"><a href="/">返回 Nova Ai Studio</a></p>
</div></body>
</html>`;
}
