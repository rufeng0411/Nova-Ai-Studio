import { describe, expect, it } from 'vitest';
import {
  dedupeReferenceAttachments,
  parseUserMessageReferences,
  pathsToReferenceAttachments,
  resolveUserMessageAttachments,
} from './referenceMaterials';

describe('referenceMaterials', () => {
  it('converts @ reference paths to attachment cards', () => {
    const attachments = pathsToReferenceAttachments(['artifacts/demo/report.md']);
    expect(attachments).toEqual([
      {
        name: 'report.md',
        path: 'artifacts/demo/report.md',
        mimeType: 'text/markdown',
      },
    ]);
  });

  it('parses reference intent and attachment notes from stored user content', () => {
    const content = [
      '请分析这份报告',
      '',
      '[用户已通过 @ 引用以下项目文件，请先 read_file 阅读再执行任务：]',
      '- artifacts/demo/report.md',
      '',
      '[Files attached by user and available for reading in the project:]',
      '- brief.pdf: artifacts/demo/brief.pdf',
    ].join('\n');

    const parsed = parseUserMessageReferences(content);
    expect(parsed.content).toBe('请分析这份报告');
    expect(parsed.attachments).toHaveLength(2);
    expect(parsed.attachments.map((item) => item.path)).toEqual([
      'artifacts/demo/brief.pdf',
      'artifacts/demo/report.md',
    ]);
  });

  it('merges explicit attachments with parsed references', () => {
    const merged = resolveUserMessageAttachments({
      content: '继续',
      attachments: [{ name: 'brief.pdf', path: 'artifacts/demo/brief.pdf' }],
    });
    expect(merged).toHaveLength(1);
    expect(dedupeReferenceAttachments([
      { name: 'brief.pdf', path: 'artifacts/demo/brief.pdf' },
      { name: 'brief.pdf', path: 'artifacts/demo/brief.pdf' },
    ])).toHaveLength(1);
  });
});
