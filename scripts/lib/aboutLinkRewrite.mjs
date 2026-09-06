/**
 * Rewrite about/*.md internal links for static web (HTML) or PDF index.
 */
import { dirname, join, normalize } from 'node:path';

/** Folder links in README → default HTML entry (under about/). */
export const DIR_DEFAULT_HTML = {
  brand: 'brand/品牌手册.html',
  product: 'product/产品总览-one-pager.html',
  market: 'market/市场洞察与趋势.html',
  business: 'business/商业模式与套餐.html',
  sales: 'sales/销售指导手册.html',
  design: 'design/产品设计风格定位.html',
  trust: 'trust/安全与信任白皮书-简版.html',
  press: 'press/新闻稿样板-boilerplate.html',
  en: 'en/README.html',
};

function splitHref(href) {
  const hashIdx = href.indexOf('#');
  if (hashIdx === -1) return { path: href, hash: '' };
  return { path: href.slice(0, hashIdx), hash: href.slice(hashIdx) };
}

/** @param {string} fromDir relative dir of source file under about/ ("" for root) */
function resolveAboutPath(fromDir, hrefPath) {
  const base = fromDir ? fromDir.replace(/\\/g, '/') : '';
  if (hrefPath.startsWith('/') || /^[a-z]+:/i.test(hrefPath)) {
    return hrefPath;
  }
  const combined = base ? join(base, hrefPath) : hrefPath;
  return normalize(combined).replace(/\\/g, '/');
}

/** Relative path from `fromDir/file` to `toPath` (both under about/). */
function relativeHref(fromDir, toPath) {
  const fromParts = (fromDir ? fromDir.replace(/\\/g, '/') : '').split('/').filter(Boolean);
  const toParts = toPath.replace(/\\/g, '/').split('/').filter(Boolean);

  let shared = 0;
  while (shared < fromParts.length && shared < toParts.length && fromParts[shared] === toParts[shared]) {
    shared += 1;
  }
  const up = fromParts.length - shared;
  const down = toParts.slice(shared);
  const segments = [...Array(up).fill('..'), ...down];
  return segments.length ? segments.join('/') : '.';
}

/** Relative path from _pdf-html/{htmlDir} to about/{aboutPath}. */
function relativeToAboutRoot(htmlDir, aboutPath) {
  const depth = htmlDir ? htmlDir.split('/').filter(Boolean).length : 0;
  const ups = depth + 1;
  return `${'../'.repeat(ups)}${aboutPath.replace(/^\//, '')}`;
}

/**
 * @param {string} html HTML body with <a href="...">
 * @param {string} sourceMdRel e.g. "market/目标市场与细分.md"
 * @param {'html'|'md-root'} mode
 * @param {string|null} htmlOutputRel path under _pdf-html e.g. "market/目标市场与细分.html"
 */
export function rewriteAboutLinks(html, sourceMdRel, mode = 'html', htmlOutputRel = null) {
  const outRel = (htmlOutputRel ?? sourceMdRel.replace(/\.md$/i, '.html')).replace(/\\/g, '/');
  const normDir = dirname(outRel);
  const normDirFixed = normDir === '.' ? '' : normDir;

  return html.replace(/href="([^"]+)"/g, (full, rawHref) => {
    const { path, hash } = splitHref(rawHref);
    if (!path || /^[a-z]+:/i.test(path) || path.startsWith('/')) {
      return full;
    }

    const clean = path.replace(/^\.\//, '');

    if (mode === 'html') {
      if (clean === 'index.html') {
        return `href="${relativeToAboutRoot(normDirFixed, 'index.html')}${hash}"`;
      }
      if (clean.startsWith('pdf/') || clean === 'pdf/') {
        const pdfTarget = clean.endsWith('/')
          ? 'pdf/README.md'
          : clean.replace(/\.html$/i, '.md');
        return `href="${relativeToAboutRoot(normDirFixed, pdfTarget)}${hash}"`;
      }
      if (clean.startsWith('_pdf-html/')) {
        const inner = clean.slice('_pdf-html/'.length).replace(/\.md$/i, '.html');
        const rel = relativeHref(normDirFixed, inner);
        return `href="${rel}${hash}"`;
      }
    }

    if (path.endsWith('/') && mode === 'html') {
      const dirPath = path.replace(/\/$/, '');
      const target = DIR_DEFAULT_HTML[dirPath] ?? (dirPath ? `${dirPath}/README.html` : 'README.html');
      const rel = relativeHref(normDirFixed, target);
      return `href="${rel}${hash}"`;
    }
    if (!path.endsWith('.md')) {
      return full;
    }

    const resolvedMd = resolveAboutPath(normDirFixed, path);
    if (mode === 'html') {
      const targetHtml = resolvedMd.replace(/\.md$/i, '.html');
      const rel = relativeHref(normDirFixed, targetHtml);
      return `href="${rel}${hash}"`;
    }
    return `href="${resolvedMd}${hash}"`;
  });
}

/**
 * @param {string} pdfAbs absolute path to pdf file
 * @param {string} pdfRoot absolute path to about/pdf
 */
export function pdfReadmeHref(pdfAbs, pdfRoot) {
  let rel = pdfAbs.slice(pdfRoot.length).replace(/\\/g, '/');
  if (rel.startsWith('/')) rel = rel.slice(1);
  return rel || '.';
}

/**
 * @param {string} mdRel path under about/ e.g. product/foo.md
 * @param {'html'|'pdf'|'md'} target
 */
export function indexHrefFromRoot(mdRel, target) {
  const base = mdRel.replace(/\.md$/i, '').replace(/\.html$/i, '');
  if (target === 'md') {
    return mdRel.replace(/\\/g, '/');
  }
  if (target === 'pdf') {
    return `pdf/${base}.pdf`;
  }
  return `_pdf-html/${base}.html`;
}

/** Add target="_blank" to navigational links in static about HTML pages. */
export function addBlankTargetsToLinks(html) {
  return html.replace(/<a\s+href="([^"#][^"]*)"(?![^>]*\btarget=)([^>]*)>/gi, (full, href, rest) => {
    if (!href || href.startsWith('javascript:')) return full;
    const attrs = rest.trim();
    return `<a href="${href}" target="_blank" rel="noopener noreferrer"${attrs ? ` ${attrs}` : ''}>`;
  });
}
