import { describe, expect, it } from 'vitest';
import {
  isHfStudioWritePath,
  validateHfStudioRenderPath,
  validateHfStudioWrite,
} from './hfStudioWritePolicy.js';

describe('hfStudioWritePolicy', () => {
  it('allows hf-project html/css/js', () => {
    expect(isHfStudioWritePath('artifacts/task-20260726-abc12345/hf-project/index.html')).toBe(true);
    expect(isHfStudioWritePath('artifacts/task-20260726-abc12345/hf-project/main.js')).toBe(true);
  });

  it('rejects promo.mp4 put', () => {
    expect(isHfStudioWritePath('artifacts/task-20260726-abc12345/promo.mp4')).toBe(false);
  });

  it('validates render paths', () => {
    const result = validateHfStudioRenderPath(
      'artifacts/task-20260726-abc12345/hf-project',
      'artifacts/task-20260726-abc12345/promo.mp4',
    );
    expect(result.ok).toBe(true);
  });

  it('validates write size', () => {
    expect(validateHfStudioWrite('x'.repeat(100)).ok).toBe(true);
  });
});
