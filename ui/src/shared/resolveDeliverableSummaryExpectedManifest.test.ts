import { describe, expect, it } from 'vitest';
import {
  resolveDeliverableSummaryExpectedManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import type { ChatMessage } from '../components/chat/types/types';

const sessionManifest: SessionDeliverableManifestUi = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: '帮我做 PPT',
  slots: [
    { id: 'slot_1', label: '调研报告', pathHint: 'report.md', status: 'active' },
  ],
};

describe('resolveDeliverableSummaryExpectedManifest', () => {
  it('latest turn uses session contract over per-turn expectedManifest', () => {
    const messages: ChatMessage[] = [
      { id: 'a1', type: 'assistant', content: 'done', turnId: 'a1' },
    ];
    const result = resolveDeliverableSummaryExpectedManifest({
      turnMeta: {
        verifiedPaths: [],
        missingPaths: [],
        brokenPaths: [],
        hiddenByPolicyPaths: [],
        resolvedPathMap: {},
        expectedManifest: [{ id: 'turn-only', label: 'Turn manifest', path: 'a.md' }],
      },
      sessionManifest,
      isLatestAssistantInSession: true,
      messages,
    });
    expect(result?.some((e) => e.id === 'slot_1')).toBe(true);
    expect(result?.some((e) => e.id === 'turn-only')).toBe(false);
  });

  it('skips session SDM when turn has acceptance path meta (completed turns)', () => {
    const result = resolveDeliverableSummaryExpectedManifest({
      turnMeta: {
        verifiedPaths: ['artifacts/task/brief.md'],
        missingPaths: [],
        brokenPaths: [],
        hiddenByPolicyPaths: [],
        resolvedPathMap: {},
      },
      sessionManifest,
      isLatestAssistantInSession: false,
    });
    expect(result).toBeUndefined();
  });

  it('uses session SDM only for latest turn without acceptance meta when messages omitted', () => {
    const result = resolveDeliverableSummaryExpectedManifest({
      turnMeta: null,
      sessionManifest,
      isLatestAssistantInSession: true,
    });
    expect(result).toEqual([
      {
        id: 'slot_1',
        label: '调研报告',
        kind: undefined,
        path: 'report.md',
        status: 'active',
      },
    ]);
  });

  it('skips session SDM for historical turns without acceptance meta', () => {
    const result = resolveDeliverableSummaryExpectedManifest({
      turnMeta: null,
      sessionManifest,
      isLatestAssistantInSession: false,
    });
    expect(result).toBeUndefined();
  });

  it('historical turn still prefers per-turn expectedManifest', () => {
    const result = resolveDeliverableSummaryExpectedManifest({
      turnMeta: {
        verifiedPaths: [],
        missingPaths: [],
        brokenPaths: [],
        hiddenByPolicyPaths: [],
        resolvedPathMap: {},
        expectedManifest: [{ id: 'turn-only', label: 'Turn manifest', path: 'a.md' }],
      },
      sessionManifest,
      isLatestAssistantInSession: false,
    });
    expect(result).toEqual([{ id: 'turn-only', label: 'Turn manifest', path: 'a.md' }]);
  });
});
