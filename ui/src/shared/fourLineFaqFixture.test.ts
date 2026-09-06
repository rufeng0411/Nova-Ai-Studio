import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/four-line-faq-dutch-goji.json';
import { toProjectApiPath, extractDeliverablePathsFromText } from './artifactPaths';
import { compileDeliverableSlotPath } from '../../shared/deliverablePathResolve.mjs';
import { buildDeliverableSummaryRows } from './buildDeliverableSummaryRows';

describe('four-line FAQ dutch goji fixture (9fee0532)', () => {
  it('aligns body, SDM compile, and API path without geo prefix', () => {
    const turnDir = fixture.turnArtifactDir;
    const compiled = compileDeliverableSlotPath(fixture.sdmPathHint, turnDir);
    const apiPath = toProjectApiPath(fixture.sdmPathHint, undefined, { hintDir: turnDir });
    const bodyPaths = extractDeliverablePathsFromText(
      `成果在 \`${fixture.bodyLinkPath}\``,
    );

    expect(compiled).toBe(fixture.writePath);
    expect(apiPath).toBe(fixture.writePath);
    expect(bodyPaths).toContain(fixture.writePath);
    expect(compiled).not.toBe(fixture.wrongExpandedPath);
    expect(apiPath).not.toContain('artifacts/geo/');
  });

  it('summary row matches verified write path', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{
        id: 'faq_index',
        label: 'index',
        kind: 'html',
        path: fixture.sdmPathHint,
        status: 'done',
      }],
      turnArtifactDir: fixture.turnArtifactDir,
      scopeDir: fixture.turnArtifactDir,
      verifiedPaths: [fixture.writePath],
      validatedItems: [{
        id: 'tool',
        path: fixture.writePath,
        apiPath: fixture.writePath,
        resolvedPath: fixture.writePath,
        kind: 'html',
        source: 'tool',
        validationStatus: 'verified',
      }],
      validationSettled: true,
    });

    expect(rows[0]?.resolvedPath).toBe(fixture.writePath);
    expect(rows[0]?.linkable).toBe(true);
  });
});
