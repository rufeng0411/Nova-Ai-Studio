import { describe, expect, it } from 'vitest';

/** Mirror of useSlashCommands.shouldAutoExecute — skills slash 自动执行判定 */
function shouldAutoExecute(command: {
  metadata?: { type?: string; argumentHint?: string };
}): boolean {
  const type = command.metadata?.type;
  const hasArgHint = Boolean(command.metadata?.argumentHint);
  return !hasArgHint && (type === 'skill' || type === 'bundled-skill');
}

describe('slashCommandAutoExecute', () => {
  it('auto-runs skill without argumentHint', () => {
    expect(shouldAutoExecute({ metadata: { type: 'skill' } })).toBe(true);
    expect(shouldAutoExecute({ metadata: { type: 'bundled-skill' } })).toBe(true);
  });

  it('does not auto-run when argumentHint present', () => {
    expect(
      shouldAutoExecute({ metadata: { type: 'skill', argumentHint: '<path>' } }),
    ).toBe(false);
  });

  it('does not auto-run builtin commands', () => {
    expect(shouldAutoExecute({ metadata: { type: 'builtin' } })).toBe(false);
  });
});
