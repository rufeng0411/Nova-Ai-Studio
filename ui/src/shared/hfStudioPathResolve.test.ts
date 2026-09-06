import { describe, expect, it } from 'vitest';
import {
  resolveHfProjectDir,
  resolvePromoPathForTaskDir,
  resolveHfProjectDirFromApiPath,
} from './hfStudioPathResolve';

describe('hfStudioPathResolve', () => {
  it('resolves hf-project dir from task dir', () => {
    expect(resolveHfProjectDir('artifacts/task-20260726-abc12345')).toBe(
      'artifacts/task-20260726-abc12345/hf-project',
    );
  });

  it('resolves promo path', () => {
    expect(resolvePromoPathForTaskDir('artifacts/task-20260726-abc12345')).toBe(
      'artifacts/task-20260726-abc12345/promo.mp4',
    );
  });

  it('resolves project dir from api path', () => {
    expect(
      resolveHfProjectDirFromApiPath('artifacts/task-20260726-abc12345/promo.mp4'),
    ).toBe('artifacts/task-20260726-abc12345/hf-project');
  });
});
