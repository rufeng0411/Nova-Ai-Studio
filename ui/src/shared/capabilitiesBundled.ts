import bundledCatalog from '../generated/capabilities.catalog.json';
import { DEFAULT_UI_LANGUAGE } from '../i18n/languages.js';
import {
  localizeCapabilityFields,
  localizeStageFields,
  resolveCapabilityLocale,
} from './capabilityLocale.js';
import {
  compareCapabilitiesForHub,
} from './capabilityHubSort.js';
import { enrichCapabilityEducationBands } from './educationBands.js';

export type BundledCapabilityStage = {
  id: string;
  label: string;
  stage_order: number;
  summary?: string;
  count?: number;
};

export type BundledCapabilityItem = {
  slug: string;
  name: string;
  task_summary: string;
  description: string;
  stage: string;
  stage_label: string;
  stage_order: number;
  education_bands?: string[];
  integration_level: string;
  hub_sort?: number;
  examples: string[];
  hidden_in_hub?: boolean;
  major_category?: string;
  geo_stage?: string;
  hub_recommend_stars?: number;
  hub_pinned?: boolean;
  task_group?: string;
  category_subtag?: string;
};

export type BundledEducationBand = {
  id: string;
  label: string;
  band_order: number;
  summary?: string;
  count?: number;
};

export type BundledCapabilitiesHubPayload = {
  stages: BundledCapabilityStage[];
  education_bands?: BundledEducationBand[];
  capabilities: BundledCapabilityItem[];
};

type CatalogSkill = {
  slug: string;
  name?: string;
  description?: string;
  task_summary?: string;
  stage: string;
  stage_label?: string;
  stage_order?: number;
  education_bands?: string[];
  integration_level?: string;
  hub_sort?: number;
  examples?: string[];
  hidden_in_hub?: boolean;
  major_category?: string;
  geo_stage?: string;
  hub_recommend_stars?: number;
  hub_pinned?: boolean;
  task_group?: string;
  category_subtag?: string;
};

type CatalogPayload = {
  stages?: Array<{
    id: string;
    label: string;
    stage_order: number;
    summary?: string;
  }>;
  education_bands?: BundledEducationBand[];
  skills?: CatalogSkill[];
};

const catalog = bundledCatalog as CatalogPayload;

export function getBundledCapabilitiesHub(
  language?: string,
): BundledCapabilitiesHubPayload {
  const stageCounter = new Map<string, number>();
  const educationBandCounter = new Map<string, number>();
  const stageMap = new Map(
    (catalog.stages || []).map((stage) => [stage.id, stage]),
  );

  const capabilities = (catalog.skills || [])
    .map((skill) => {
      const stageMeta = stageMap.get(skill.stage);
      const item: BundledCapabilityItem = {
        slug: skill.slug,
        name: skill.name || skill.slug,
        task_summary: skill.task_summary || skill.description || skill.slug,
        description: skill.description || skill.task_summary || '',
        stage: skill.stage,
        stage_label: skill.stage_label || stageMeta?.label || skill.stage,
        stage_order: skill.stage_order ?? stageMeta?.stage_order ?? 999,
        education_bands: Array.isArray(skill.education_bands) ? skill.education_bands : [],
        integration_level: skill.integration_level || 'L1',
        hub_sort: skill.hub_sort,
        examples: Array.isArray(skill.examples) ? skill.examples : [],
        hidden_in_hub: Boolean(skill.hidden_in_hub),
        major_category: skill.major_category,
        geo_stage: skill.geo_stage,
        hub_recommend_stars: skill.hub_recommend_stars,
        hub_pinned: Boolean(skill.hub_pinned),
        task_group: skill.task_group,
        category_subtag: skill.category_subtag,
      };
      // PD-SAAS-FORK: marketing/education stage (and band) counts exclude
      // hidden_in_hub skills so the flywheel/edu Pill numbers match the items
      // actually rendered (CapabilityHub filters hidden_in_hub for those tabs).
      if (!item.hidden_in_hub) {
        stageCounter.set(skill.stage, (stageCounter.get(skill.stage) || 0) + 1);
        if (skill.stage === 'education') {
          for (const bandId of item.education_bands || []) {
            educationBandCounter.set(bandId, (educationBandCounter.get(bandId) || 0) + 1);
          }
        }
      }
      return localizeCapabilityFields(enrichCapabilityEducationBands(item), language);
    })
    .sort(compareCapabilitiesForHub);

  const educationBands = (catalog.education_bands || []).map((band) => ({
    ...band,
    count: educationBandCounter.get(band.id) ?? band.count ?? 0,
  }));

  const stages = (catalog.stages || [])
    .map((stage) =>
      localizeStageFields(
        {
          ...stage,
          count: stageCounter.get(stage.id) || 0,
        },
        language,
      ),
    )
    .sort((a, b) => (a.stage_order ?? 999) - (b.stage_order ?? 999));

  return { stages, education_bands: educationBands, capabilities };
}

export function capabilitiesCacheKey(projectPath: string | undefined, language: string): string {
  return `${projectPath || ''}|${resolveCapabilityLocale(language)}`;
}

type CachedCapabilities = {
  key: string;
  stages: BundledCapabilityStage[];
  education_bands?: BundledEducationBand[];
  capabilities: BundledCapabilityItem[];
};

let capabilitiesMemoryCache: CachedCapabilities | null = null;

export function readCachedCapabilities(
  projectPath: string | undefined,
  language: string,
): BundledCapabilitiesHubPayload | null {
  const key = capabilitiesCacheKey(projectPath, language);
  if (capabilitiesMemoryCache?.key === key) {
    return {
      stages: capabilitiesMemoryCache.stages,
      education_bands: capabilitiesMemoryCache.education_bands,
      capabilities: capabilitiesMemoryCache.capabilities,
    };
  }
  return null;
}

export function writeCachedCapabilities(
  projectPath: string | undefined,
  language: string,
  payload: BundledCapabilitiesHubPayload,
): void {
  capabilitiesMemoryCache = {
    key: capabilitiesCacheKey(projectPath, language),
    stages: payload.stages,
    education_bands: payload.education_bands,
    capabilities: payload.capabilities,
  };
}

export function primeCapabilitiesCache(language?: string): BundledCapabilitiesHubPayload {
  const bundled = getBundledCapabilitiesHub(language);
  writeCachedCapabilities(undefined, language || DEFAULT_UI_LANGUAGE, bundled);
  return bundled;
}
