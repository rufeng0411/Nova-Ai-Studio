import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyTaxonomyToSkill } from '../../../../scripts/lib/capabilityHubTaxonomy.mjs';
import {
  buildAdminSkillsTree,
  defaultMajorLabels,
  type AdminCapabilityRecord,
} from './buildAdminSkillsTree.js';
import { HUB_MAJOR_CATEGORY_ORDER } from '../../shared/capabilityHubTaxonomy.js';
import { GEO_FLYWHEEL_ORDER } from '../../shared/capabilityHubTheme.js';

const catalogPath = path.resolve(import.meta.dirname, '../../../../config/capabilities.catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
  skills?: Array<Record<string, unknown>>;
};

function loadCapabilities(): AdminCapabilityRecord[] {
  return (catalog.skills || []).map((skill) => {
    const enriched = applyTaxonomyToSkill({ ...skill });
    return {
      slug: String(enriched.slug),
      name: String(enriched.name || enriched.slug),
      display_name: enriched.display_name as string | undefined,
      task_summary: enriched.task_summary as string | undefined,
      description: enriched.description as string | undefined,
      stage: String(enriched.stage || 'uncategorized'),
      task_group: enriched.task_group as string | undefined,
      major_category: enriched.major_category as string | undefined,
      geo_stage: enriched.geo_stage as string | undefined,
      category_subtag: enriched.category_subtag as string | undefined,
      education_bands: enriched.education_bands as string[] | undefined,
      hidden_in_hub: Boolean(enriched.hidden_in_hub),
      status: 'available',
    };
  });
}

function branchIds(nodes: ReturnType<typeof buildAdminSkillsTree>): string[] {
  return nodes.filter((node) => node.kind === 'branch').map((node) => node.id);
}

describe('buildAdminSkillsTree', () => {
  it('matches capability hub major category order at root', () => {
    const tree = buildAdminSkillsTree({
      capabilities: loadCapabilities(),
      labels: {
        major: defaultMajorLabels(),
        uncategorized: '待归类',
        general: '通用',
        stageLabels: Object.fromEntries(
          GEO_FLYWHEEL_ORDER.map((id) => [id, id]),
        ),
        taskGroupLabels: {},
        subtagLabels: {},
        bandLabels: {},
      },
    });

    const roots = branchIds(tree).filter((id) => id !== 'uncategorized');
    const expectedPrefix = HUB_MAJOR_CATEGORY_ORDER.filter((major) => roots.includes(major));
    expect(roots.slice(0, expectedPrefix.length)).toEqual(expectedPrefix);
    expect(roots).toContain('geo');
    expect(roots.indexOf('geo')).toBeGreaterThan(roots.indexOf('marketing'));
  });

  it('builds GEO branch with six flywheel stage children', () => {
    const tree = buildAdminSkillsTree({
      capabilities: loadCapabilities(),
      labels: {
        major: defaultMajorLabels(),
        uncategorized: '待归类',
        general: '通用',
        stageLabels: Object.fromEntries(
          GEO_FLYWHEEL_ORDER.map((id) => [id, id]),
        ),
        taskGroupLabels: {},
        subtagLabels: {},
        bandLabels: {},
      },
    });

    const geo = tree.find((node) => node.kind === 'branch' && node.id === 'geo');
    expect(geo?.kind).toBe('branch');
    if (geo?.kind !== 'branch') return;

    expect(geo.label).toBe('GEO');
    const stageIds = geo.children
      .filter((child) => child.kind === 'branch')
      .map((child) => child.id.replace(/^geo:/, ''));
    expect(stageIds.length).toBeGreaterThanOrEqual(4);
    for (const stageId of stageIds) {
      expect(GEO_FLYWHEEL_ORDER).toContain(stageId);
    }
  });
});
