/**
 * PD-SAAS-FORK: 后台技能树标签 — 与能力中心 CapabilityHub 同源
 */
import type { TFunction } from 'i18next';
import { GEO_FLYWHEEL_ORDER } from '../../shared/capabilityHubTheme.js';
import { getGeoFlywheelStages } from '../../shared/capabilityHubTaxonomy.js';
import { localizeStageFields } from '../../shared/capabilityLocale.js';
import type { AdminSkillsTreeLabels } from './buildAdminSkillsTree.js';

type HubStageLike = {
  id: string;
  label: string;
  stage_order?: number;
  band_order?: number;
  summary?: string;
};

type MajorCategoriesMeta = Record<string, { label?: string; subtags?: Array<{ id: string; label: string }> }>;

export function resolveAdminMajorLabels(
  t: TFunction<'capabilities'>,
  majorCategories?: MajorCategoriesMeta,
): AdminSkillsTreeLabels['major'] {
  return {
    marketing: t('categoryMarketing'),
    geo: t('categoryGeo'),
    finance: t('categoryFinance', { defaultValue: '金融' }),
    enterprise_compliance: t('categoryEnterpriseCompliance', { defaultValue: '企业' }),
    office: majorCategories?.office?.label || t('majorCategories.office', { defaultValue: '办公' }),
    creation: majorCategories?.creation?.label || t('majorCategories.creation', { defaultValue: '创作' }),
    development: majorCategories?.development?.label || t('majorCategories.development', { defaultValue: '开发' }),
    brainstorming: majorCategories?.brainstorming?.label || t('majorCategories.brainstorming', { defaultValue: '脑暴' }),
    education: t('categoryEducation'),
  };
}

export function mergeAdminStageLabels(
  input: {
    marketingStages?: HubStageLike[];
    geoFlywheelStages?: HubStageLike[];
    locale: string;
    t: TFunction<'capabilities'>;
  },
): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const stage of input.marketingStages || []) {
    const localized = localizeStageFields(
      { ...stage, stage_order: stage.stage_order ?? 0 },
      input.locale,
    );
    labels[localized.id] = localized.label;
  }

  for (const stage of input.geoFlywheelStages || []) {
    const localized = localizeStageFields(
      { ...stage, stage_order: stage.stage_order ?? 0 },
      input.locale,
    );
    labels[localized.id] = localized.label;
  }

  if (!input.geoFlywheelStages?.length) {
    for (const stage of getGeoFlywheelStages()) {
      labels[stage.id] = input.t(`geoStages.${stage.id}.label`, { defaultValue: stage.label });
    }
  }

  for (const stageId of GEO_FLYWHEEL_ORDER) {
    if (!labels[stageId]) {
      labels[stageId] = input.t(`geoStages.${stageId}.label`, { defaultValue: stageId });
    }
  }

  return labels;
}

export function mergeAdminSubtagLabels(majorCategories?: MajorCategoriesMeta): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!majorCategories) return labels;
  for (const meta of Object.values(majorCategories)) {
    for (const subtag of meta?.subtags || []) {
      if (subtag?.id) labels[subtag.id] = subtag.label;
    }
  }
  return labels;
}

export function mergeAdminBandLabels(bands: HubStageLike[], locale: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const band of bands) {
    const localized = localizeStageFields(
      { ...band, stage_order: band.band_order ?? band.stage_order ?? 0 },
      locale,
    );
    labels[localized.id] = localized.label;
  }
  return labels;
}

export function mergeAdminTaskGroupLabels(
  flywheelTaskGroups?: Record<string, Array<{ id: string; label: string }>>,
): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!flywheelTaskGroups) return labels;
  for (const groups of Object.values(flywheelTaskGroups)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (group?.id) labels[group.id] = group.label;
    }
  }
  return labels;
}
