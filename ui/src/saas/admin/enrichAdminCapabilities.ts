/**
 * PD-SAAS-FORK: 后台技能树 — 用 bundled catalog 补全 taxonomy 字段（与能力中心一致）
 */
import bundledCatalog from '../../generated/capabilities.catalog.json';
import type { AdminCapabilityRecord } from './buildAdminSkillsTree.js';

type CatalogSkill = {
  slug?: string;
  major_category?: string;
  geo_stage?: string;
  task_group?: string;
  category_subtag?: string;
  education_bands?: string[];
  hidden_in_hub?: boolean;
  secondary_categories?: string[];
};

const catalogBySlug = new Map<string, CatalogSkill>();
for (const skill of (bundledCatalog as { skills?: CatalogSkill[] }).skills || []) {
  if (skill?.slug) catalogBySlug.set(skill.slug, skill);
}

export function enrichAdminCapabilities(items: AdminCapabilityRecord[]): AdminCapabilityRecord[] {
  return items.map((item) => {
    const cat = catalogBySlug.get(item.slug);
    if (!cat) return item;
    return {
      ...item,
      major_category: item.major_category || cat.major_category,
      geo_stage: item.geo_stage || cat.geo_stage,
      task_group: item.task_group || cat.task_group,
      category_subtag: item.category_subtag || cat.category_subtag,
      education_bands: item.education_bands?.length ? item.education_bands : cat.education_bands,
      secondary_categories: item.secondary_categories?.length
        ? item.secondary_categories
        : cat.secondary_categories,
      hidden_in_hub: item.hidden_in_hub ?? Boolean(cat.hidden_in_hub),
    };
  });
}
