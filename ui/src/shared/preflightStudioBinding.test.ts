// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCustomStyleLaunchContext, buildLaunchContextXml } from './preflightSelection';

describe('preflight binding', () => {
  it('builds slot-scoped launch-context', () => {
    const xml = buildLaunchContextXml({
      capability: 'ppt-master',
      slotId: 'stage_landing',
      selections: {
        canvas: { id: 'ppt169', label: '16:9' },
        style: { id: 'swiss-minimal', label: '瑞士极简' },
      },
    });
    expect(xml).toContain('slotId="stage_landing"');
    expect(xml).toContain('<canvas id="ppt169"');
    expect(xml).toContain('跳过模板问卷');
  });

  it('builds custom-style launch-context without template selections', () => {
    const xml = buildCustomStyleLaunchContext({
      capability: 'open-design',
      slotId: 'stage_landing',
    });
    expect(xml).toContain('preflight="custom"');
    expect(xml).toContain('slotId="stage_landing"');
    expect(xml).toContain('跳过模板选择');
    expect(xml).not.toContain('<selections>');
  });
});
