import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../utils/api';
import {
  buildExportDeliverableAccess,
  buildExportDeliverableAccessMap,
  buildTaskFolderSnapshotUrl,
  exportAccessMapKey,
  renderExportAccessLinksHtml,
} from './exportDeliverableAccessUrls';

vi.mock('../utils/api', () => ({
  authenticatedFetch: vi.fn(),
}));

describe('exportDeliverableAccessUrls', () => {
  afterEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
  });

  it('builds resolve/content/preview URLs with absolute origin', () => {
    const access = buildExportDeliverableAccess({
      projectName: 'general',
      path: 'artifacts/report.md',
      hintDir: 'artifacts/faq-dutch-goji',
      resolvedPath: 'artifacts/faq-dutch-goji/report.md',
      exportOrigin: 'https://www.novapage.online',
    });

    expect(access.resolveUrl).toContain('/api/projects/general/file/resolve');
    expect(access.resolveUrl).toContain('hintDir=artifacts%2Ffaq-dutch-goji');
    expect(access.contentUrl).toContain('/api/projects/general/files/content');
    expect(access.contentUrl).toContain('path=artifacts%2Ffaq-dutch-goji%2Freport.md');
    expect(access.absoluteContentUrl).toBe(
      'https://www.novapage.online/api/projects/general/files/content?path=artifacts%2Ffaq-dutch-goji%2Freport.md',
    );
    expect(access.apiPath).toBe('artifacts/faq-dutch-goji/report.md');
  });

  it('renders access link html with apiPath and resolve', () => {
    const access = buildExportDeliverableAccess({
      projectName: 'general',
      path: 'artifacts/report.md',
      exportOrigin: 'https://example.test',
    });
    const html = renderExportAccessLinksHtml(access);
    expect(html).toContain('class="access-links"');
    expect(html).toContain('apiPath');
    expect(html).toContain('resolve');
    expect(html).toContain('https://example.test/api/projects/general/files/content');
  });

  it('builds task-folder-snapshot API path', () => {
    const url = buildTaskFolderSnapshotUrl('general', 'artifacts/faq-dutch-goji/');
    expect(url).toBe(
      '/api/projects/general/deliverables/task-folder-snapshot?scopeDir=artifacts%2Ffaq-dutch-goji',
    );
  });

  it('dedupes access map keys by path and hintDir', () => {
    expect(exportAccessMapKey('Artifacts/Report.MD', 'artifacts/foo'))
      .toBe(exportAccessMapKey('artifacts/report.md', 'artifacts/foo'));
  });

  it('caps concurrent server path resolution at three requests', async () => {
    let active = 0;
    let maxActive = 0;
    vi.mocked(authenticatedFetch).mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      active -= 1;
      return {
        ok: true,
        json: async () => ({ ok: false }),
      } as Response;
    });

    const paths = Array.from({ length: 8 }, (_, index) => ({
      path: `artifacts/task-load/file-${index}.md`,
    }));
    const result = await buildExportDeliverableAccessMap({
      projectName: 'general',
      paths,
      resolveOnServer: true,
    });

    expect(result.size).toBe(8);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
