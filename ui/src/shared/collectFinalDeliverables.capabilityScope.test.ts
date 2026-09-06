import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';

function user(id: string, content: string): ChatMessage {
  return {
    id,
    type: 'user',
    content,
    timestamp: '2026-07-19T00:00:00.000Z',
  };
}

function tool(id: string, filePath: string): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: '2026-07-19T00:00:01.000Z',
    isToolUse: true,
    toolName: 'write_file',
    toolId: id,
    toolInput: JSON.stringify({ file_path: filePath }),
    toolResult: {
      isError: false,
      content: 'ok',
      writtenFilePath: filePath,
    },
  };
}

describe('collectTurnFinalDeliverables capability scope', () => {
  it('keeps one frozen last30days artifact when Campaign files already exist', () => {
    const taskDir = 'artifacts/task-20260719-last30d';
    const frozenManifestMessage = {
      id: 'sdm-1',
      type: 'assistant',
      content: '',
      timestamp: '2026-07-19T00:00:00.500Z',
      sessionDeliverableManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: '用 last30days 分析近期热点',
        capabilitySlug: 'mkt-last30days',
        profileId: 'last30days',
        taskArtifactDir: taskDir,
        slots: [
          {
            id: 'profile_last30days_1',
            label: '营销分析成果',
            kind: 'markdown',
            pathHint: `${taskDir}/marketing-deliverable.md`,
            pathHints: [`${taskDir}/marketing-deliverable.md`],
            required: true,
            status: 'active',
          },
        ],
      },
    } as ChatMessage;
    const priorCampaignFiles = [
      tool('campaign-1', `${taskDir}/01-topics.md`),
      tool('campaign-2', `${taskDir}/02-longform.md`),
      tool('campaign-3', `${taskDir}/03-social-slices.md`),
    ];
    const currentUser = user('u2', '继续完成近 30 天热点分析');
    const currentWrite = tool('last30days-result', `${taskDir}/marketing-deliverable.md`);
    const sessionMessages = [
      user('u1', '用 last30days 分析近期热点'),
      frozenManifestMessage,
      ...priorCampaignFiles,
      currentUser,
      currentWrite,
    ];

    const final = collectTurnFinalDeliverables({
      assistantText: `成果见 \`${taskDir}/marketing-deliverable.md\``,
      toolMessages: [currentUser, currentWrite],
      sessionToolMessages: sessionMessages,
      userGoalText: '用 last30days 分析近期热点',
      capabilitySlug: 'mkt-last30days',
      turnArtifactDirOverride: taskDir,
      verifiedPathsOverride: [`${taskDir}/marketing-deliverable.md`],
    });

    const userVisibleArtifacts = final.length;
    expect(userVisibleArtifacts).toBe(1);
    expect(final[0]?.path).toBe(`${taskDir}/marketing-deliverable.md`);
  });
});
