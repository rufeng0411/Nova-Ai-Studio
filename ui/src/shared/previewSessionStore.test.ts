import { describe, expect, it } from 'vitest';
import {
  getPreviewSessionState,
  setPreviewSessionState,
} from './previewSessionStore';

describe('previewSessionStore', () => {
  it('shares document canvas state by preview session key', () => {
    const key = 'general::artifacts/report.pdf::report.pdf';
    setPreviewSessionState(key, { pageIndex: 2, zoomMode: '125' });
    setPreviewSessionState(key, { railMode: 'grid' });

    expect(getPreviewSessionState(key)).toEqual({
      pageIndex: 2,
      zoomMode: '125',
      railMode: 'grid',
    });
    expect(getPreviewSessionState(`${key}::other`)).toEqual({
      pageIndex: 0,
      zoomMode: 'fitPage',
      railMode: 'strip',
    });
  });
});
