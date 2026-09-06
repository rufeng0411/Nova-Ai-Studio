import capabilitiesI18n from '../generated/capabilities.i18n.json';
import { DEFAULT_UI_LANGUAGE } from '../i18n/languages.js';
import {
  resolveCapabilityDescription,
  resolveCapabilityTaskSummary,
} from './capabilityCopy.js';

export type CapabilityI18nBundle = {
  stages: Record<string, Record<string, { label?: string; summary?: string }>>;
  skills: Record<
    string,
    {
      hub_sort?: number;
      stage?: string;
      stage_order?: number;
      'zh-CN'?: {
        display_name?: string;
        task_summary?: string;
        description?: string;
        setup_hint?: string;
        examples?: string[];
      };
      en?: {
        display_name?: string;
        task_summary?: string;
        description?: string;
        setup_hint?: string;
        examples?: string[];
      };
    }
  >;
};

const bundle = capabilitiesI18n as CapabilityI18nBundle;

function hasCjk(value?: string | null): boolean {
  return Boolean(value && /[\u4e00-\u9fff]/.test(value));
}

/**
 * PD-SAAS-FORK: Hub API 已按 locale 返回文案时，禁止用构建期 bundle 覆盖。
 * 否则线上热修/重新生成 catalog 后，卡片仍显示旧包名（如「智能获客」搜不到）。
 */
function preferRuntimeCopy(runtime?: string, bundled?: string): string | undefined {
  const rt = runtime?.trim() || '';
  const bd = bundled?.trim() || '';
  if (rt && hasCjk(rt)) return rt;
  if (bd) return bd;
  return rt || undefined;
}

export function resolveCapabilityLocale(language: string | undefined): 'zh-CN' | 'en' {
  const value = (language || DEFAULT_UI_LANGUAGE).trim().toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function localizeCapabilityFields<
  T extends {
    slug: string;
    stage: string;
    display_name?: string;
    task_summary: string;
    description: string;
    setup_hint?: string;
    stage_label: string;
    examples?: string[];
  },
>(item: T, language: string | undefined): T {
  const lang = resolveCapabilityLocale(language);
  const localized = bundle.skills[item.slug]?.[lang];
  const stageLocalized = bundle.stages[item.stage]?.[lang];
  if (!localized && !stageLocalized) {
    return {
      ...item,
      task_summary: resolveCapabilityTaskSummary(item),
      description: resolveCapabilityDescription(item),
    };
  }
  const merged = {
    ...item,
    display_name: preferRuntimeCopy(item.display_name, localized?.display_name) || item.display_name,
    task_summary: preferRuntimeCopy(item.task_summary, localized?.task_summary) || item.task_summary,
    description: preferRuntimeCopy(item.description, localized?.description) || item.description,
    setup_hint: preferRuntimeCopy(item.setup_hint, localized?.setup_hint) || item.setup_hint,
    stage_label: stageLocalized?.label || item.stage_label,
    // 例句：运行时已含正式名时优先，避免搜「智能获客」因旧 bundle 失败
    examples:
      Array.isArray(item.examples) && item.examples.some((e) => hasCjk(e))
        ? item.examples
        : localized?.examples?.length
          ? localized.examples
          : item.examples,
  };
  return {
    ...merged,
    task_summary: resolveCapabilityTaskSummary(merged),
    description: resolveCapabilityDescription(merged),
  };
}

/** 能力中心「试一下」使用的标准化预制提示词 */
export function resolveCapabilityTryPrompt(
  item: { slug: string; stage: string; task_summary: string; description: string; stage_label: string; examples?: string[] },
  language: string | undefined,
): string {
  const localized = localizeCapabilityFields(item, language);
  const fromExamples = localized.examples?.find((entry) => entry.trim().length > 0);
  if (fromExamples) return fromExamples.trim();
  return localized.task_summary.trim();
}

export function localizeStageFields<T extends { id: string; label: string; summary?: string }>(
  stage: T,
  language: string | undefined,
): T {
  const lang = resolveCapabilityLocale(language);
  const localized = bundle.stages[stage.id]?.[lang];
  if (!localized) return stage;
  return {
    ...stage,
    label: localized.label || stage.label,
    summary: localized.summary ?? stage.summary,
  };
}
