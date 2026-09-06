import { describe, expect, it } from 'vitest';
import { detectTurnKpis } from './parseExportHtmlFourLine.mjs';

describe('detectTurnKpis', () => {
  it('flags a mismatch between contractSnapshot.rowsHash and certificate hash', () => {
    const kpis = detectTurnKpis({
      turnAcceptanceMeta: {
        contractSnapshot: {
          rowsHash: 'rows-hash-a',
        },
        acceptanceCertificate: {
          contractHash: 'certificate-hash-b',
          slots: [],
        },
      },
    });

    expect(kpis.hash_mismatch).toBe(1);
  });

  it('flags duplicate evidence bound to two units in one count slot', () => {
    const duplicatePath = 'artifacts/task/articles/article-a.md';
    const kpis = detectTurnKpis({
      turnAcceptanceMeta: {
        acceptanceCertificate: {
          contractHash: 'contract',
          units: [
            { unitId: 'articles__1', slotId: 'articles' },
            { unitId: 'articles__2', slotId: 'articles' },
          ],
          slots: [{
            slotId: 'articles',
            requiredCount: 2,
            matchedCount: 2,
            resolvedPaths: [duplicatePath, duplicatePath],
          }],
        },
      },
    });

    expect(kpis.slot_collision).toBeGreaterThan(0);
  });
});
