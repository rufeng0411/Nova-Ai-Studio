/**
 * i18n Configuration
 *
 * Configures i18next for internationalization support.
 * Features:
 * - Language detection from localStorage
 * - Fallback to English for missing translations
 * - Development mode warnings for missing keys
 *
 * Supported locales: en, zh-CN. Other locales were retired during the
 * V1 cleanup; add new locale bundles in `./locales/<lang>/` and register
 * them in `resources` + `./languages.js` to bring them back.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// eslint-disable-next-line import-x/order
import LanguageDetector from 'i18next-browser-languagedetector';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { authenticatedFetch } from '../utils/api';

import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enAuth from './locales/en/auth.json';
import enSidebar from './locales/en/sidebar.json';
import enChat from './locales/en/chat.json';
import enCodeEditor from './locales/en/codeEditor.json';
import enAlwaysOn from './locales/en/alwaysOn.json';
import enRouting from './locales/en/routing.json';
// eslint-disable-next-line import-x/order
import enTasks from './locales/en/tasks.json';
import enCapabilities from './locales/en/capabilities.json';
import enProcessTemplates from './locales/en/processTemplates.json';
import enTemplatesHub from './locales/en/templatesHub.json';

import zhCommon from './locales/zh-CN/common.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhAuth from './locales/zh-CN/auth.json';
import zhSidebar from './locales/zh-CN/sidebar.json';
import zhChat from './locales/zh-CN/chat.json';
import zhAlwaysOn from './locales/zh-CN/alwaysOn.json';
import zhRouting from './locales/zh-CN/routing.json';
// eslint-disable-next-line import-x/order
import zhCodeEditor from './locales/zh-CN/codeEditor.json';
import zhCapabilities from './locales/zh-CN/capabilities.json';
import zhProcessTemplates from './locales/zh-CN/processTemplates.json';
import zhTemplatesHub from './locales/zh-CN/templatesHub.json';

import { DEFAULT_UI_LANGUAGE, languages } from './languages.js';

const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem('userLanguage');
    if (saved && languages.some(lang => lang.value === saved)) {
      return saved;
    }
    return DEFAULT_UI_LANGUAGE;
  } catch {
    return DEFAULT_UI_LANGUAGE;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        settings: enSettings,
        auth: enAuth,
        sidebar: enSidebar,
        chat: enChat,
        codeEditor: enCodeEditor,
        tasks: enTasks,
        alwaysOn: enAlwaysOn,
        routing: enRouting,
        capabilities: enCapabilities,
        processTemplates: enProcessTemplates,
        templatesHub: enTemplatesHub,
      },
      'zh-CN': {
        common: zhCommon,
        settings: zhSettings,
        auth: zhAuth,
        sidebar: zhSidebar,
        chat: zhChat,
        codeEditor: zhCodeEditor,
        alwaysOn: zhAlwaysOn,
        routing: zhRouting,
        capabilities: zhCapabilities,
        processTemplates: zhProcessTemplates,
        templatesHub: zhTemplatesHub,
      },
    },

    lng: getSavedLanguage(),
    fallbackLng: 'en',
    debug: import.meta.env.DEV,

    ns: ['common', 'settings', 'auth', 'sidebar', 'chat', 'codeEditor', 'tasks', 'alwaysOn', 'routing', 'capabilities', 'processTemplates', 'templatesHub'],
    defaultNS: 'common',
    keySeparator: '.',
    nsSeparator: ':',
    saveMissing: false,

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: import.meta.env.MODE !== 'test',
      bindI18n: 'languageChanged',
      bindI18nStore: false,
    },

    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'userLanguage',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('userLanguage', lng);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
  syncPromptLanguageFromUi(lng);
});

/** PD-SAAS-FORK: mirror UI language into pilotdeck.yaml for agent work-language resolution. */
export function syncPromptLanguageFromUi(lng) {
  const promptLanguage = lng === 'zh-CN' ? 'zh-CN' : 'en';
  authenticatedFetch('/api/config')
    .then((r) => r.json())
    .then((data) => {
      const raw = typeof data?.raw === 'string' ? data.raw : '';
      if (!raw) return;
      let parsed;
      try { parsed = parseYaml(raw); } catch { return; }
      if (!parsed || typeof parsed !== 'object') return;
      if (!parsed.alwaysOn || typeof parsed.alwaysOn !== 'object') {
        parsed.alwaysOn = { enabled: false };
      }
      const needsAlwaysOn = parsed.alwaysOn.language !== promptLanguage;
      const needsTopLevel = parsed.language !== promptLanguage;
      if (!needsAlwaysOn && !needsTopLevel) return;
      if (needsAlwaysOn) parsed.alwaysOn.language = promptLanguage;
      if (needsTopLevel) parsed.language = promptLanguage;
      const updated = stringifyYaml(parsed, { lineWidth: 0 });
      return authenticatedFetch('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ raw: updated }),
      });
    })
    .catch(() => {});
}

// PD-SAAS-FORK: 首屏不打 /api/config；仅在用户切换语言时 sync（见 languageChanged）。

export default i18n;
