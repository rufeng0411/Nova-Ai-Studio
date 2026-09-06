import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from './collectDeliverables';
import { pickPrimaryDeliverableFile, resolveTaskFolderLocation } from './pickPrimaryDeliverable';

function toolItem(path: string): DeliverableItem {
  return {
    id: `html:${path.toLowerCase()}`,
    path,
    apiPath: path,
    kind: 'html',
    source: 'tool',
    toolName: 'write_file',
  };
}

describe('pickPrimaryDeliverableFile', () => {
  it('prefers primary file inside inferred turn directory for dual campaigns', () => {
    const items = [
      toolItem('artifacts/task-a/index.html'),
      toolItem('artifacts/task-b/index.html'),
    ];
    const primary = pickPrimaryDeliverableFile(items);
    expect(primary?.path).toMatch(/artifacts\/task-[ab]\/index\.html/);
  });

  it('uses turnArtifactDir items when scores tie', () => {
    const items: DeliverableItem[] = [
      {
        ...toolItem('artifacts/task-b/index.html'),
        turnArtifactDir: 'artifacts/task-b',
      },
      toolItem('artifacts/task-a/index.html'),
    ];
    const primary = pickPrimaryDeliverableFile(items);
    expect(primary?.path).toBe('artifacts/task-b/index.html');
  });

  it('opens the generated React video template folder from its preview file', () => {
    const items: DeliverableItem[] = [
      {
        id: 'html:ai-video-template/demo-preview.html',
        path: 'ai-video-template/demo-preview.html',
        apiPath: 'ai-video-template/demo-preview.html',
        kind: 'html',
        source: 'tool',
      },
      {
        id: 'code:ai-video-template/src/AiVideoTemplate.tsx',
        path: 'ai-video-template/src/AiVideoTemplate.tsx',
        apiPath: 'ai-video-template/src/AiVideoTemplate.tsx',
        kind: 'code',
        source: 'tool',
      },
    ];

    expect(resolveTaskFolderLocation(items)).toEqual({
      filePath: 'ai-video-template/demo-preview.html',
      folderPath: 'ai-video-template',
    });
  });
});
