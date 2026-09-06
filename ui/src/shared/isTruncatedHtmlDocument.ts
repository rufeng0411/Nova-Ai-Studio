/** Heuristics for assistant HTML pasted mid-generation (token limit / stream cut). */
export function isTruncatedHtmlDocument(code: string): boolean {
  const t = String(code || '').trim();
  if (t.length < 40) return false;
  if (!/<html[\s>]/i.test(t) && !t.toLowerCase().startsWith('<!doctype')) return false;

  if (!/<\/html>/i.test(t)) return true;

  // Unclosed CSS string or function — common cut-off pattern
  if (/linear-gradient\([^)]*$/im.test(t)) return true;
  if (/rgba?\([^)]*$/im.test(t)) return true;
  if (/#[0-9a-f]{0,5}$/im.test(t)) return true;

  const openStyle = (t.match(/<style\b/gi) || []).length;
  const closeStyle = (t.match(/<\/style>/gi) || []).length;
  if (openStyle > closeStyle) return true;

  const openDiv = (t.match(/<div\b/gi) || []).length;
  const closeDiv = (t.match(/<\/div>/gi) || []).length;
  if (openDiv - closeDiv > 4) return true;

  return false;
}
