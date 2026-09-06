/** K12 学籍学段（与 Hermes metadata.hermes.stages 对齐） */

import bundledCatalog from '../generated/capabilities.catalog.json';

export const EDUCATION_BAND_ORDER = [
  'preschool',
  'primary',
  'junior',
  'senior',
  'general',
  'academic_research',
] as const;

const ACADEMIC_RESEARCH_SLUGS = new Set([
  'df-systematic-literature-review',
  'df-academic-paper-review',
  'ala-academic-researcher',
  'college-academic-writing',
  'anth-pdf',
  'ora-brainstorm-research',
  'ora-research-manager',
  'ora-rigor-reviewer',
  'ora-ml-paper-writing',
  'ora-systems-paper-writing',
  'ora-academic-plotting',
  'nova-research-academic-professional',
]);

export type EducationBandId = (typeof EDUCATION_BAND_ORDER)[number];

export const EDUCATION_STAGE_ID = 'education';

type CatalogSkill = {
  slug: string;
  stage?: string;
  education_bands?: string[];
};

const SLUG_PREFIX: Record<string, string> = {
  preschool: 'preschool-',
  primary: 'primary-',
  junior: 'junior-',
  senior: 'senior-',
};

const GENERAL_SLUG_PREFIXES = [
  'adult-',
  'college-',
  'civil-service-',
  'ielts-',
  'toefl-',
  'postgraduate-',
  'teacher-certification-',
];

const catalogEducationBandsBySlug = new Map<string, string[]>();
for (const skill of (bundledCatalog as { skills?: CatalogSkill[] }).skills || []) {
  if (Array.isArray(skill.education_bands) && skill.education_bands.length > 0) {
    catalogEducationBandsBySlug.set(skill.slug, skill.education_bands);
  }
}

/** 从 slug 推断 Hermes 学籍学段（API 未带 education_bands 时的兜底） */
export function resolveEducationBandsFromSlug(slug: string): string[] {
  if (ACADEMIC_RESEARCH_SLUGS.has(slug)) {
    return ['academic_research'];
  }
  for (const band of EDUCATION_BAND_ORDER) {
    const prefix = SLUG_PREFIX[band];
    if (prefix && slug.startsWith(prefix)) return [band];
  }
  if (GENERAL_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) {
    return ['general'];
  }
  return [];
}

export function resolveItemEducationBands(item: {
  slug: string;
  stage: string;
  education_bands?: string[];
}): string[] {
  if (item.stage !== EDUCATION_STAGE_ID) return [];
  if (Array.isArray(item.education_bands) && item.education_bands.length > 0) {
    return item.education_bands;
  }
  const fromCatalog = catalogEducationBandsBySlug.get(item.slug);
  if (fromCatalog?.length) return fromCatalog;
  return resolveEducationBandsFromSlug(item.slug);
}

export function capabilityMatchesEducationBand(
  item: { slug: string; stage: string; education_bands?: string[] },
  bandId: string,
): boolean {
  return resolveItemEducationBands(item).includes(bandId);
}

export function enrichCapabilityEducationBands<T extends { slug: string; stage: string; education_bands?: string[] }>(
  item: T,
): T {
  if (item.stage !== EDUCATION_STAGE_ID) return item;
  const bands = resolveItemEducationBands(item);
  if (bands.length === 0) return item;
  return { ...item, education_bands: bands };
}

export type EducationBandOption = {
  id: string;
  label: string;
  stage_order: number;
  summary?: string;
  count?: number;
};

export function buildEducationBandOptions(
  capabilities: Array<{ slug: string; stage: string; education_bands?: string[] }>,
  bandMeta: Array<{ id: string; label: string; band_order?: number; stage_order?: number; summary?: string; count?: number }> = [],
): EducationBandOption[] {
  const counts = Object.fromEntries(EDUCATION_BAND_ORDER.map((id) => [id, 0]));
  for (const item of capabilities) {
    if (item.stage !== EDUCATION_STAGE_ID) continue;
    for (const bandId of resolveItemEducationBands(item)) {
      if (bandId in counts) counts[bandId] += 1;
    }
  }

  const metaById = new Map(bandMeta.map((band) => [band.id, band]));

  return EDUCATION_BAND_ORDER.map((id, index) => {
    const meta = metaById.get(id);
    return {
      id,
      label: meta?.label || id,
      stage_order: meta?.band_order ?? meta?.stage_order ?? index + 1,
      summary: meta?.summary,
      count: counts[id] ?? meta?.count ?? 0,
    };
  });
}

export function getBundledEducationBandMeta(): Array<{
  id: string;
  label: string;
  band_order: number;
  summary?: string;
  count?: number;
}> {
  const raw = (bundledCatalog as { education_bands?: Array<{ id: string; label: string; band_order: number; summary?: string; count?: number }> })
    .education_bands;
  return Array.isArray(raw) ? raw : [];
}
