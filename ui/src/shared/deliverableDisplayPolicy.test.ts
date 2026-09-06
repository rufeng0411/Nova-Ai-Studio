import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import {
  extractUserGoalFromTurnMessages,
  filterDeliverablesForDisplayPanel,
  isFailedArtifactPath,
  isImplementationScriptPath,
  shouldShowDeliverableInPanel,
  userGoalImpliesProgramming,
} from './deliverableDisplayPolicy';

function item(path: string, kind: DeliverableItem['kind'] = 'document'): DeliverableItem {
  return {
    id: `document:${path}`,
    path,
    apiPath: path,
    kind,
    source: 'tool',
  };
}

describe('deliverableDisplayPolicy', () => {
  it('detects programming goals', () => {
    expect(userGoalImpliesProgramming('帮我写一个 Python 脚本')).toBe(true);
    expect(userGoalImpliesProgramming('生成一份 HTML 落地页')).toBe(false);
  });

  it('detects React programmatic video templates as code deliverables', () => {
    expect(userGoalImpliesProgramming('用「React 程序化视频」搭一个人工智能用途视频模板，方便批量渲染')).toBe(true);
  });

  it('hides implementation scripts when user asked for HTML/PDF', () => {
    const html = item('artifacts/demo/page.html', 'html');
    const script = item('artifacts/demo/build.py', 'code');
    const ctx = { userGoalText: '生成 HTML 页面', anchorPaths: ['artifacts/demo/page.html'] };

    expect(shouldShowDeliverableInPanel(html, ctx)).toBe(true);
    expect(shouldShowDeliverableInPanel(script, ctx)).toBe(false);
  });

  it('shows json/html/md intermediates for non-code tasks', () => {
    const manifest = item('artifacts/slides-demo/plan.json', 'code');
    const ctx = { userGoalText: '做 10 页 PPT 图', anchorPaths: [] };

    expect(shouldShowDeliverableInPanel(manifest, ctx)).toBe(true);
  });

  it('shows scripts when user explicitly asked for code', () => {
    const script = item('artifacts/demo/main.py', 'code');
    const ctx = { userGoalText: '写一个 Python 程序处理 CSV', anchorPaths: [] };

    expect(shouldShowDeliverableInPanel(script, ctx)).toBe(true);
  });

  it('shows TSX entry files for React programmatic video templates', () => {
    const component = item('ai-video-template/src/AiVideoTemplate.tsx', 'code');
    const ctx = { userGoalText: '用 React 程序化视频搭一个视频模板，支持批量渲染标题与数字', anchorPaths: [] };

    expect(shouldShowDeliverableInPanel(component, ctx)).toBe(true);
  });

  it('hides failed artifact filenames', () => {
    expect(isFailedArtifactPath('artifacts/demo/report.failed.pdf')).toBe(true);
    expect(isFailedArtifactPath('artifacts/demo/report.pdf')).toBe(false);
  });

  it('treats create_*.py as implementation script', () => {
    expect(isImplementationScriptPath('artifacts/ppt/create_slides.py')).toBe(true);
  });

  it('hides ecommerce helper .py from T2 for non-programming goals (archetype D)', () => {
    const script = item('artifacts/campaign/build_store_page.py', 'code');
    const ctx = { userGoalText: 'PS5 巴西促销电商落地页' };
    expect(shouldShowDeliverableInPanel(script, ctx)).toBe(false);
    expect(filterDeliverablesForDisplayPanel([script], ctx)).toHaveLength(0);
  });

  it('extracts user goal from turn messages', () => {
    const text = extractUserGoalFromTurnMessages([
      { type: 'user', content: '导出 PDF 报告' },
      { type: 'assistant', content: '好的' },
    ]);
    expect(text).toBe('导出 PDF 报告');
  });

  it('filterDeliverablesForDisplayPanel keeps previewable deliverables only', () => {
    const filtered = filterDeliverablesForDisplayPanel(
      [
        item('artifacts/demo/out.pdf', 'pdf'),
        item('artifacts/demo/run.go', 'code'),
        item('artifacts/demo/bundle.zip', 'archive'),
      ],
      { userGoalText: '生成 PDF', anchorPaths: ['artifacts/demo/out.pdf'] },
    );
    expect(filtered.map((entry) => entry.path)).toEqual(['artifacts/demo/out.pdf']);
  });

  it('blocks skill SKILL.md from display panel', () => {
    expect(
      shouldShowDeliverableInPanel(item('skills/last30days/SKILL.md', 'document'), {
        userGoalText: '世界杯热点',
      }),
    ).toBe(false);
  });

  it('shows schema.jsonld for GEO campaign deliverables', () => {
    const schema = item('artifacts/geo/吴裕泰/schema.jsonld', 'document');
    const ctx = { userGoalText: '帮吴裕泰做品牌 GEO 全案', anchorPaths: ['artifacts/geo/吴裕泰/score-estimate.md'] };
    expect(shouldShowDeliverableInPanel(schema, ctx)).toBe(true);
    expect(filterDeliverablesForDisplayPanel([schema], ctx)).toHaveLength(1);
  });

  it('blocks llms.txt reference files from display panel', () => {
    expect(
      shouldShowDeliverableInPanel(item('llms.txt', 'document'), {
        userGoalText: '帮雷蛇做 GEO 全案',
      }),
    ).toBe(false);
  });

  it('A5 n2_bot session never shows write_file in the results panel', () => {
    expect(
      shouldShowDeliverableInPanel(item('artifacts/task-x/周会.pptx', 'document'), {
        sessionKind: 'n2_bot',
        userGoalText: '做一份周会 PPT',
      }),
    ).toBe(false);
  });
});
