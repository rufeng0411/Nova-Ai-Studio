import { describe, expect, it } from 'vitest';
import {
  isEnglishProcessNarration,
  stripEnglishProcessNarration,
} from './englishProcessNarration';

describe('englishProcessNarration', () => {
  it('detects common English process narration leaks', () => {
    expect(isEnglishProcessNarration('The user wants a marketing deck')).toBe(true);
    expect(isEnglishProcessNarration("Now I'll write the final deliverable now:")).toBe(true);
    expect(isEnglishProcessNarration('Now I will verify the build.')).toBe(true);
    expect(isEnglishProcessNarration('Let me check the directory structure first.')).toBe(true);
  });

  it('does not flag normal Chinese assistant replies', () => {
    expect(isEnglishProcessNarration('好的，以下是 GTM 执行方案。')).toBe(false);
    expect(isEnglishProcessNarration('文件已生成：report.html')).toBe(false);
  });

  it('strips English-only bubbles in zh locale mode', () => {
    expect(stripEnglishProcessNarration("Now I'll write the final deliverable now:", true)).toBe('');
    expect(stripEnglishProcessNarration('Now I will verify the build.', true)).toBe('');
  });

  it('preserves English bubbles when localeIsZh is false', () => {
    const text = "Now I'll write the final deliverable now:";
    expect(stripEnglishProcessNarration(text, false)).toBe(text);
  });

  it('strips English lines but keeps Chinese lines in mixed content', () => {
    const text = [
      '好的，我开始写 HTML 报告。',
      "Now I'll write the final deliverable now:",
      '请稍后在成果区查看。',
    ].join('\n');
    const result = stripEnglishProcessNarration(text, true);
    expect(result).toContain('好的，我开始写 HTML 报告。');
    expect(result).toContain('请稍后在成果区查看。');
    expect(result).not.toContain('final deliverable');
  });

  it('does not strip substantive first-ack English lines', () => {
    expect(stripEnglishProcessNarration('I will inspect files first.', true)).toBe(
      'I will inspect files first.',
    );
    expect(stripEnglishProcessNarration('I will make a plan first.', true)).toBe(
      'I will make a plan first.',
    );
  });
});
