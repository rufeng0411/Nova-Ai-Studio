import poolData from '../generated/welcome-prompt-pool.json';

const DEFAULT_DISPLAY_COUNT = 5;

type WelcomePoolFile = {
  display_count?: number;
  prompts?: string[];
};

const parsed = poolData as WelcomePoolFile;
const POOL = Array.isArray(parsed.prompts)
  ? parsed.prompts.map((item) => item.trim()).filter(Boolean)
  : [];
const DISPLAY_COUNT = Number(parsed.display_count) > 0 ? Number(parsed.display_count) : DEFAULT_DISPLAY_COUNT;

export function pickRandomWelcomePrompts(
  count: number = DISPLAY_COUNT,
  rng: () => number = Math.random,
): string[] {
  if (POOL.length === 0) return [];
  const copy = [...POOL];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function getWelcomePromptPoolSize(): number {
  return POOL.length;
}

export { DISPLAY_COUNT as WELCOME_PROMPT_DISPLAY_COUNT, POOL as WELCOME_PROMPT_POOL };
