import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { resolvePrimarySessionTaskDirectory } from './resolvePrimaryTaskArtifactDir';

describe('resolvePrimarySessionTaskDirectory', () => {
  it('prefers write_file task root over polluted manifest taskArtifactDir (Razer/FIFA RCA)', () => {
    const razerDir = 'artifacts/task-20260728-a1b2c3d4';
    const fifaDir = 'artifacts/task-20260728-41dd1371';
    const messages: ChatMessage[] = [
      {
        id: 'tool-1',
        type: 'tool',
        isToolUse: true,
        toolName: 'write_file',
        toolInput: JSON.stringify({ file_path: `${razerDir}/bento-spec.md`, content: 'x' }),
        toolResult: { content: `Created ${razerDir}/bento-spec.md` },
        content: '',
        timestamp: Date.now(),
      },
      {
        id: 'tool-2',
        type: 'tool',
        isToolUse: true,
        toolName: 'write_file',
        toolInput: JSON.stringify({ file_path: `${razerDir}/deck.bento.html`, content: '<html></html>' }),
        toolResult: { content: `Created ${razerDir}/deck.bento.html` },
        content: '',
        timestamp: Date.now(),
      },
    ];
    const primary = resolvePrimarySessionTaskDirectory({
      messages,
      manifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: '雷蛇2026',
        taskArtifactDir: fifaDir,
        taskDirKey: '20260728-41dd1371',
        slots: [
          {
            id: 'bento',
            label: 'deck.bento.html',
            pathHint: `${fifaDir}/deck.bento.html`,
            resolvedPath: `${fifaDir}/deck.bento.html`,
            required: true,
            status: 'done',
            kind: 'bento',
          },
        ],
      },
    });
    expect(primary?.taskArtifactDir).toBe(razerDir);
  });
});
