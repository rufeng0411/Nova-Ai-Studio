/** PD-SAAS-FORK: 从 bundled catalog 补全 API 可能缺失的分类字段 */

import bundledCatalog from '../generated/capabilities.catalog.json';

export type CapabilityTaxonomyFields = {
 task_group?: string;
 major_category?: string;
 geo_stage?: string;
 hub_recommend_stars?: number;
 secondary_categories?: string[];
 secondary_task_groups?: string[];
 secondary_stages?: string[];
 media_lane?: string;
 secondary_media_lanes?: string[];
 media_workflow_step?: string;
 secondary_media_workflow_steps?: string[];
 category_subtag?: string;
 hidden_in_hub?: boolean;
 stage?: string;
 display_name?: string;
};

const taxonomyBySlug = new Map<string, CapabilityTaxonomyFields>();

for (const skill of (bundledCatalog as { skills?: Array<{ slug: string } & CapabilityTaxonomyFields> }).skills ||
 []) {
 if (!skill.slug) continue;
 taxonomyBySlug.set(skill.slug, {
 task_group: skill.task_group,
 major_category: skill.major_category,
 geo_stage: (skill as { geo_stage?: string }).geo_stage,
 hub_recommend_stars: (skill as { hub_recommend_stars?: number }).hub_recommend_stars,
 secondary_categories: skill.secondary_categories,
 secondary_task_groups: (skill as { secondary_task_groups?: string[] }).secondary_task_groups,
 secondary_stages: (skill as { secondary_stages?: string[] }).secondary_stages,
 media_lane: skill.media_lane,
 secondary_media_lanes: skill.secondary_media_lanes,
 media_workflow_step: skill.media_workflow_step,
 secondary_media_workflow_steps: skill.secondary_media_workflow_steps,
 category_subtag: skill.category_subtag,
 hidden_in_hub: skill.hidden_in_hub,
 stage: skill.stage,
 display_name: skill.display_name,
 });
}

export function getTaxonomyForSlug(slug: string): CapabilityTaxonomyFields | undefined {
 return taxonomyBySlug.get(slug);
}

export function enrichCapabilityTaxonomy<
 T extends {
 slug: string;
 stage?: string;
 task_group?: string;
 major_category?: string;
 geo_stage?: string;
 hub_recommend_stars?: number;
 secondary_categories?: string[];
 secondary_task_groups?: string[];
 secondary_stages?: string[];
 media_lane?: string;
 secondary_media_lanes?: string[];
 media_workflow_step?: string;
 secondary_media_workflow_steps?: string[];
 category_subtag?: string;
 hidden_in_hub?: boolean;
 display_name?: string;
 name?: string;
 },
>(item: T): T {
 const meta = taxonomyBySlug.get(item.slug);
 if (!meta) {
 return {
 ...item,
 task_group: item.task_group || 'general',
 major_category: item.major_category || 'marketing',
 secondary_categories: item.secondary_categories || [],
 category_subtag: item.category_subtag || '',
 };
 }
 // PD-SAAS-FORK: 目录 taxonomy 为权威来源，避免 API 缺/错 category_subtag 导致 Pill 有数无卡
 return {
 ...item,
 display_name: item.display_name || meta.display_name,
 stage: meta.stage ?? item.stage,
 task_group: meta.task_group ?? item.task_group ?? 'general',
 major_category: meta.major_category ?? item.major_category ?? 'marketing',
 geo_stage: meta.geo_stage ?? item.geo_stage,
 hub_recommend_stars: meta.hub_recommend_stars ?? item.hub_recommend_stars,
 secondary_categories:
 item.secondary_categories && item.secondary_categories.length > 0
 ? item.secondary_categories
 : meta.secondary_categories || [],
 secondary_task_groups:
 item.secondary_task_groups && item.secondary_task_groups.length > 0
 ? item.secondary_task_groups
 : meta.secondary_task_groups || [],
 secondary_stages:
 item.secondary_stages && item.secondary_stages.length > 0
 ? item.secondary_stages
 : meta.secondary_stages || [],
 media_lane: meta.media_lane ?? item.media_lane,
 secondary_media_lanes:
 item.secondary_media_lanes && item.secondary_media_lanes.length > 0
 ? item.secondary_media_lanes
 : meta.secondary_media_lanes || [],
 media_workflow_step: meta.media_workflow_step ?? item.media_workflow_step,
 secondary_media_workflow_steps:
 item.secondary_media_workflow_steps && item.secondary_media_workflow_steps.length > 0
 ? item.secondary_media_workflow_steps
 : meta.secondary_media_workflow_steps || [],
 category_subtag: meta.category_subtag ?? item.category_subtag ?? '',
 hidden_in_hub: item.hidden_in_hub ?? meta.hidden_in_hub ?? false,
 };
}

import { capabilityMatchesFlywheelStage, capabilityMatchesGeoStage } from './capabilityHubTaxonomy.js';

export function countTaskGroupsForStage(
 capabilities: Array<{
 stage?: string;
 task_group?: string;
 secondary_task_groups?: string[];
 secondary_stages?: string[];
 hidden_in_hub?: boolean;
 }>,
 stageId: string,
): Record<string, number> {
 const counts: Record<string, number> = {};
 for (const item of capabilities) {
 if (item.hidden_in_hub) continue;
 if (!capabilityMatchesFlywheelStage(item, stageId)) continue;
 const primary = item.task_group || 'general';
 counts[primary] = (counts[primary] || 0) + 1;
 for (const sec of item.secondary_task_groups || []) {
 if (sec !== primary) {
 counts[sec] = (counts[sec] || 0) + 1;
 }
 }
 }
 return counts;
}

export function countGeoTaskGroupsForStage(
 capabilities: Array<{
 geo_stage?: string;
 task_group?: string;
 secondary_task_groups?: string[];
 hidden_in_hub?: boolean;
 }>,
 geoStageId: string,
): Record<string, number> {
 const counts: Record<string, number> = {};
 for (const item of capabilities) {
 if (item.hidden_in_hub) continue;
 if (!capabilityMatchesGeoStage(item, geoStageId)) continue;
 const primary = item.task_group || 'general';
 counts[primary] = (counts[primary] || 0) + 1;
 for (const sec of item.secondary_task_groups || []) {
 if (sec !== primary) {
 counts[sec] = (counts[sec] || 0) + 1;
 }
 }
 }
 return counts;
}

export function countSubtagsForMajor(
 capabilities: Array<{
 major_category?: string;
 secondary_categories?: string[];
 category_subtag?: string;
 hidden_in_hub?: boolean;
 }>,
 majorCategory: string,
 matchesMajor: (major: string, item: (typeof capabilities)[number]) => boolean,
): Record<string, number> {
 const counts: Record<string, number> = {};
 for (const item of capabilities) {
 if (item.hidden_in_hub) continue;
 if (!matchesMajor(majorCategory, item)) continue;
 const tag = item.category_subtag || 'general';
 counts[tag] = (counts[tag] || 0) + 1;
 }
 return counts;
}
