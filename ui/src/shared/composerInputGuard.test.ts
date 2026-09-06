import { describe, expect, it } from 'vitest';
import {
  resolveComposerInputUpdate,
  shouldApplyExternalPrompt,
  shouldRestoreProjectDraft,
} from './composerInputGuard';

describe('composerInputGuard', () => {
  // Regression: cloud projects_updated refreshed selectedProject object while user
  // typed; draft restore re-read localStorage (often a welcome pill) and clobbered input.
  it('restores draft only when project name changes', () => {
    expect(shouldRestoreProjectDraft(null, 'general')).toBe(true);
    expect(shouldRestoreProjectDraft('general', 'general')).toBe(false);
    expect(shouldRestoreProjectDraft('general', 'other')).toBe(true);
    expect(shouldRestoreProjectDraft('general', null)).toBe(false);
  });

  it('external policy: empty accepts; user-edited blocks overwrite', () => {
    expect(
      resolveComposerInputUpdate('', '帮我做 PPT', 'external').apply,
    ).toBe(true);
    expect(
      resolveComposerInputUpdate('用户自己写的', '帮我做 PPT', 'external', { userHasEdited: true }).apply,
    ).toBe(false);
    expect(
      resolveComposerInputUpdate('提示 A', '提示 B', 'external', { userHasEdited: false }).apply,
    ).toBe(true);
    expect(
      resolveComposerInputUpdate('提示 A', '提示 B', 'external', { userHasEdited: true }).apply,
    ).toBe(false);
  });

  it('intent policy always applies explicit user actions (试一下)', () => {
    expect(
      resolveComposerInputUpdate('用户自己写的', '能力预填', 'intent').apply,
    ).toBe(true);
  });

  it('shouldApplyExternalPrompt delegates to external policy', () => {
    expect(shouldApplyExternalPrompt('', '帮我做 PPT')).toBe(true);
    expect(shouldApplyExternalPrompt('用户自己写的', '帮我做 PPT', true)).toBe(false);
  });
});
