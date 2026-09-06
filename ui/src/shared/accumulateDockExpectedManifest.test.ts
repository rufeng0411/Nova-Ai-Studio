import { describe, expect, it } from 'vitest';
import { accumulateDockExpectedManifest } from './accumulateDockExpectedManifest';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { DeliverableItem } from './collectDeliverables';

describe('accumulateDockExpectedManifest', () => {
  it('adds HTML deliverable after markdown SDM slot (0707-3 jl3 scenario)', () => {
    const base: ExpectedManifestEntry[] = [{
      id: 'required_markdown_1',
      label: '调研报告',
      kind: 'markdown',
      path: 'artifacts/jl3-world-opinion-deep-dive-20260707.md',
      status: 'done',
    }];

    const sessionDeliverables: DeliverableItem[] = [
      {
        id: 'md',
        path: 'artifacts/jl3-world-opinion-deep-dive-20260707.md',
        apiPath: 'artifacts/jl3-world-opinion-deep-dive-20260707.md',
        kind: 'document',
        source: 'tool',
      },
      {
        id: 'html',
        path: 'artifacts/index.html',
        apiPath: 'artifacts/index.html',
        kind: 'html',
        source: 'tool',
      },
    ];

    const accumulated = accumulateDockExpectedManifest(base, sessionDeliverables);
    expect(accumulated).toHaveLength(2);
    expect(accumulated.some((entry) => entry.path?.includes('index.html'))).toBe(true);
  });

  it('does not duplicate when session item already covered by SDM slot kind', () => {
    const base: ExpectedManifestEntry[] = [{
      id: 'required_markdown_1',
      kind: 'markdown',
      label: '报告',
    }];
    const sessionDeliverables: DeliverableItem[] = [{
      id: 'md',
      path: 'artifacts/report.md',
      apiPath: 'artifacts/report.md',
      kind: 'document',
      source: 'tool',
    }];

    expect(accumulateDockExpectedManifest(base, sessionDeliverables)).toHaveLength(1);
  });

  it('lockBaseline keeps SDM row count stable when verified paths arrive mid-task', () => {
    const base: ExpectedManifestEntry[] = [
      { id: 'profile_geo_1', label: '审计清单', kind: 'markdown', path: 'geo-aeo-audit-checklist.md' },
      { id: 'profile_geo_2', label: '关键词', kind: 'markdown', path: 'keywords-research.md' },
    ];
    const verified = [
      'artifacts/razer-blade/audit-checklist.md',
      'artifacts/razer-blade/keywords.md',
      'artifacts/razer-blade/extra-report.md',
    ];
    const locked = accumulateDockExpectedManifest(base, [], verified, { lockBaseline: true });
    expect(locked).toHaveLength(2);
    const unlocked = accumulateDockExpectedManifest(base, [], verified);
    expect(unlocked.length).toBeGreaterThan(2);
  });

  it('lockBaseline still adds cross-format verified HTML after frozen md slots (ES9 battlecard)', () => {
    const base: ExpectedManifestEntry[] = [
      { id: 'slot_1', label: 'intel.md', kind: 'markdown', path: 'artifacts/task/intel.md' },
      { id: 'slot_2', label: 'battlecard.md', kind: 'markdown', path: 'artifacts/task/battlecard.md' },
      { id: 'slot_3', label: 'talk-track.md', kind: 'markdown', path: 'artifacts/task/talk-track.md' },
    ];
    const verified = [
      'artifacts/task/intel.md',
      'artifacts/task/battlecard.md',
      'artifacts/task/talk-track.md',
      'artifacts/task/蔚来ES9-销售Battlecard全链路报告.html',
    ];
    const locked = accumulateDockExpectedManifest(base, [], verified, { lockBaseline: true });
    expect(locked).toHaveLength(4);
    expect(locked.some((entry) => entry.path?.endsWith('.html'))).toBe(true);
  });

  it('0708-10: template pathHint slot + 3 verified md → 4 rows (I2)', () => {
    const base: ExpectedManifestEntry[] = [{
      id: 'required_markdown_1',
      kind: 'markdown',
      label: '广告模板',
      path: 'skills/mkt-ads/references/ad-copy-templates.md',
    }];
    const verified = [
      'artifacts/01-topics.md',
      'artifacts/02-calendar.md',
      'artifacts/03-distribution.md',
    ];
    const accumulated = accumulateDockExpectedManifest(base, [], verified);
    expect(accumulated).toHaveLength(4);
    expect(accumulated.filter((entry) => entry.path?.endsWith('.md'))).toHaveLength(4);
  });

  it('lockBaseline rejects VAP png/json phantom rows (DeepSeek competitor RCA)', () => {
    const base: ExpectedManifestEntry[] = [
      { id: 'slot_1', label: '竞品对标报告', kind: 'markdown', path: 'competitor-benchmark-report.md' },
      { id: 'universal_data_sources', label: '数据来源', kind: 'markdown', path: 'data-sources.md' },
    ];
    const verified = [
      'artifacts/task-20260725-6ca341f6/competitor-benchmark-report.md',
      'artifacts/task-20260725-6ca341f6/data-sources.md',
      'artifacts/task-20260725-6ca341f6/assets/prepared/deepseek-report_inline.png',
      'artifacts/task-20260725-6ca341f6/visual-asset-manifest.json',
      'artifacts/task-20260725-6ca341f6/index-preview.png',
    ];
    const locked = accumulateDockExpectedManifest(base, [], verified, { lockBaseline: true });
    expect(locked).toHaveLength(2);
  });
});
