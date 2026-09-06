import { describe, expect, it } from 'vitest';
import { buildToolStepDetailSummary } from './processNarrative';

describe('buildToolStepDetailSummary', () => {
  it('summarizes web_search query without leaking long text', () => {
    const detail = buildToolStepDetailSummary('web_search', { query: '北京 AI 产业 2026' });
    expect(detail).toBe('搜索：北京 AI 产业 2026');
  });

  it('summarizes web_fetch host only', () => {
    const detail = buildToolStepDetailSummary('web_fetch', {
      url: 'https://www.example.com/path/to/page',
    });
    expect(detail).toBe('打开网页：example.com');
  });

  it('summarizes write_file basename only', () => {
    const detail = buildToolStepDetailSummary('write_file', {
      file_path: 'artifacts/task-20260716-abc/report.md',
    });
    expect(detail).toBe('写入：report.md');
  });

  it('does not expose bash command bodies', () => {
    const detail = buildToolStepDetailSummary('bash', {
      command: 'curl -s https://secret/internal | jq .',
    });
    expect(detail).toBeUndefined();
  });
});
