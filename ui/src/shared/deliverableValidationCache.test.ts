import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';

const validateMock = vi.hoisted(() => vi.fn(async (_project: string, items: DeliverableItem[]) =>
  items.map((item) => ({ ...item, validationStatus: 'verified' as const })),
));

vi.mock('./validateDeliverables', () => ({
  validateDeliverablesClient: validateMock,
}));

import {
  buildDeliverableValidationCacheKey,
  clearDeliverableValidationCacheForTests,
  fetchDeliverableValidationCached,
} from './deliverableValidationCache';

const toolItem: DeliverableItem = {
  id: 'tool-html',
  path: 'index.html',
  apiPath: 'index.html',
  kind: 'html',
  source: 'tool',
};

afterEach(() => {
  clearDeliverableValidationCacheForTests();
  validateMock.mockClear();
});

describe('deliverableValidationCache', () => {
  it('dedupes concurrent validate calls for the same paths', async () => {
    const [a, b] = await Promise.all([
      fetchDeliverableValidationCached('general', [toolItem], 'artifacts/demo'),
      fetchDeliverableValidationCached('general', [toolItem], 'artifacts/demo'),
    ]);

    expect(a).toEqual(b);
    expect(validateMock).toHaveBeenCalledTimes(1);
  });

  it('builds stable cache keys regardless of item order', () => {
    const second: DeliverableItem = {
      id: 'doc',
      path: 'brief.md',
      apiPath: 'brief.md',
      kind: 'document',
      source: 'tool',
    };
    const keyA = buildDeliverableValidationCacheKey('general', [toolItem, second], 'artifacts/demo');
    const keyB = buildDeliverableValidationCacheKey('general', [second, toolItem], 'artifacts/demo');
    expect(keyA).toBe(keyB);
  });
});
