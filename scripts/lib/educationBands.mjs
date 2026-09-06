/** K12 学籍学段（与 Hermes metadata.hermes.stages 对齐） */

export const EDUCATION_BAND_ORDER = ['preschool', 'primary', 'junior', 'senior', 'edu_fun', 'general', 'academic_research'];

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

const SLUG_PREFIX = {
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

/**
 * @param {string} slug
 * @param {Record<string, unknown>} [frontmatter]
 * @returns {string[]}
 */
export function resolveEducationBands(slug, frontmatter = {}, explicitBands = []) {
  if (Array.isArray(explicitBands) && explicitBands.length > 0) {
    return explicitBands.filter((band) => EDUCATION_BAND_ORDER.includes(band));
  }

  if (ACADEMIC_RESEARCH_SLUGS.has(slug)) {
    return ['academic_research'];
  }

  const hermes = frontmatter?.metadata?.hermes;
  const rawStages = hermes?.stages;
  if (Array.isArray(rawStages) && rawStages.length > 0) {
    const bands = EDUCATION_BAND_ORDER.filter((band) => rawStages.includes(band));
    if (bands.length > 0) return bands;
  }

  for (const band of EDUCATION_BAND_ORDER) {
    if (slug.startsWith(SLUG_PREFIX[band])) return [band];
  }

  if (GENERAL_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) {
    return ['general'];
  }

  return [];
}

/**
 * @param {Array<{ stage?: string; education_bands?: string[] }>} skills
 * @returns {Record<string, number>}
 */
export function countEducationBandSkills(skills) {
  const counts = Object.fromEntries(EDUCATION_BAND_ORDER.map((id) => [id, 0]));
  for (const skill of skills) {
    if (skill.stage !== 'education') continue;
    const bands = Array.isArray(skill.education_bands) ? skill.education_bands : [];
    for (const band of bands) {
      if (band in counts) counts[band] += 1;
    }
  }
  return counts;
}
