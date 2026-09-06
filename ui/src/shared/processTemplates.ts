import { api } from '../utils/api';
import { DEFAULT_UI_LANGUAGE } from '../i18n/languages.js';
import bundled from '../generated/process-templates.json';

export type ProcessTemplateComplexity = 'light' | 'standard' | 'full';
/** Hub L2 navigation categories (no education/brainstorming). */
export type ProcessTemplateCategory =
  | 'marketing'
  | 'enterprise'
  | 'geo'
  | 'office'
  | 'creation';

export type ProcessTemplateFlowStep = {
  step: number;
  title: string;
  skill: string;
};

export type ProcessTemplate = {
  id: string;
  complexity: ProcessTemplateComplexity;
  /** L2 gallery filter key; badge still uses complexity. */
  category?: ProcessTemplateCategory;
  title: string;
  outcome: string;
  scenario: string;
  outputs: string;
  prompt: string;
  stageBadges: string[];
  relatedSkills: string[];
  flow: ProcessTemplateFlowStep[];
  stepCount: number;
  rating?: number;
  geoFlywheel?: boolean;
  geoStages?: string[];
  hub_pinned?: boolean;
};

export type ProcessTemplateComplexityLevel = {
  id: ProcessTemplateComplexity;
  order: number;
  label: string;
  description: string;
};

export type ProcessTemplateCategoryLevel = {
  id: ProcessTemplateCategory;
  order: number;
  label: string;
  description: string;
};

export type ProcessTemplatesPayload = {
  complexityLevels: ProcessTemplateComplexityLevel[];
  categoryLevels?: ProcessTemplateCategoryLevel[];
  templates: ProcessTemplate[];
  report?: {
    total?: number;
    counts?: Record<string, number>;
    categoryCounts?: Record<string, number>;
    locale?: string;
  };
};

export function normalizeProcessTemplateLocale(language: string): 'zh-CN' | 'en' {
  if (language?.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
}

function bundleFallback(locale: 'zh-CN' | 'en'): ProcessTemplatesPayload {
  const raw = bundled as {
    complexityLevels?: Array<{
      id: ProcessTemplateComplexity;
      order?: number;
      label?: Record<string, string>;
      description?: Record<string, string>;
    }>;
    categoryLevels?: Array<{
      id: ProcessTemplateCategory;
      order?: number;
      label?: Record<string, string>;
      description?: Record<string, string>;
    }>;
    templates?: Array<{
      id: string;
      complexity: ProcessTemplateComplexity;
      category?: ProcessTemplateCategory;
      title?: Record<string, string>;
      outcome?: Record<string, string>;
      scenario?: Record<string, string>;
      outputs?: Record<string, string>;
      prompt?: Record<string, string>;
      stageBadges?: string[];
      relatedSkills?: string[];
      geoFlywheel?: boolean;
      geoStages?: string[];
      flow?: Array<{ step: number; title?: Record<string, string>; skill?: string }>;
      rating?: number;
      hub_pinned?: boolean;
    }>;
  };

  const pick = (obj?: Record<string, string>) =>
    obj?.[locale] || obj?.en || obj?.['zh-CN'] || '';

  return {
    complexityLevels: (raw.complexityLevels || []).map((level) => ({
      id: level.id,
      order: level.order ?? 99,
      label: pick(level.label),
      description: pick(level.description),
    })),
    categoryLevels: (raw.categoryLevels || []).map((level) => ({
      id: level.id,
      order: level.order ?? 99,
      label: pick(level.label),
      description: pick(level.description),
    })),
    templates: (raw.templates || []).map((t) => ({
      id: t.id,
      complexity: t.complexity,
      category: t.category,
      title: pick(t.title),
      outcome: pick(t.outcome),
      scenario: pick(t.scenario),
      outputs: pick(t.outputs),
      prompt: pick(t.prompt),
      stageBadges: t.stageBadges || [],
      relatedSkills: t.relatedSkills || [],
      geoFlywheel: Boolean(t.geoFlywheel),
      geoStages: Array.isArray(t.geoStages) ? t.geoStages : [],
      flow: (t.flow || []).map((step) => ({
        step: step.step,
        title: pick(step.title),
        skill: step.skill || '',
      })),
      stepCount: t.flow?.length ?? 0,
      rating: typeof t.rating === 'number' ? t.rating : undefined,
      hub_pinned: Boolean(t.hub_pinned),
    })),
  };
}

export function getBundledProcessTemplates(
  localeInput?: string,
): ProcessTemplatesPayload {
  return bundleFallback(normalizeProcessTemplateLocale(localeInput || DEFAULT_UI_LANGUAGE));
}

export async function fetchProcessTemplates(
  localeInput?: string,
  options?: { admin?: boolean },
): Promise<ProcessTemplatesPayload> {
  const locale = normalizeProcessTemplateLocale(localeInput || DEFAULT_UI_LANGUAGE);
  const bundled = getBundledProcessTemplates(locale);
  try {
    const params = new URLSearchParams({ locale });
    if (options?.admin) params.set('admin', '1');
    const response = await api.get(`/process-templates?${params.toString()}`);
    if (!response.ok) throw new Error(`process-templates ${response.status}`);
    const data = await response.json() as ProcessTemplatesPayload;
    if (Array.isArray(data.templates) && data.templates.length > 0) {
      return data;
    }
  } catch {
    // fall through to bundled
  }
  return bundled;
}

export function resolveProcessTemplatePrompt(
  template: ProcessTemplate,
  localeInput?: string,
): string {
  const locale = normalizeProcessTemplateLocale(localeInput || DEFAULT_UI_LANGUAGE);
  if (locale === 'zh-CN') {
    return template.prompt?.trim() || '';
  }
  return template.prompt?.trim() || '';
}
