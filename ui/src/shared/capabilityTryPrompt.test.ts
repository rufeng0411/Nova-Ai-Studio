import { describe, expect, it } from 'vitest';
import { inferTopicFromReferencePaths, personalizeCapabilityTryPrompt } from './capabilityTryPrompt';

describe('capabilityTryPrompt', () => {
  it('replaces 【主题】 from Chinese filename', () => {
    const prompt = '用「Nova-美学幻灯」把【主题】做成【页数，如 4】页【画幅，如 16:9】配图 PNG 幻灯';
    const paths = ['artifacts/nio-es9-review/蔚来ES9万里越雄关复盘报告.pdf'];
    const result = personalizeCapabilityTryPrompt(prompt, paths, 'nova-ppt-aesthetic-slides');
    expect(result).toContain('蔚来ES9万里越雄关复盘');
    expect(result).not.toContain('【主题】');
    expect(result).toContain('4页16:9');
  });

  it('infers page count from existing slide PNGs for Nova', () => {
    const prompt = '把【主题】做成【页数，如 4】页【画幅，如 16:9】';
    const paths = [
      'artifacts/slides-demo/slide-01.png',
      'artifacts/slides-demo/slide-02.png',
      'artifacts/slides-demo/slide-03.png',
    ];
    const result = personalizeCapabilityTryPrompt(prompt, paths, 'nova-ppt-aesthetic-slides');
    expect(result).toContain('3页16:9');
  });

  it('infers topic from artifacts folder slug', () => {
    expect(inferTopicFromReferencePaths(['artifacts/nio-es9-review/report.md'])).toBe('nio es9 review');
  });

  it('replaces 【品类】 from Chinese filename', () => {
    const prompt = '用「Nova-竞品对标」对【品类】做竞品全量对标';
    const paths = ['artifacts/nio-es9-review/蔚来ES9万里越雄关复盘报告.pdf'];
    expect(personalizeCapabilityTryPrompt(prompt, paths)).toContain('蔚来ES9万里越雄关复盘');
    expect(personalizeCapabilityTryPrompt(prompt, paths)).not.toContain('【品类】');
  });
});
