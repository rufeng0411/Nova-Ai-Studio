import { describe, expect, it } from 'vitest';
import {
  deliverableBasenamesMatch,
  deliverableRelativePathMatches,
  deliverablePathCandidates,
  compileDeliverableSlotPath,
  shouldSkipGeoExpansion,
  isGenericClashProneBasename,
  isSlugDeliverablePath,
  extractSlideDeckDirectory,
  extractTaskArtifactDirectory,
  deliverableResolveMatchesRequest,
  isSlideDeckClashProneBasename,
  isPhantomDeliverablePath,
  isNonUserDeliverablePath,
  normalizeHintDir,
  pathUnderHintDir,
  sanitizeDeliverableLookupPath,
} from './deliverablePathResolve.mjs';

describe('deliverablePathResolve', () => {
  it('strips markdown link label brackets from artifact paths', () => {
    expect(
      sanitizeDeliverableLookupPath(
        '[artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md',
      ),
    ).toBe('artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md');
    expect(
      sanitizeDeliverableLookupPath(
        '[artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md]',
      ),
    ).toBe('artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md');
  });

  it('does not treat last30days artifact slugs as geo campaign paths', () => {
    expect(
      isSlugDeliverablePath('last30days-razer-20260621-1430/razer-热点舆情简报.md'),
    ).toBe(false);
    expect(
      deliverablePathCandidates('last30days-razer-20260621-1430/razer-热点舆情简报.md'),
    ).not.toContain('artifacts/geo/last30days-razer-20260621-1430/razer-热点舆情简报.md');
  });

  it('strips numbered markdown path labels', () => {
    expect(sanitizeDeliverableLookupPath('[6] 全案总结报告.md')).toBe('全案总结报告.md');
  });

  it('strips leaked markdown path labels', () => {
    expect(sanitizeDeliverableLookupPath('路径：**`ROG-NUC-品牌官网全案.md')).toBe('ROG-NUC-品牌官网全案.md');
  });

  it('strips report-file path labels with emoji prefix', () => {
    expect(sanitizeDeliverableLookupPath('📄 报告文件路径：零度可口可乐健康影响咨询研究报告.md')).toBe(
      '零度可口可乐健康影响咨询研究报告.md',
    );
    expect(sanitizeDeliverableLookupPath('文件路径：drafts/竞品分析.md')).toBe('drafts/竞品分析.md');
  });

  it('matches numbered deliverable filenames', () => {
    expect(deliverableBasenamesMatch('06-全案总结报告.md', '全案总结报告.md')).toBe(true);
    expect(deliverableBasenamesMatch('03a-知乎长文成稿.md', '03a-知乎长文成稿.md')).toBe(true);
  });

  it('matches drafts suffix paths', () => {
    const rel = 'artifacts/geo/hema-red-bean-corn-silk-water/drafts/03a-知乎长文成稿.md';
    expect(deliverableRelativePathMatches(rel, 'drafts/03a-知乎长文成稿.md')).toBe(true);
  });

  it('includes geo prefix for drafts paths with unicode', () => {
    const candidates = deliverablePathCandidates('drafts/03a-知乎长文成稿.md');
    expect(candidates).toContain('artifacts/geo/drafts/03a-知乎长文成稿.md');
  });

  it('does not match slide png across different artifact deck folders', () => {
    const rel = 'artifacts/slides-ming-architecture/slide-01.png';
    const lookup = 'artifacts/slides-rog-nuc-2025/slide-01.png';
    expect(deliverableRelativePathMatches(rel, lookup)).toBe(false);
  });

  it('decodes percent-encoded deliverable paths', () => {
    const encoded = encodeURIComponent('ROG大油条-活动预算表.xlsx');
    expect(sanitizeDeliverableLookupPath(encoded)).toBe('ROG大油条-活动预算表.xlsx');
    const withDir = encodeURIComponent('artifacts/content-rog-20250615-1030/ROG大油条-活动预算表.xlsx');
    expect(sanitizeDeliverableLookupPath(withDir)).toBe(
      'artifacts/content-rog-20250615-1030/ROG大油条-活动预算表.xlsx',
    );
  });

  it('strips leaked SaaS tenant storage paths', () => {
    expect(sanitizeDeliverableLookupPath('data/saas/tenants/default/ROG-NUC-GTM策略.md')).toBe(
      'ROG-NUC-GTM策略.md',
    );
    expect(
      sanitizeDeliverableLookupPath('artifacts/geo/data/saas/tenants/default/ROG-NUC-GTM策略.md'),
    ).toBe('ROG-NUC-GTM策略.md');
  });

  it('does not prepend artifacts/geo for tenant storage paths', () => {
    const candidates = deliverablePathCandidates('data/saas/tenants/default/report.md');
    expect(candidates).not.toContain('artifacts/geo/data/saas/tenants/default/report.md');
    expect(candidates).toContain('report.md');
  });

  it('does not prepend artifacts/geo for cloud-storage workspace paths', () => {
    const leaked =
      'cloud-storage/users/1/workspaces/e7478cec-3293-43e5-905f-802730187717/AI安防产品竞品调研报告.md';
    const candidates = deliverablePathCandidates(leaked);
    expect(candidates).not.toContain(`artifacts/geo/${leaked}`);
    expect(candidates).toContain(leaked);
  });

  it('does not treat workspace assets/ as geo slug deliverables', () => {
    expect(isSlugDeliverablePath('assets/dashboard.html')).toBe(false);
    const candidates = deliverablePathCandidates('assets/dashboard.html');
    expect(candidates[0]).toBe('assets/dashboard.html');
    expect(candidates).not.toContain('artifacts/geo/assets/dashboard.html');
  });

  it('prioritizes artifacts paths for generic bare index.html', () => {
    const candidates = deliverablePathCandidates('index.html');
    expect(candidates[0]).toContain('artifacts/');
    expect(candidates.at(-1)).toBe('index.html');
  });

  it('detects generic clash-prone basenames', () => {
    expect(isGenericClashProneBasename('index.html')).toBe(true);
    expect(isGenericClashProneBasename('deck.bento.html')).toBe(true);
    expect(isGenericClashProneBasename('artifacts/design/foo/index.html')).toBe(true);
    expect(isGenericClashProneBasename('slide-manifest.json')).toBe(true);
    expect(isGenericClashProneBasename('outline.json')).toBe(true);
    expect(isSlideDeckClashProneBasename('slide-01.png')).toBe(true);
    expect(isGenericClashProneBasename('slide-01.png')).toBe(false);
    expect(isGenericClashProneBasename('keywords.md')).toBe(false);
  });

  it('extracts slide deck directory from deliverable paths', () => {
    expect(extractSlideDeckDirectory('artifacts/slides-ming-arch-guofeng/slide-manifest.json')).toBe(
      'artifacts/slides-ming-arch-guofeng',
    );
    expect(extractSlideDeckDirectory('slides-ai-business-growth/slide-01.png')).toBe(
      'artifacts/slides-ai-business-growth',
    );
  });

  it('rejects cross-deck resolve matches', () => {
    expect(
      deliverableResolveMatchesRequest(
        'artifacts/slides-ai-business-growth/slide-manifest.json',
        'artifacts/slides-ming-arch-guofeng/slide-manifest.json',
      ),
    ).toBe(false);
    expect(
      deliverableResolveMatchesRequest(
        'artifacts/slides-ai-business-growth/slide-manifest.json',
        'artifacts/slides-ai-business-growth/slide-manifest.json',
      ),
    ).toBe(true);
  });

  it('rejects cross task-* resolve matches for deck.bento.html', () => {
    const razer = 'artifacts/task-20260728-a1b2c3d4/deck.bento.html';
    const fifa = 'artifacts/task-20260728-41dd1371/deck.bento.html';
    expect(deliverableResolveMatchesRequest(razer, fifa)).toBe(false);
    expect(deliverableResolveMatchesRequest(razer, razer)).toBe(true);
    expect(extractTaskArtifactDirectory(razer)).toBe('artifacts/task-20260728-a1b2c3d4');
  });

  it('re-scopes corrupted SDM pathHint to turnArtifactDir', () => {
    expect(
      compileDeliverableSlotPath(
        'artifacts/task-20260728-41dd1371/deck.bento.html',
        'artifacts/task-20260728-a1b2c3d4',
      ),
    ).toBe('artifacts/task-20260728-a1b2c3d4/deck.bento.html');
  });

  it('normalizes hintDir and checks path containment', () => {
    expect(normalizeHintDir('artifacts/task-b/')).toBe('artifacts/task-b');
    expect(pathUnderHintDir('artifacts/task-b/index.html', 'artifacts/task-b')).toBe(true);
    expect(pathUnderHintDir('artifacts/task-a/index.html', 'artifacts/task-b')).toBe(false);
  });

  it('detects phantom agent sandbox paths', () => {
    expect(isPhantomDeliverablePath('file:///home/user/index.html')).toBe(true);
    expect(isPhantomDeliverablePath('home/user/index.html')).toBe(true);
    expect(isPhantomDeliverablePath('artifacts/design/razer-synapse4-ui/index.html')).toBe(false);
  });

  it('filters numeric shell scripts and acceptance.json from deliverables', () => {
    expect(isNonUserDeliverablePath('artifacts/task/2058732.sh')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/task/build-brief.mjs')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/task/acceptance.json')).toBe(true);
  });

  it('filters VAP prepared/capture assets from deliverables', () => {
    expect(
      isNonUserDeliverablePath(
        'artifacts/task-20260725-6ca341f6/assets/prepared/deepseek-report_inline.png',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath(
        'artifacts/task-20260725-6ca341f6/assets/_capture/autohome.png',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath(
        'artifacts/task-20260725-6ca341f6/assets/_capture',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/task-20260725-6ca341f6/visual-asset-manifest.json'),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/task-20260725-6ca341f6/index-preview.png'),
    ).toBe(true);
  });

  it('fd7c166c: filters session downloads cache from deliverable checklist', () => {
    expect(
      isNonUserDeliverablePath(
        'artifacts/sessions/web-s_fd7c166c-f4e2-4ce6-82c0-098c145bba7e/downloads/img-d0777f4ca139.webp',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/sessions/web-s_demo/downloads/'),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/_share-export/abc/report.pdf'),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/task-20260730-81149e05/index.html'),
    ).toBe(false);
  });

  it('a51fa91d: filters acquisition process JSON from deliverable checklist', () => {
    expect(
      isNonUserDeliverablePath(
        'artifacts/acquisition-beijing-ai-outsourcing/query-expansion.json',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath(
        'artifacts/task-20260730-00277c2f/phase-ab-result.json',
      ),
    ).toBe(true);
    expect(
      isNonUserDeliverablePath('artifacts/task-20260730-00277c2f/leads-report.md'),
    ).toBe(false);
    expect(
      isNonUserDeliverablePath(
        'artifacts/task-20260730-00277c2f/acquisition-manifest.json',
      ),
    ).toBe(false);
  });

  it('allows code files inside user-generated project deliverables', () => {
    expect(isNonUserDeliverablePath('ai-video-template/src/AiVideoTemplate.tsx')).toBe(false);
    expect(isNonUserDeliverablePath('artifacts/code-demo/main.py')).toBe(false);
    expect(isNonUserDeliverablePath('src/agent/internal.ts')).toBe(true);
    expect(isNonUserDeliverablePath('skills/example/SKILL.md')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/geo/nike/docs/execution-standard.md')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/geo/docs/troubleshooting-guide.md')).toBe(true);
    expect(isNonUserDeliverablePath('artifacts/geo/./docs/execution-standard.md')).toBe(true);
    expect(
      sanitizeDeliverableLookupPath('artifacts/geo/./docs/execution-standard.md'),
    ).toBe('artifacts/geo/docs/execution-standard.md');
    expect(isNonUserDeliverablePath('ai-video-template/node_modules/pkg/index.js')).toBe(true);
  });

  it('skips geo expansion for faq-* slug paths', () => {
    expect(shouldSkipGeoExpansion('faq-dutch-goji/index.html')).toBe(true);
    const candidates = deliverablePathCandidates('faq-dutch-goji/index.html');
    expect(candidates[0]).toBe('artifacts/faq-dutch-goji/index.html');
    expect(candidates).not.toContain('artifacts/geo/faq-dutch-goji/index.html');
  });

  it('compiles SDM pathHint with turnArtifactDir', () => {
    expect(
      compileDeliverableSlotPath('index.html', 'artifacts/faq-dutch-goji'),
    ).toBe('artifacts/faq-dutch-goji/index.html');
    expect(
      compileDeliverableSlotPath('faq-dutch-goji/index.html', 'artifacts/faq-dutch-goji'),
    ).toBe('artifacts/faq-dutch-goji/index.html');
  });
});
