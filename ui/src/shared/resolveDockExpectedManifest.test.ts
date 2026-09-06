import { describe, expect, it } from 'vitest';
import {
  countActiveDeliverableSlots,
  resolveDockExpectedManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import type { ChatMessage } from '../components/chat/types/types';

const campaignManifest: SessionDeliverableManifestUi = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: 'campaign',
  slots: [
    { id: 'stage_research', label: '调研', stageId: 'research', status: 'done' },
    { id: 'stage_brief', label: '传播 brief', stageId: 'brief', status: 'active', pathHint: 'brief.md' },
    { id: 'stage_website', label: '官网', stageId: 'website', status: 'pending', pathHint: 'index.html' },
  ],
};

describe('resolveDockExpectedManifest', () => {
  it('prefers session SDM slots over smaller per-turn expectedManifest', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', type: 'user', content: 'campaign 全案' },
      {
        id: 'a1',
        type: 'assistant',
        content: '进行中',
        sessionDeliverableManifest: campaignManifest,
        expectedManifest: [{ id: 'turn-only', label: '单页', path: 'a.md' }],
      },
    ];

    const result = resolveDockExpectedManifest({
      messages,
      sessionManifest: campaignManifest,
    });

    expect(result).toHaveLength(3);
    expect(result?.map((entry) => entry.id)).toEqual([
      'stage_research',
      'stage_brief',
      'stage_website',
    ]);
  });

  it('uses largest expected manifest baseline when SDM not yet hydrated', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', type: 'user', content: '生成 6 页幻灯' },
      {
        id: 'a1',
        type: 'assistant',
        content: '计划 6 页',
        expectedManifest: [{ id: 'deck', kind: 'png', count: 6, required: true }],
      },
      {
        id: 'a2',
        type: 'assistant',
        content: '完成 2 页',
        expectedManifest: [{ id: 'slide-1', path: 'artifacts/slides/slide-01.png' }],
      },
    ];

    const result = resolveDockExpectedManifest({ messages });
    expect(countActiveDeliverableSlots(undefined, result)).toBe(6);
  });
});

describe('countActiveDeliverableSlots', () => {
  it('expands count fields on SDM slots', () => {
    const manifest: SessionDeliverableManifestUi = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: 'deck',
      slots: [{ id: 'slides', label: '幻灯', kind: 'png', count: 6, required: true, status: 'active' }],
    };
    expect(countActiveDeliverableSlots(manifest)).toBe(6);
  });
});
