// PD-SAAS-FORK: basename normalization for Tier-0 SDM slot matching (GEO/Campaign)

export function stripNumericPrefixBasename(basename: string): string {
  return basename.replace(/^\d+-/, '');
}

/** Core token for alias compare: strip numeric prefix, extension, separators. */
export function normalizeDeliverableBasenameCore(basename: string): string {
  const withoutPrefix = stripNumericPrefixBasename(basename.toLowerCase());
  const withoutExt = withoutPrefix.replace(/\.(md|markdown|html?|htm|pdf|docx|pptx|jsonld|json|mp4|png|jpe?g|webp)$/i, '');
  return withoutExt.replace(/[-_.\s]/g, '');
}

export function deliverableBasenamesMatch(
  a: string,
  b: string,
  options?: { tier0Profile?: boolean },
): boolean {
  const normA = a.toLowerCase();
  const normB = b.toLowerCase();
  if (normA === normB) return true;
  const strippedA = stripNumericPrefixBasename(normA);
  const strippedB = stripNumericPrefixBasename(normB);
  if (strippedA === strippedB) return true;
  const coreA = normalizeDeliverableBasenameCore(a);
  const coreB = normalizeDeliverableBasenameCore(b);
  if (!coreA || !coreB) return false;
  if (coreA === coreB) return true;
  if (!options?.tier0Profile) return false;
  const minLen = Math.min(8, coreA.length, coreB.length);
  if (minLen >= 4 && (coreA.includes(coreB) || coreB.includes(coreA))) return true;
  if (minLen < 6) return false;
  return coreA.includes(coreB.slice(0, minLen)) || coreB.includes(coreA.slice(0, minLen));
}
