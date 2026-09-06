// PD-SAAS-FORK: word/char count for share page header

/**
 * Strip fenced code blocks then count CJK chars + latin words.
 * @param {string} md
 */
export function countMarkdownWords(md) {
  const withoutFences = String(md || '').replace(/```[\s\S]*?```/g, ' ');
  const text = withoutFences.replace(/`[^`]*`/g, ' ').replace(/!\[[^\]]*]\([^)]*\)/g, ' ');
  let count = 0;
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/gu);
  if (cjk) count += cjk.length;
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/gu, ' ')
    .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  if (latin) count += latin.length;
  return count;
}

/**
 * @param {string} md
 */
export function inferMarkdownLang(md) {
  const sample = String(md || '').slice(0, 4000);
  const cjk = (sample.match(/[\u4e00-\u9fff]/gu) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  return cjk >= latin ? 'zh-CN' : 'en';
}

/**
 * Prefer first ATX/Setext H1 for document title (browser tab / SEO).
 * @param {string} md
 * @param {string} [fallback]
 */
export function extractMarkdownTitle(md, fallback = 'Document') {
  const text = String(md || '');
  const atx = text.match(/^\s*#\s+([^\n#][^\n]*)$/mu);
  if (atx?.[1]) return atx[1].trim();
  const setext = text.match(/^\s*([^\n]+)\n\s*=+\s*$/mu);
  if (setext?.[1]) return setext[1].trim();
  const fb = String(fallback || '').trim();
  return fb || 'Document';
}

/**
 * @param {string} md
 * @param {number} [maxLen]
 */
export function extractMarkdownSummary(md, maxLen = 220) {
  const title = extractMarkdownTitle(md, '');
  let plain = String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*#+\s+.+$/gmu, ' ')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title && plain.toLowerCase().startsWith(title.toLowerCase())) {
    plain = plain.slice(title.length).trim();
  }
  return plain.slice(0, maxLen);
}
