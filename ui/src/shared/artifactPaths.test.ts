import { describe, expect, it } from 'vitest';
import {
  classifyDeliverablePath,
  coerceDeliverablePathFromHref,
  extractDeliverablePathsFromText,
  extractExternalUrlsFromText,
  isLikelyDeliverablePath,
  isSpaAppHref,
  normalizeArtifactPath,
  parsePilotdeckLink,
  parseProjectApiFileLink,
  toProjectApiPath,
} from './artifactPaths';

describe('artifactPaths', () => {
  it('extracts chinese and english deliverable paths from text', () => {
    const text = [
      '文件已保存到 docs/report.md',
      'Saved to output/landing.html',
      'Also see C:\\Users\\demo\\video.mp4',
    ].join('\n');

    const paths = extractDeliverablePathsFromText(text);
    expect(paths).toContain('docs/report.md');
    expect(paths).toContain('output/landing.html');
    expect(paths).toContain('C:/Users/demo/video.mp4');
  });

  it('extracts CJK filenames without gluing surrounding prose', () => {
    const text = [
      'The 发烧硬件用户研究报告.md file has been written and cleaned up.',
      '报告（drafts/竞品分析.md）已经更新。',
      '另见 artifacts/research/用户画像-2026.md 与 final.pdf',
    ].join('\n');

    const paths = extractDeliverablePathsFromText(text);
    expect(paths).toContain('发烧硬件用户研究报告.md');
    expect(paths.some((p) => p.endsWith('drafts/竞品分析.md'))).toBe(true);
    expect(paths).toContain('artifacts/research/用户画像-2026.md');
    expect(paths).toContain('final.pdf');
    expect(paths).not.toContain('The 发烧硬件用户研究报告.md');
  });

  it('classifies common deliverable kinds', () => {
    expect(classifyDeliverablePath('a.html')).toBe('html');
    expect(classifyDeliverablePath('a.png')).toBe('image');
    expect(classifyDeliverablePath('a.mp4')).toBe('video');
    expect(classifyDeliverablePath('a.pdf')).toBe('pdf');
    expect(classifyDeliverablePath('a.md')).toBe('document');
  });

  it('extracts audio deliverables for super preview media playback', () => {
    const paths = extractDeliverablePathsFromText('讲解音频已保存到 artifacts/audio/voice-over.mp3');
    expect(paths).toContain('artifacts/audio/voice-over.mp3');
    expect(isLikelyDeliverablePath('artifacts/audio/voice-over.wav')).toBe(true);
    expect(classifyDeliverablePath('artifacts/audio/voice-over.mp3')).toBe('file');
  });

  it('extracts deliverable paths from markdown link hrefs without bracket label leakage', () => {
    const text = [
      '雷蛇近 30 天舆情简报已生成，核心发现如下：',
      '',
      '[artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md](artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md)',
    ].join('\n');
    const paths = extractDeliverablePathsFromText(text);
    expect(paths).toContain('artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md');
    expect(paths.some((p) => p.startsWith('['))).toBe(false);
    expect(paths.some((p) => p.includes('artifacts/geo/last30days'))).toBe(false);
  });

  it('coerces markdown link hrefs in coerceDeliverablePathFromHref', () => {
    expect(
      coerceDeliverablePathFromHref(
        'artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md',
      ),
    ).toBe('artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md');
  });

  it('coerces relative markdown hrefs to deliverable paths', () => {
    expect(coerceDeliverablePathFromHref('零度可口可乐健康影响咨询研究报告.md')).toBe(
      '零度可口可乐健康影响咨询研究报告.md',
    );
    expect(coerceDeliverablePathFromHref('/p/general')).toBeNull();
    expect(isSpaAppHref('/p/general')).toBe(true);
    expect(isSpaAppHref('http://localhost:5173/p/general/c/s1')).toBe(true);
  });

  it('detects deliverable paths with report-file label prefix', () => {
    expect(
      isLikelyDeliverablePath('📄 报告文件路径：零度可口可乐健康影响咨询研究报告.md'),
    ).toBe(true);
    expect(
      normalizeArtifactPath('📄 报告文件路径：零度可口可乐健康影响咨询研究报告.md'),
    ).toBe('零度可口可乐健康影响咨询研究报告.md');
    const paths = extractDeliverablePathsFromText(
      '📄 报告文件路径：零度可口可乐健康影响咨询研究报告.md',
    );
    expect(paths).toContain('零度可口可乐健康影响咨询研究报告.md');
  });

  it('parses project preview API links into deliverable paths', () => {
    expect(
      parseProjectApiFileLink('/api/projects/demo/preview/artifacts%2Freport.md'),
    ).toEqual({ projectName: 'demo', filePath: 'artifacts/report.md' });
    expect(
      parseProjectApiFileLink(
        '/api/projects/demo/files/content?path=artifacts%2F%E9%9B%B6%E5%BA%A6%E5%8F%AF%E5%8F%A3%E5%8F%AF%E4%B9%90.md&token=abc',
      ),
    ).toEqual({ projectName: 'demo', filePath: 'artifacts/零度可口可乐.md' });
  });

  it('does not treat skill resource URIs as deliverable paths', () => {
    expect(isLikelyDeliverablePath('diagram-maker:references:svg-template')).toBe(false);
    expect(isLikelyDeliverablePath('diagram-maker:references:svg-template.md')).toBe(false);
    expect(extractDeliverablePathsFromText('diagram-maker:references:svg-template')).toEqual([]);
    expect(coerceDeliverablePathFromHref('diagram-maker:references:svg-template.md')).toBeNull();
    expect(coerceDeliverablePathFromHref('diagram-maker:references:svg-template')).toBeNull();
    expect(coerceDeliverablePathFromHref('diagram-maker:references:svg-template.md')).toBeNull();
  });

  it('detects likely deliverable paths and pilotdeck links', () => {
    expect(isLikelyDeliverablePath('docs/report.md')).toBe(true);
    expect(isLikelyDeliverablePath('npm install')).toBe(false);
    expect(parsePilotdeckLink('pilotdeck://open/docs/page.html')).toEqual({
      action: 'open',
      path: 'docs/page.html',
    });
  });

  it('extracts external urls separately', () => {
    const urls = extractExternalUrlsFromText('参考 https://example.com/a 和 https://foo.bar/b.');
    expect(urls).toEqual(['https://example.com/a', 'https://foo.bar/b']);
    expect(normalizeArtifactPath('a\\b\\c.md')).toBe('a/b/c.md');
  });

  it('repairs Windows paths corrupted by \\r escape in username', () => {
    const corrupted = 'C:\\Users\rufen\\.pilotdeck\\index.html';
    expect(normalizeArtifactPath(corrupted)).toBe('C:/Users/rufen/.pilotdeck/index.html');
    expect(normalizeArtifactPath('C:/Users ufen/.pilotdeck/index.html')).toBe(
      'C:/Users/rufen/.pilotdeck/index.html',
    );
    expect(
      toProjectApiPath('Users ufen/.pilotdeck/index.html', 'C:/Users/rufen/.pilotdeck'),
    ).toBe('index.html');
    expect(normalizeArtifactPath('C:/Users/rufen/.pilotdeck og-nuc-2026.html')).toBe(
      'C:/Users/rufen/.pilotdeck/rog-nuc-2026.html',
    );
    expect(
      toProjectApiPath('C:/Users/rufen/.pilotdeck og-nuc-2026.html', 'C:/Users/rufen/.pilotdeck'),
    ).toBe('rog-nuc-2026.html');
  });

  it('expands shortened social-matrix deliverable paths for API', () => {
    expect(toProjectApiPath('ai-enterprise-solutions/research.md')).toBe(
      'artifacts/social-matrix/ai-enterprise-solutions/research.md',
    );
    expect(toProjectApiPath('ai-pitfall-guide/marketing-strategy.md')).toBe(
      'artifacts/social-matrix/ai-pitfall-guide/marketing-strategy.md',
    );
  });

  it('keeps React video template project paths literal', () => {
    expect(toProjectApiPath('ai-video-template/demo-preview.html')).toBe('ai-video-template/demo-preview.html');
    expect(toProjectApiPath('ai-video-template-live-2026/src/AiVideoTemplate.tsx')).toBe(
      'ai-video-template-live-2026/src/AiVideoTemplate.tsx',
    );
  });

  it('expands geo campaign paths and leaves bare filenames for server search', () => {
    expect(toProjectApiPath('hema-red-bean-corn-silk-water/keywords.md')).toBe(
      'artifacts/geo/hema-red-bean-corn-silk-water/keywords.md',
    );
    expect(toProjectApiPath('keywords.md')).toBe('keywords.md');
  });

  it('prefers artifacts/faq-* over artifacts/geo for FAQ slug paths', () => {
    expect(toProjectApiPath('faq-dutch-goji/index.html')).toBe(
      'artifacts/faq-dutch-goji/index.html',
    );
    expect(toProjectApiPath('faq-dutch-goji/index.html')).not.toContain('artifacts/geo/');
  });

  it('uses hintDir instead of geo expansion for slug deliverables', () => {
    expect(
      toProjectApiPath('faq-dutch-goji/index.html', undefined, {
        hintDir: 'artifacts/faq-dutch-goji',
      }),
    ).toBe('artifacts/faq-dutch-goji/index.html');
  });

  it('does not extract URL domain fragments as .go deliverables', () => {
    const text = '参考来源 https://xy.lf.gov.cn/path/to/page 以及 report.md';
    const paths = extractDeliverablePathsFromText(text);
    expect(paths).toContain('report.md');
    expect(paths.some((p) => p.endsWith('.go') || p.includes('lf.go'))).toBe(false);
  });

  it('keeps workspace assets paths literal for editor readFile (matches preview URL)', () => {
    expect(toProjectApiPath('assets/dashboard.html')).toBe('assets/dashboard.html');
    expect(toProjectApiPath('pages/landing.html')).toBe('pages/landing.html');
    expect(toProjectApiPath('assets/dashboard.html')).not.toContain('artifacts/geo');
  });

  it('strips SaaS cloud-storage absolute paths without artifacts/geo expansion', () => {
    const projectRoot =
      '/data/saas/tenants/default/cloud-storage/users/1/workspaces/e7478cec-3293-43e5-905f-802730187717';
    const abs = `${projectRoot}/AI安防产品竞品调研报告.md`;
    expect(toProjectApiPath(abs, projectRoot)).toBe('AI安防产品竞品调研报告.md');
    expect(toProjectApiPath(abs, projectRoot)).not.toContain('artifacts/geo');
  });

  it('keeps nested artifacts path from SaaS workspace absolute paths for export APIs', () => {
    const projectRoot =
      'F:/saas/tenants/default/cloud-storage/users/1/workspaces/4ae78743-e31b-4bd9-8667-73ba235675f5';
    const abs = `${projectRoot}/artifacts/slides-wuyutai/吴裕泰2026暑期整合营销方案.pptx`;
    expect(toProjectApiPath(abs, projectRoot)).toBe(
      'artifacts/slides-wuyutai/吴裕泰2026暑期整合营销方案.pptx',
    );
    expect(toProjectApiPath(abs, 'F:/other/root')).toBe(
      'artifacts/slides-wuyutai/吴裕泰2026暑期整合营销方案.pptx',
    );
  });
});
