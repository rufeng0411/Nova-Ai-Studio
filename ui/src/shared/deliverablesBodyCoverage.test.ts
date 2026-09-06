import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import { assessDeliverablesBodyCoverage } from './deliverablesBodyCoverage';

function item(path: string): DeliverableItem {
  return {
    id: path,
    path,
    apiPath: path,
    kind: 'document',
    source: 'tool',
  };
}

describe('assessDeliverablesBodyCoverage', () => {
  it('detects when all files are named in body', () => {
    const result = assessDeliverablesBodyCoverage(
      '报告已写好，见 `artifacts/report.md` 与 `artifacts/slides/page.html`。',
      [item('artifacts/report.md'), item('artifacts/slides/page.html')],
    );
    expect(result.bodyListsAllFiles).toBe(true);
    expect(result.mentionedInBodyCount).toBe(2);
  });

  it('returns false when body omits a deliverable', () => {
    const result = assessDeliverablesBodyCoverage(
      '见 `artifacts/report.md`',
      [item('artifacts/report.md'), item('artifacts/extra.png')],
    );
    expect(result.bodyListsAllFiles).toBe(false);
  });

  it('matches by basename when body uses shortened path', () => {
    const result = assessDeliverablesBodyCoverage(
      '文件：report.md',
      [item('artifacts/geo/report.md')],
    );
    expect(result.bodyListsAllFiles).toBe(true);
  });
});
