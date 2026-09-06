import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  isDeliverableSummaryTurnCandidate,
  shouldMountDeliverableSummary,
  type DeliverableSummaryMountContext,
} from './deliverableSummaryMountPolicy';

function assistant(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    type: 'assistant',
    id: 'a1',
    timestamp: Date.now(),
    content: 'done',
    ...overrides,
  };
}

function baseCtx(overrides: Partial<DeliverableSummaryMountContext> = {}): DeliverableSummaryMountContext {
  return {
    message: assistant(),
    isFinalAssistantReply: true,
    formattedContent: '报告已完成',
    turnDeliverables: [],
    acceptanceRowCount: 0,
    turnUserGoalText: '帮我做一份 GEO 全案报告并交付 md 和 html',
    turnMessages: [assistant()],
    expectedManifest: undefined,
    ...overrides,
  };
}

describe('deliverableSummaryMountPolicy', () => {
  it('mounts partial delivery when manifest has missing slots (2/5)', () => {
    const ctx = baseCtx({
      acceptanceRowCount: 5,
      expectedManifest: [
        { id: 'a', kind: 'md', required: true },
        { id: 'b', kind: 'md', required: true },
        { id: 'c', kind: 'md', required: true },
        { id: 'd', kind: 'md', required: true },
        { id: 'e', kind: 'md', required: true },
      ],
      turnDeliverables: [{
        id: 'document:artifacts/geo/x/a.md',
        path: 'artifacts/geo/x/a.md',
        apiPath: 'artifacts/geo/x/a.md',
        kind: 'document',
        source: 'tool',
      }],
      message: assistant({
        turnAcceptanceMeta: {
          verifiedPaths: ['artifacts/geo/x/a.md', 'artifacts/geo/x/b.md'],
          missingPaths: ['artifacts/geo/x/c.md', 'artifacts/geo/x/d.md', 'artifacts/geo/x/e.md'],
        },
      }),
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx)).toBe(true);
  });

  it('does not mount for pure chat goals', () => {
    const ctx = baseCtx({ turnUserGoalText: '聊聊最近 AI 趋势' });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(false);
  });

  it('does not mount text-path-only without manifest', () => {
    const ctx = baseCtx({
      formattedContent: '见 `artifacts/geo/x/report.md`',
      turnDeliverables: [{
        id: 'document:artifacts/geo/x/report.md',
        path: 'artifacts/geo/x/report.md',
        apiPath: 'artifacts/geo/x/report.md',
        kind: 'document',
        source: 'text',
      }],
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(false);
  });

  it('mounts research single-file when engine verified meta exists without SDM', () => {
    const ctx = baseCtx({
      turnUserGoalText: '用「竞品流量调研」帮我：【ROG】直接开始做',
      message: assistant({
        turnAcceptanceMeta: {
          verifiedPaths: ['artifacts/research/competitive-brief.md'],
          acceptanceStatus: 'passed',
        },
      }),
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx)).toBe(true);
  });

  it('hides mount only while latest assistant is streaming', () => {
    const ctx = baseCtx({
      acceptanceRowCount: 2,
      expectedManifest: [{ id: 'a', kind: 'md', required: true }],
      message: assistant({ isStreaming: true }),
    });
    expect(isDeliverableSummaryTurnCandidate(ctx)).toBe(true);
    expect(shouldMountDeliverableSummary(ctx, {
      isLatestAssistantInSession: true,
      sessionRepairActive: false,
    })).toBe(false);
    expect(shouldMountDeliverableSummary(ctx, {
      isLatestAssistantInSession: false,
      sessionRepairActive: false,
    })).toBe(true);
  });

  it('still mounts during session repair (partial delivery visible)', () => {
    const ctx = baseCtx({
      acceptanceRowCount: 3,
      expectedManifest: [{ id: 'slides', kind: 'png', count: 6, required: true }],
    });
    expect(shouldMountDeliverableSummary(ctx, {
      isLatestAssistantInSession: true,
      sessionRepairActive: true,
    })).toBe(true);
  });
});
