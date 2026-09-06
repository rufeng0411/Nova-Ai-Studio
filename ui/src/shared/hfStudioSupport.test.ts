import { describe, expect, it } from 'vitest';
import {
  isHfProjectPath,
  resolveHfProjectIndexPath,
  supportsHyperframesStudioEdit,
  supportsHyperframesStudioView,
} from './hfStudioSupport';

describe('hfStudioSupport', () => {
  it('detects hf-project paths', () => {
    expect(isHfProjectPath('artifacts/task-20260726-abc12345/hf-project/index.html')).toBe(true);
  });

  it('supports view for promo in task dir without siblings loaded', () => {
    expect(
      supportsHyperframesStudioView('promo.mp4', 'artifacts/task-20260726-abc12345/promo.mp4'),
    ).toBe(true);
  });

  it('supports edit for hf-project html', () => {
    expect(
      supportsHyperframesStudioEdit(
        'index.html',
        'artifacts/task-20260726-abc12345/hf-project/index.html',
      ),
    ).toBe(true);
  });

  it('resolves index path from promo', () => {
    expect(
      resolveHfProjectIndexPath('artifacts/task-20260726-abc12345/promo.mp4'),
    ).toBe('artifacts/task-20260726-abc12345/hf-project/index.html');
  });
});
