// PD-SAAS-FORK: single policy for who may overwrite the chat composer

export type ComposerInputPolicy = 'user' | 'intent' | 'external' | 'restore';

export type ComposerInputDecision = {
  apply: boolean;
  value: string;
};

/** Only restore local draft when switching projects, not on metadata-only project object updates. */
export function shouldRestoreProjectDraft(
  previousProjectName: string | null | undefined,
  nextProjectName: string | null | undefined,
): boolean {
  if (!nextProjectName) return false;
  return previousProjectName !== nextProjectName;
}

/**
 * Central rule: only `user` and explicit `intent` (试一下 / slash) may clobber custom text.
 * `external` covers welcome pills and passive pending-inject — blocked once the user typed.
 */
export function resolveComposerInputUpdate(
  currentInput: string,
  incomingInput: string,
  policy: ComposerInputPolicy,
  options?: { userHasEdited?: boolean },
): ComposerInputDecision {
  const current = currentInput;
  const incoming = incomingInput;

  if (policy === 'user') {
    return { apply: true, value: incoming };
  }

  if (policy === 'intent' || policy === 'restore') {
    const trimmed = incoming.trim();
    return { apply: trimmed.length > 0 || policy === 'restore', value: incoming };
  }

  // external: welcome pills, passive capability pending read
  const currentTrim = current.trim();
  const incomingTrim = incoming.trim();
  if (!incomingTrim) {
    return { apply: false, value: current };
  }
  if (!currentTrim) {
    return { apply: true, value: incoming };
  }
  if (currentTrim === incomingTrim) {
    return { apply: true, value: incoming };
  }
  if (options?.userHasEdited) {
    return { apply: false, value: current };
  }
  // Non-empty but user has not typed yet — allow swapping one suggested prompt for another.
  return { apply: true, value: incoming };
}

/** @deprecated use resolveComposerInputUpdate */
export function shouldApplyExternalPrompt(
  currentInput: string,
  incomingPrompt: string,
  userHasEdited = false,
): boolean {
  return resolveComposerInputUpdate(
    currentInput,
    incomingPrompt,
    'external',
    { userHasEdited },
  ).apply;
}
