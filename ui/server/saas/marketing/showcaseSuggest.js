// PD-SAAS-FORK: Auto-pick showcase card fields from session artifact paths
import path from 'node:path';

/**
 * @param {string[]} files
 * @param {string} [sessionTitle]
 */
export function suggestShowcaseFromArtifacts(files, sessionTitle = '') {
  const list = (files ?? []).map((f) => String(f).replace(/\\/g, '/'));
  const base = (p) => path.posix.basename(p).toLowerCase();
  const isImg = (p) => /\.(png|jpe?g|webp|gif)$/i.test(p);
  const isHtml = (p) => /\.html?$/i.test(p);
  const isVideo = (p) => /\.mp4$/i.test(p);
  const isDeck = (p) => /\.(pptx|pdf)$/i.test(p);
  const isMd = (p) => /\.md$/i.test(p);
  const skip = (p) =>
    /\/(skills\/|node_modules\/|_capture\/|prepared\/)/i.test(p) ||
    /^(skill\.md|readme\.md|changelog\.md|data-sources\.md)$/i.test(base(p));

  const usable = list.filter((p) => !skip(p));
  const scoreHref = (p) => {
    const b = base(p);
    if (b === 'index.html' || b === 'report.html') return 100;
    if (/\.bento\.html$/i.test(b)) return 95;
    if (isHtml(p)) return 80;
    if (isVideo(p)) return 70;
    if (/\.pptx$/i.test(p)) return 65;
    if (/\.pdf$/i.test(p)) return 55;
    if (isMd(p) && !skip(p)) return 40;
    return 0;
  };
  const hrefCandidates = usable
    .filter((p) => isHtml(p) || isVideo(p) || isDeck(p) || isMd(p))
    .sort((a, b) => scoreHref(b) - scoreHref(a));
  const href = hrefCandidates[0] || usable[0] || '';

  const thumbCandidates = usable.filter(isImg).sort((a, b) => {
    const ba = base(a);
    const bb = base(b);
    const rank = (name) => {
      if (/^slide-0*1\./i.test(name) || name === 'cover.png' || name === 'thumb.png') return 100;
      if (/^slide-/i.test(name)) return 80;
      if (/preview|cover|hero|thumb/i.test(name)) return 70;
      return 10;
    };
    return rank(bb) - rank(ba);
  });
  const thumb = thumbCandidates[0] || (isImg(href) ? href : '');

  const title = String(sessionTitle || '').trim();
  const fromFile = href ? path.posix.basename(href).replace(/\.[^.]+$/, '') : '';
  const name = title || fromFile || '未命名案例';

  /** Prefer primary + thumb (+ a few siblings) for publish copy */
  const sourceArtifactPaths = [...new Set([href, thumb].filter(Boolean))];
  for (const f of usable) {
    if (sourceArtifactPaths.length >= 8) break;
    if (!sourceArtifactPaths.includes(f) && (isHtml(f) || isImg(f) || isVideo(f) || isDeck(f))) {
      sourceArtifactPaths.push(f);
    }
  }

  return {
    name_zh: name,
    name_en: name,
    href,
    thumb,
    sourceArtifactPaths,
  };
}
