import { describe, expect, it, vi } from 'vitest';
import { resolveProjectInlineMediaUrl } from './projectInlineMediaUrl';

vi.mock('../utils/api', () => ({
  api: {
    projectPreviewUrl: vi.fn((project: string, path: string) => `/preview/${project}/${path}`),
    fileContentUrl: vi.fn((project: string, path: string) => `/content/${project}/${path}`),
  },
}));

describe('resolveProjectInlineMediaUrl', () => {
  it('uses content URL for raster images', () => {
    expect(resolveProjectInlineMediaUrl('general', 'artifacts/a.png', 'a.png', '/root')).toBe(
      '/content/general/artifacts/a.png',
    );
  });

  it('uses preview URL for HTML', () => {
    expect(resolveProjectInlineMediaUrl('general', 'index.html', 'index.html', '/root')).toBe(
      '/preview/general/index.html',
    );
  });

  it('uses content URL for video and pdf', () => {
    expect(resolveProjectInlineMediaUrl('general', 'clip.mp4', 'clip.mp4', '/root')).toBe(
      '/content/general/clip.mp4',
    );
    expect(resolveProjectInlineMediaUrl('general', 'spec.pdf', 'spec.pdf', '/root')).toBe(
      '/content/general/spec.pdf',
    );
  });

  it('returns empty URL for markdown (in-app renderer only)', () => {
    expect(resolveProjectInlineMediaUrl('general', 'artifacts/brief.md', 'brief.md', '/root', 'document')).toBe('');
  });
});
