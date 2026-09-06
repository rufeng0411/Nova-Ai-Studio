import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../components/file-tree/types/types';
import { filterProcessArtifactsFromFileTree } from './filterProcessArtifactsFromFileTree';

describe('filterProcessArtifactsFromFileTree', () => {
  it('hides VAP internal assets and prunes empty assets folder', () => {
    const tree: FileTreeNode[] = [
      {
        name: 'task-20260727-cf84f603',
        path: 'artifacts/task-20260727-cf84f603',
        type: 'directory',
        children: [
          {
            name: 'research.md',
            path: 'artifacts/task-20260727-cf84f603/research.md',
            type: 'file',
          },
          {
            name: 'assets',
            path: 'artifacts/task-20260727-cf84f603/assets',
            type: 'directory',
            children: [
              {
                name: '_capture',
                path: 'artifacts/task-20260727-cf84f603/assets/_capture',
                type: 'directory',
                children: [
                  {
                    name: 'page-e2ad.png',
                    path: 'artifacts/task-20260727-cf84f603/assets/_capture/page-e2ad.png',
                    type: 'file',
                  },
                ],
              },
              {
                name: 'prepared',
                path: 'artifacts/task-20260727-cf84f603/assets/prepared',
                type: 'directory',
                children: [
                  {
                    name: 'img-4f92.png',
                    path: 'artifacts/task-20260727-cf84f603/assets/prepared/img-4f92.png',
                    type: 'file',
                  },
                ],
              },
              {
                name: 'visual-asset-manifest.json',
                path: 'artifacts/task-20260727-cf84f603/assets/visual-asset-manifest.json',
                type: 'file',
              },
            ],
          },
          {
            name: 'landing.html',
            path: 'artifacts/task-20260727-cf84f603/landing.html',
            type: 'file',
          },
        ],
      },
    ];

    const filtered = filterProcessArtifactsFromFileTree(tree);
    const task = filtered[0];
    expect(task?.children?.map((n) => n.name)).toEqual(['research.md', 'landing.html']);
  });
});
