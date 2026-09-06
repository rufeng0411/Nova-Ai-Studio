import { describe, expect, it } from 'vitest';
import { resolveAudienceMode, shouldFoldCodeForAudience, humanizeToolLabel } from './audienceMode';

describe('audienceMode', () => {
  it('defaults to non_technical when slug missing', () => {
    expect(resolveAudienceMode({})).toBe('non_technical');
    expect(shouldFoldCodeForAudience('non_technical')).toBe(true);
  });

  it('technical for development category', () => {
    expect(resolveAudienceMode({ majorCategory: 'development' })).toBe('technical');
    expect(shouldFoldCodeForAudience('technical')).toBe(false);
  });

  it('humanizes bash for non_technical', () => {
    expect(humanizeToolLabel('bash', 'non_technical')).toBe('处理数据');
  });
});
