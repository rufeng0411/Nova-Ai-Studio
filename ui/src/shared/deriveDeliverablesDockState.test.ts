import { describe, expect, it } from 'vitest';
import { deriveDeliverablesDockState } from './deriveDeliverablesDockState';
import type { ChatMessage } from '../components/chat/types/types';

function assistantMessage(id: string, content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id,
    type: 'assistant',
    content,
    turnId: id,
    ...extra,
  };
}

function userMessage(id: string, content: string): ChatMessage {
  return { id, type: 'user', content };
}

describe('deriveDeliverablesDockState', () => {
  it('shows composer chrome when session manifest has slots', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '帮【吴裕泰】做品牌传播 campaign 全案，按阶段一次规划执行'),
      assistantMessage('a1', '调研完成', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'campaign',
          slots: [
            { id: 'stage_research', label: '调研', stageId: 'research', status: 'done' },
            { id: 'stage_brief', label: '传播 brief', stageId: 'brief', status: 'active', pathHint: 'brief.md' },
          ],
        },
      }),
    ];

    const state = deriveDeliverablesDockState({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    expect(state.showComposerChrome).toBe(true);
    expect(state.hasSessionManifest).toBe(true);
    expect(state.progress.total).toBeGreaterThan(0);
  });

  it('builds rows from expected manifest slots', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '生成 6 页 Nova 美学幻灯'),
      assistantMessage('a1', '已生成部分页面', {
        expectedManifest: [
          { id: 'slide-1', label: '第 1 页', path: 'artifacts/slides-test/slide-01.png' },
          { id: 'slide-2', label: '第 2 页', path: 'artifacts/slides-test/slide-02.png' },
        ],
        verifiedDeliverablePaths: ['artifacts/slides-test/slide-01.png'],
      }),
    ];

    const state = deriveDeliverablesDockState({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    expect(state.rows.length).toBe(2);
    expect(state.rows.filter((row) => row.status === 'delivered')).toHaveLength(1);
    expect(state.showComposerChrome).toBe(true);
  });

  it('marks in-progress when assistant is working', () => {
    const state = deriveDeliverablesDockState({
      messages: [userMessage('u1', '帮【吴裕泰】做品牌传播 campaign 全案，按阶段一次规划执行')],
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: true,
    });

    expect(state.isInProgress).toBe(true);
    expect(state.showComposerChrome).toBe(true);
  });

  it('does not inflate dock rows or total when SDM baseline exists and extra files appear on disk', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '帮【小罐茶】做 campaign 全案'),
      assistantMessage('a1', '已写入 `artifacts/campaign/brief.md` 与 `artifacts/campaign/poster.html`', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'campaign',
          slots: [
            { id: 'stage_brief', label: '传播 brief', stageId: 'brief', status: 'done', pathHint: 'brief.md' },
          ],
        },
        verifiedDeliverablePaths: ['artifacts/campaign/brief.md'],
      }),
    ];

    const state = deriveDeliverablesDockState({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    expect(state.rows).toHaveLength(1);
    expect(state.progress.total).toBe(1);
    expect(state.rows.some((row) => row.path.includes('poster.html'))).toBe(false);
  });

  it('accumulates deliverable total when SDM gains slots after user adds requirements', () => {
    const initialManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: 'docs',
      slots: [
        { id: 'md1', label: '报告 1', pathHint: 'a.md', status: 'done' as const },
        { id: 'md2', label: '报告 2', pathHint: 'b.md', status: 'done' as const },
        { id: 'md3', label: '报告 3', pathHint: 'c.md', status: 'done' as const },
      ],
    };
    const accumulatedManifest = {
      manifestVersion: 2,
      goalVersion: 2,
      sessionGoalAnchor: 'docs',
      slots: [
        ...initialManifest.slots,
        { id: 'pdf1', label: 'PDF 汇总', pathHint: 'summary.pdf', status: 'active' as const },
      ],
    };

    const beforeAdd = deriveDeliverablesDockState({
      messages: [
        userMessage('u1', '写 3 份 markdown 报告'),
        assistantMessage('a1', '完成', { sessionDeliverableManifest: initialManifest }),
      ],
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    const afterAdd = deriveDeliverablesDockState({
      messages: [
        userMessage('u1', '写 3 份 markdown 报告'),
        assistantMessage('a1', '完成', { sessionDeliverableManifest: initialManifest }),
        userMessage('u2', '再整理成 PDF'),
        assistantMessage('a2', '收到', { sessionDeliverableManifest: accumulatedManifest }),
      ],
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    expect(beforeAdd.progress.total).toBe(3);
    expect(afterAdd.progress.total).toBe(4);
    expect(afterAdd.rows).toHaveLength(4);
  });

  it('syncs brief slot to delivered when acceptance meta marks brief delivered', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '冷泡茶 campaign 全案'),
      assistantMessage('a1', '规划 manifest', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'campaign',
          currentStageId: 'brief',
          slots: [
            { id: 'stage_research', label: '冷泡茶行业市场研究报告', stageId: 'research', status: 'done', pathHint: 'market-research.md', kind: 'markdown' },
            { id: 'stage_brief', label: 'brief', stageId: 'brief', status: 'done', pathHint: 'brief.md', kind: 'markdown' },
          ],
        },
      }),
      assistantMessage('a2', 'brief 已完成，见 `artifacts/campaign/brief.md`', {
        turnAcceptanceMeta: {
          verifiedPaths: ['artifacts/campaign/brief.md'],
          acceptanceStatus: 'passed',
        },
        verifiedDeliverablePaths: ['artifacts/campaign/brief.md'],
      }),
    ];

    const state = deriveDeliverablesDockState({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    const briefRow = state.rows.find((row) => row.label.toLowerCase() === 'brief');
    expect(briefRow?.status).toBe('delivered');
    expect(briefRow?.resolvedPath || briefRow?.path).toContain('brief.md');
  });

  it('accumulates HTML row when user adds dashboard after markdown report (0707-3)', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '用「深度调研」围绕【中国潜射导弹巨浪-3世界舆情】做多源调研'),
      assistantMessage('a1', '报告已生成', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'jl3 research',
          slots: [
            {
              id: 'required_markdown_1',
              label: '调研报告',
              kind: 'markdown',
              pathHint: 'jl3-world-opinion-deep-dive-20260707.md',
              status: 'done',
            },
          ],
        },
        verifiedDeliverablePaths: ['artifacts/jl3-world-opinion-deep-dive-20260707.md'],
      }),
      userMessage('u2', '给我配色高级，带图表的HTML'),
      assistantMessage('a2', '已完成 index.html', {
        verifiedDeliverablePaths: [
          'artifacts/jl3-world-opinion-deep-dive-20260707.md',
          'artifacts/index.html',
        ],
      }),
    ];

    const state = deriveDeliverablesDockState({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      sessionRepairActive: false,
      isAssistantWorking: false,
    });

    expect(state.progress.total).toBe(2);
    expect(state.rows).toHaveLength(2);
    expect(state.rows.some((row) => row.path.includes('index.html') || row.resolvedPath?.includes('index.html'))).toBe(true);
  });
});
