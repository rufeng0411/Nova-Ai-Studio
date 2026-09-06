// PD-SAAS-FORK: detect and strip English model process narration that leaks into user-visible
// assistant bubbles when the UI locale is Chinese (e.g. "Now I'll write the final deliverable now:").

import { isAgentRecoveryBoilerplate } from './userFacingErrors';

/** Full set — used by process timeline / thinking steps (aggressive hide). */
export const ENGLISH_PROCESS_NARRATION_PATTERNS: RegExp[] = [
  /^the user wants\b/i,
  /^the user asked\b/i,
  /^the user is asking\b/i,
  /^the task is\b/i,
  /^let me\b/i,
  /^good,\s/i,
  /^now let me\b/i,
  /^now i'?ll\b/i,
  /^now i will\b/i,
  /^now i am\b/i,
  /^i'?ll\b/i,
  /^i will\b/i,
  /^i need\b/i,
  /^i am going to\b/i,
  /^i'?m going to\b/i,
  /^we need\b/i,
  /^first,\s/i,
  /^next,\s/i,
  /\bfinal deliverable\b/i,
  /write the final deliverable/i,
  /read_skill/i,
  /teacher-english-unit-review/i,
];

/**
 * Stricter subset for assistant *bubble* text — avoids stripping short but substantive
 * first-ack lines like "I will inspect files first." while still catching meta leaks
 * such as "Now I'll write the final deliverable now:".
 */
export const ENGLISH_BUBBLE_NARRATION_PATTERNS: RegExp[] = [
  /^the user wants\b/i,
  /^the user asked\b/i,
  /^the user is asking\b/i,
  /^the task is\b/i,
  /^now i'?ll\b/i,
  /^now i will\b/i,
  /^now i am\b/i,
  /^now let me\b/i,
  /^let me check\b/i,
  /^let me (?:write|create|inspect|read|look|verify|start|review)\b/i,
  /\bfinal deliverable\b/i,
  /write the final deliverable/i,
  /^good,\s/i,
  /^next,\s/i,
  /read_skill/i,
  /teacher-english-unit-review/i,
];

export function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function isEnglishProcessNarration(text: string): boolean {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  if (isAgentRecoveryBoilerplate(trimmed)) return true;
  return ENGLISH_PROCESS_NARRATION_PATTERNS.some((re) => re.test(trimmed));
}

export function isEnglishBubbleNarrationLeak(text: string): boolean {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  if (isAgentRecoveryBoilerplate(trimmed)) return true;
  return ENGLISH_BUBBLE_NARRATION_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Remove English-only process narration lines (and whole bubbles that are only narration)
 * when the UI locale is Chinese. Preserves mixed zh+en content except pure-English lines.
 */
export function stripEnglishProcessNarration(text: string, localeIsZh = true): string {
  if (!localeIsZh) return String(text || '');
  const source = String(text || '');
  const trimmed = source.trim();
  if (!trimmed) return '';

  if (isEnglishBubbleNarrationLeak(trimmed) && !hasCjk(trimmed)) {
    return '';
  }

  const lines = source.split('\n');
  const kept = lines.filter((line) => {
    const lineTrimmed = line.trim();
    if (!lineTrimmed) return true;
    if (hasCjk(lineTrimmed)) return true;
    if (isEnglishBubbleNarrationLeak(lineTrimmed)) return false;
    return true;
  });

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
