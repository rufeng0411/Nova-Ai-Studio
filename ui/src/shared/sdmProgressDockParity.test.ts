import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { computeProcessRailProgress, buildSessionDeliverablePipeline } from './sessionDeliverablePipeline';
import { getCachedSessionManifest } from './sessionDeliverableManifestStore';
import { collectDeliverablesFromMessages } from './collectDeliverables';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';
import { resolveSessionDeliverableContract } from './resolveSessionDeliverableContract';
import { computeSdmProgressUi } from './resolveSessionDeliverableManifest';

function legacySdmProgress(messages: ChatMessage[], projectRoot: string, sessionId?: string) {
  const manifest = getCachedSessionManifest(sessionId, messages);
  const sessionDeliverables = projectRoot
    ? collectDeliverablesFromMessages(messages, projectRoot)
    : [];
  const verified: string[] = [];
  for (const msg of messages) {
    if (msg.type !== 'assistant') continue;
    const meta = extractTurnAcceptanceMeta(msg);
    for (const path of meta?.verifiedPaths ?? []) {
      if (typeof path === 'string' && path.trim()) verified.push(path.trim());
    }
  }
  const contract = resolveSessionDeliverableContract({
    messages,
    sessionManifest: manifest,
    sessionDeliverables,
    sessionVerifiedPaths: verified,
  });
  if (contract.totalSlots <= 0) return null;
  const progressBase = computeSdmProgressUi(manifest, verified);
  return {
    done: Math.min(contract.totalSlots, progressBase.done),
    total: contract.totalSlots,
    currentLabel: progressBase.currentLabel,
  };
}

describe('sdmProgressDockParity', () => {
  it('processRailProgress matches legacy sdmProgress formula', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '生成 GEO 审计清单与报告到 artifacts/',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a1',
        type: 'assistant',
        content: '已完成初稿',
        timestamp: '2026-01-01T00:01:00.000Z',
      },
    ];
    const bundle = buildSessionDeliverablePipeline({
      sessionId: 'parity-1',
      messages,
      projectRoot: '/workspace',
      hasMoreMessages: false,
    });
    const legacy = legacySdmProgress(messages, '/workspace', 'parity-1');
    const rail = bundle.processRailProgress;
    if (!legacy && !rail) return;
    expect(rail?.done).toBe(legacy?.done);
    expect(rail?.total).toBe(legacy?.total);
    expect(rail?.currentLabel).toBe(legacy?.currentLabel);
  });
});
