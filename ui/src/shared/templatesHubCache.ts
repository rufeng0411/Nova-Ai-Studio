import { DEFAULT_UI_LANGUAGE } from '../i18n/languages.js';
import {
  getBundledProcessTemplates,
  normalizeProcessTemplateLocale,
  type ProcessTemplate,
} from './processTemplates.js';

type CachedProcessTemplates = {
  locale: 'zh-CN' | 'en';
  templates: ProcessTemplate[];
};

let processTemplatesMemoryCache: CachedProcessTemplates | null = null;

export function readCachedProcessTemplates(
  language?: string,
): ProcessTemplate[] | null {
  const locale = normalizeProcessTemplateLocale(language || DEFAULT_UI_LANGUAGE);
  if (processTemplatesMemoryCache?.locale === locale) {
    return processTemplatesMemoryCache.templates;
  }
  return null;
}

export function writeCachedProcessTemplates(
  language: string | undefined,
  templates: ProcessTemplate[],
): void {
  processTemplatesMemoryCache = {
    locale: normalizeProcessTemplateLocale(language || DEFAULT_UI_LANGUAGE),
    templates,
  };
}

export function primeProcessTemplatesCache(language?: string): ProcessTemplate[] {
  const payload = getBundledProcessTemplates(language);
  writeCachedProcessTemplates(language, payload.templates);
  return payload.templates;
}
