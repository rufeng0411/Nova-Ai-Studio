/**
 * PD-SAAS-FORK: Welcome empty-chat suggestion pool — random subset per request.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const POOL_ZH_PATH = path.join(REPO_ROOT, 'config', 'welcome-prompt-pool.zh-CN.json');
const POOL_EN_PATH = path.join(REPO_ROOT, 'config', 'welcome-prompt-pool.en.json');

export const DEFAULT_WELCOME_DISPLAY_COUNT = 5;

function readPoolFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeLocale(locale) {
  const raw = String(locale || 'zh-CN').trim();
  if (raw.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function flattenWelcomeExamples(welcomeExamples) {
  if (!welcomeExamples || typeof welcomeExamples !== 'object') return [];
  const out = [];
  for (const items of Object.values(welcomeExamples)) {
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'string' && item.trim()) out.push(item.trim());
      }
    }
  }
  return out;
}

export function loadWelcomePromptPool(locale = 'zh-CN') {
  const lang = normalizeLocale(locale);
  const filePath = lang === 'zh-CN' ? POOL_ZH_PATH : POOL_EN_PATH;
  const parsed = readPoolFile(filePath);
  if (parsed && Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
    return {
      displayCount: Number(parsed.display_count) > 0 ? Number(parsed.display_count) : DEFAULT_WELCOME_DISPLAY_COUNT,
      prompts: parsed.prompts
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    };
  }

  const fallbackPath = path.join(REPO_ROOT, 'config', 'capabilities.overrides.json');
  if (fs.existsSync(fallbackPath)) {
    const overrides = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    const flat = flattenWelcomeExamples(overrides.welcome_examples);
    if (flat.length > 0) {
      return { displayCount: DEFAULT_WELCOME_DISPLAY_COUNT, prompts: flat };
    }
  }

  return { displayCount: DEFAULT_WELCOME_DISPLAY_COUNT, prompts: [] };
}

/** Fisher–Yates shuffle; returns up to `count` unique prompts. */
export function pickRandomWelcomePrompts(pool, count = DEFAULT_WELCOME_DISPLAY_COUNT, rng = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function buildWelcomePromptResponse(locale = 'zh-CN', rng = Math.random) {
  const { displayCount, prompts } = loadWelcomePromptPool(locale);
  const picked = pickRandomWelcomePrompts(prompts, displayCount, rng);
  return {
    prompts: picked,
    total: picked.length,
    poolSize: prompts.length,
    displayCount,
  };
}
