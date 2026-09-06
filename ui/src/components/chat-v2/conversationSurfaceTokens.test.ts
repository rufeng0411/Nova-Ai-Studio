import { describe, expect, it } from 'vitest';
import {
  BADGE_PULSE_CLASS,
  CONTENT_WIDTH,
  SURFACE_COMPOSER,
  SURFACE_GLASS,
  SURFACE_REFERENCES,
  SURFACE_USER_BUBBLE,
  TEXT_CONTROL,
} from './conversationSurfaceTokens';

describe('conversationSurfaceTokens', () => {
  it('exports A+D surface tokens with expected fragments', () => {
    expect(SURFACE_GLASS).toContain('nav-glass-bg');
    expect(SURFACE_GLASS).toContain('backdrop-blur');
    expect(SURFACE_COMPOSER).toContain('rounded-xl');
    expect(SURFACE_USER_BUBBLE).toContain('border-border/30');
    expect(SURFACE_REFERENCES).toContain('border-border/30');
    expect(CONTENT_WIDTH).toContain('max-w-[936px]');
    expect(TEXT_CONTROL).toContain('text-[12px]');
    expect(BADGE_PULSE_CLASS).toBe('deliverable-badge-pulse');
  });
});
