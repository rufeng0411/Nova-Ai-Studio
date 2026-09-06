import { describe, expect, it } from 'vitest';
import {
  validateHfStudioProjectDir,
  validateHfStudioRenderPath,
} from '../storage/hfStudioWritePolicy.js';

describe('hfStudioRenderPathGuard', () => {
  it('rejects project dir outside hf-project', () => {
    expect(validateHfStudioProjectDir('artifacts/task-20260726-abc12345').ok).toBe(false);
  });

  it('accepts hf-project dir and promo output', () => {
    const projectDir = 'artifacts/task-20260726-abc12345/hf-project';
    expect(validateHfStudioProjectDir(projectDir).ok).toBe(true);
    const render = validateHfStudioRenderPath(
      projectDir,
      'artifacts/task-20260726-abc12345/promo.mp4',
    );
    expect(render.ok).toBe(true);
    expect(render.taskRoot).toBe('artifacts/task-20260726-abc12345');
  });

  it('rejects output outside task dir', () => {
    const projectDir = 'artifacts/task-20260726-abc12345/hf-project';
    expect(
      validateHfStudioRenderPath(projectDir, 'artifacts/task-other/promo.mp4').ok,
    ).toBe(false);
  });
});
