import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  isDeliverableSummaryTurnCandidate,
  shouldMountDeliverableSummary,
  type DeliverableSummaryMountContext,
} from './deliverableSummaryMountPolicy';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';

function assistant(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    type: 'assistant',
    id: 'a1',
    timestamp: Date.now(),
    content: 'done',
    ...overrides,
  };
}

const sessionManifest: SessionDeliverableManifestUi = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: '试一下能力',
  slots: [
    { id: 'slot_1', label: '调研报告', kind: 'markdown', required: true, status: 'active', pathHint: 'report.md' },
  ],
};

function baseCtx(overrides: Partial<DeliverableSummaryMountContext> = {}): DeliverableSummaryMountContext {
  return {
    message: assistant(),
    isFinalAssistantReply: true,
    formattedContent: '分析完成',
    turnDeliverables: [],
    acceptanceRowCount: 0,
    turnUserGoalText: '帮我分析一下',
    turnMessages: [assistant()],
    expectedManifest: undefined,
    sessionManifest,
    ...overrides,
  };
}

describe('deliverableSummaryMountPolicy SDM live context', () => {
  it('mounts when session SDM exists without deliverable goal regex', () => {
    const ctx = baseCtx({
      turnUserGoalText: '帮我分析一下',
      sessionManifest,
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx)).toBe(true);
  });

  it('prefers sessionManifest over empty turnMessages scan', () => {
    const ctx = baseCtx({
      turnMessages: [],
      sessionManifest,
      turnUserGoalText: '继续',
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
  });

  /** MOD-07: 5 SDM slots with 1 verified — partial delivery must mount summary table. */
  it('MOD-07 mounts when 5 SDM slots and only 1 verified path', () => {
    const fiveSlotManifest: SessionDeliverableManifestUi = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: '品牌官网全案',
      slots: [
        { id: 's1', label: '品牌发现', kind: 'markdown', required: true, status: 'done', pathHint: 'discovery.md' },
        { id: 's2', label: '定位文档', kind: 'markdown', required: true, status: 'active', pathHint: 'positioning.md' },
        { id: 's3', label: '语气规范', kind: 'markdown', required: true, status: 'active', pathHint: 'tone.md' },
        { id: 's4', label: '落地页', kind: 'html', required: true, status: 'active', pathHint: 'index.html' },
        { id: 's5', label: 'SEO清单', kind: 'markdown', required: true, status: 'active', pathHint: 'seo.md' },
      ],
    };
    const ctx = baseCtx({
      turnUserGoalText: '用「品牌官网全案」帮我做莫德里奇专门站',
      sessionManifest: fiveSlotManifest,
      turnDeliverables: [{
        id: 'document:artifacts/modric/discovery.md',
        path: 'artifacts/modric/discovery.md',
        apiPath: 'artifacts/modric/discovery.md',
        kind: 'document',
        source: 'tool',
      }],
      message: assistant({
        turnAcceptanceMeta: {
          verifiedPaths: ['artifacts/modric/discovery.md'],
          missingPaths: ['artifacts/modric/positioning.md', 'artifacts/modric/tone.md', 'artifacts/modric/index.html', 'artifacts/modric/seo.md'],
        },
      }),
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx)).toBe(true);
  });

  /** MOD-08: 5 SDM slots 0 verified at turn end — table shell still mounts. */
  it('MOD-08 mounts when 5 SDM slots and zero verified at turn end', () => {
    const fiveSlotManifest: SessionDeliverableManifestUi = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: 'Campaign 全案',
      slots: [1, 2, 3, 4, 5].map((n) => ({
        id: `stage_${n}`,
        label: `成果 ${n}`,
        kind: 'markdown',
        required: true,
        status: 'active' as const,
        pathHint: `artifacts/campaign/item-${n}.md`,
      })),
    };
    const ctx = baseCtx({
      turnUserGoalText: '帮我做 Campaign 传播方案并交付 md',
      sessionManifest: fiveSlotManifest,
      turnDeliverables: [],
      formattedContent: '正在准备成果，请稍候。',
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx)).toBe(true);
  });
});
