// PD-SAAS-FORK: client-side splice for Bento deck saves
const BENTO_DOC_RE = /(<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>)([\s\S]*?)(<\/script>)/i;

export function hasBentoDocBlock(html: string): boolean {
  return BENTO_DOC_RE.test(String(html ?? ''));
}

export function escapeBentoJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

export function spliceBentoDocIntoHtml(html: string, doc: unknown): string {
  const match = BENTO_DOC_RE.exec(html);
  if (!match) {
    throw new Error('Missing #bento-doc block');
  }
  const serialized = escapeBentoJson(doc);
  return html.replace(BENTO_DOC_RE, `$1\n${serialized}\n$3`);
}

export function extractBentoDocFromHtml(html: string): unknown {
  const match = BENTO_DOC_RE.exec(html);
  if (!match) {
    throw new Error('Missing #bento-doc block');
  }
  return JSON.parse(match[2].trim());
}
