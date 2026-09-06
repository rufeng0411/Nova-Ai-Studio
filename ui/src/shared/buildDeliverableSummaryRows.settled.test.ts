import { describe, expect, it } from 'vitest';
import { buildDeliverableSummaryRows } from './buildDeliverableSummaryRows';

describe('buildDeliverableSummaryRows validationSettled', () => {
  const turnDir = 'artifacts/slides-test';

  it('manifest pending + settled → missing not checking', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ path: `${turnDir}/slide-01.png`, label: 'p1' }],
      turnArtifactDir: turnDir,
      validationSettled: true,
      validatedItems: [{
        id: '1',
        path: `${turnDir}/slide-01.png`,
        apiPath: `${turnDir}/slide-01.png`,
        kind: 'image',
        source: 'tool',
        validationStatus: 'pending',
      }],
    });
    expect(rows[0].status).toBe('missing');
  });

  it('manifest pending + unsettled → checking', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ path: `${turnDir}/slide-01.png`, label: 'p1' }],
      turnArtifactDir: turnDir,
      validationSettled: false,
      validatedItems: [{
        id: '1',
        path: `${turnDir}/slide-01.png`,
        apiPath: `${turnDir}/slide-01.png`,
        kind: 'image',
        source: 'tool',
        validationStatus: 'pending',
      }],
    });
    expect(rows[0].status).toBe('checking');
  });

  it('fd7c166c: verifiedPaths hit → delivered even when unsettled', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ path: `${turnDir}/index.html`, label: 'index' }],
      turnArtifactDir: turnDir,
      validationSettled: false,
      verifiedPaths: [`${turnDir}/index.html`],
      validatedItems: [{
        id: '1',
        path: `${turnDir}/index.html`,
        apiPath: `${turnDir}/index.html`,
        kind: 'html',
        source: 'tool',
        validationStatus: 'pending',
      }],
    });
    expect(rows[0].status).toBe('delivered');
  });
});
