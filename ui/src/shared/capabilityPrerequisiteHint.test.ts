import { describe, expect, it } from 'vitest';
import {
  appendCapabilityPrerequisiteHint,
  capabilityNeedsPrerequisiteHint,
  capabilityPrerequisiteHint,
} from './capabilityPrerequisiteHint';

describe('capabilityPrerequisiteHint', () => {
  it('flags PPT and doc slugs', () => {
    expect(capabilityNeedsPrerequisiteHint('anth-pptx')).toBe(true);
    expect(capabilityNeedsPrerequisiteHint('anth-docx')).toBe(true);
    expect(capabilityNeedsPrerequisiteHint('pd-geo')).toBe(false);
  });

  it('returns zh hint for ppt slug', () => {
    const hint = capabilityPrerequisiteHint('anth-pptx', 'zh-CN');
    expect(hint).toMatch(/源文件|直接开始做/);
  });

  it('appends hint once to description', () => {
    const out = appendCapabilityPrerequisiteHint('简介', 'anth-pptx', 'zh-CN');
    expect(out).toContain('简介');
    expect(out).toMatch(/源文件/);
    expect(appendCapabilityPrerequisiteHint(out, 'anth-pptx', 'zh-CN')).toBe(out);
  });
});
