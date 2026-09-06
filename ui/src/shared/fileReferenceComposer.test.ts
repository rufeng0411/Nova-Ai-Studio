import { describe, expect, it } from 'vitest';
import { isValidReferencePath, splitPromptAndLegacyReferencePaths } from './fileReferenceComposer';

describe('isValidReferencePath', () => {
  it('accepts nested project paths and project-root files', () => {
    expect(isValidReferencePath('artifacts/report.pdf')).toBe(true);
    expect(isValidReferencePath('index.html')).toBe(true);
    expect(isValidReferencePath('research-report.md')).toBe(true);
    expect(isValidReferencePath('hello')).toBe(false);
  });

  it('rejects prose slash phrases from process templates', () => {
    expect(isValidReferencePath('skills/；每步')).toBe(false);
    expect(isValidReferencePath('生图/生视频或外部')).toBe(false);
    expect(isValidReferencePath('生图/生视频')).toBe(false);
  });
});

describe('splitPromptAndLegacyReferencePaths', () => {
  it('does not treat template resilience prose as file references', () => {
    const snippet =
      '禁止 read_file skills/；每步 write_file 落盘后再进下一步。若评分、联网、生图/生视频或外部 Key 不可用，按对应技能 resilience 降级仍交付清单文件，不要中断。';
    const { paths } = splitPromptAndLegacyReferencePaths(snippet);
    expect(paths).toEqual([]);
  });
  it('splits legacy path block from prompt body', () => {
    const input = [
      'artifacts/nio-es9-review/report.html artifacts/nio-es9-review/蔚来ES9.pdf',
      '',
      '用「Nova-竞品对标」对【品类】做竞品全量对标。',
    ].join('\n');

    const { prompt, paths } = splitPromptAndLegacyReferencePaths(input);
    expect(paths).toHaveLength(2);
    expect(prompt).toContain('Nova-竞品对标');
    expect(prompt).not.toContain('artifacts/');
  });
});
