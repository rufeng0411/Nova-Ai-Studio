// PD-SAAS-FORK: GEO / multi-phase campaign deliverable expansion (UI layer)
export const BRAND_GEO_FULL_CASE_GOAL_PATTERN =
  /(?:品牌\s*GEO\s*全案|AI\s*搜索可见度标准包|geo-aeo-audit|pd-geo|mkt-schema|od-data-report|visibility-report\.html)/i;

export function isBrandGeoFullCaseGoal(userGoal: string): boolean {
  return BRAND_GEO_FULL_CASE_GOAL_PATTERN.test(String(userGoal ?? ''));
}

export function isGeoCampaignArtifactDir(turnDir: string): boolean {
  const normalized = String(turnDir ?? '').replace(/\\/g, '/').toLowerCase();
  return normalized.includes('artifacts/geo/') || /^geo\/[^/]+/.test(normalized);
}
