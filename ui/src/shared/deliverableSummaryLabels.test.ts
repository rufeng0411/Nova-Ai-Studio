import { describe, expect, it } from 'vitest';
import {
  formatDeliverableLinkPath,
  parseDeliverableLabelsFromAssistantText,
  resolveDeliverableDisplayName,
} from './deliverableSummaryLabels';

describe('deliverableSummaryLabels', () => {
  it('parses markdown table name and file columns', () => {
    const map = parseDeliverableLabelsFromAssistantText([
      '| 说明 | 文件 |',
      '| --- | --- |',
      '| 审计清单 | audit-checklist.md |',
      '| 汇报网页 | report.html |',
    ].join('\n'));

    expect(resolveDeliverableDisplayName('artifacts/geo/audit-checklist.md', 'document', map)).toBe('审计清单');
    expect(resolveDeliverableDisplayName('report.html', 'html', map)).toBe('汇报网页');
  });

  it('parses three-column deliverable summary table from assistant text', () => {
    const map = parseDeliverableLabelsFromAssistantText([
      '| 交付物名称 | 文件名 | 文件链接 |',
      '| --- | --- | --- |',
      '| 审计清单 | audit-checklist.md | /artifacts/geo/吴裕泰/audit-checklist.md |',
    ].join('\n'));

    expect(resolveDeliverableDisplayName('artifacts/geo/吴裕泰/audit-checklist.md', 'document', map)).toBe('审计清单');
  });

  it('parses new summary table with 文件类型 column without mis-binding', () => {
    const map = parseDeliverableLabelsFromAssistantText([
      '| 交付物名称 | 文件类型 | 文件链接 |',
      '| --- | --- | --- |',
      '| 中英双语关键词矩阵 | Markdown | /artifacts/geo/nike-worldcup-2026/keywords.md |',
      '| 1 | Markdown | /artifacts/geo/nike-worldcup-2026/aeo-audit.md |',
      '| 5 | Markdown | /artifacts/geo/nike-worldcup-2026/optimized.md |',
    ].join('\n'));

    expect(resolveDeliverableDisplayName('artifacts/geo/nike-worldcup-2026/keywords.md', 'document', map)).toBe('中英双语关键词矩阵');
    expect(resolveDeliverableDisplayName('artifacts/geo/nike-worldcup-2026/aeo-audit.md', 'document', map)).toBe('AEO 审计');
    expect(resolveDeliverableDisplayName('artifacts/geo/nike-worldcup-2026/optimized.md', 'document', map)).toBe('优化主稿');
  });

  it('parses inline title before filename', () => {
    const map = parseDeliverableLabelsFromAssistantText('关键词清单：keywords.md');
    expect(resolveDeliverableDisplayName('artifacts/geo/吴裕泰/keywords.md', 'document', map)).toBe('关键词清单');
  });

  it('parses filename with parenthetical title', () => {
    const map = parseDeliverableLabelsFromAssistantText('已写入 optimized.md（优化主稿）');
    expect(resolveDeliverableDisplayName('artifacts/geo/吴裕泰/optimized.md', 'document', map)).toBe('优化主稿');
  });

  it('uses pd-geo standard titles when assistant text has no table', () => {
    const map = parseDeliverableLabelsFromAssistantText('');
    const geoDir = 'artifacts/geo/吴裕泰';

    expect(resolveDeliverableDisplayName(`${geoDir}/audit-checklist.md`, 'document', map)).toBe('审计清单');
    expect(resolveDeliverableDisplayName(`${geoDir}/keywords.md`, 'document', map)).toBe('关键词与验证问句');
    expect(resolveDeliverableDisplayName(`${geoDir}/optimized.md`, 'document', map)).toBe('优化主稿');
    expect(resolveDeliverableDisplayName(`${geoDir}/schema.jsonld`, 'document', map)).toBe('结构化数据');
    expect(resolveDeliverableDisplayName(`${geoDir}/score-estimate.md`, 'document', map)).toBe('评分评估');
  });

  it('prefixes brand name for geo report deliverables', () => {
    const map = parseDeliverableLabelsFromAssistantText('');
    expect(resolveDeliverableDisplayName('artifacts/geo/吴裕泰/report.md', 'document', map)).toBe('吴裕泰摘要报告');
    expect(resolveDeliverableDisplayName('artifacts/geo/吴裕泰/visibility-report.html', 'html', map)).toBe('吴裕泰可见度周报');
  });

  it('formats project-relative link paths with leading slash', () => {
    expect(formatDeliverableLinkPath('artifacts/wuyutai/NN.html')).toBe('/artifacts/wuyutai/NN.html');
  });
});
