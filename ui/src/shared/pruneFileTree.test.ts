import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../components/file-tree/types/types';
import { pruneFileTreeNodes } from './pruneFileTree';

describe('pruneFileTreeNodes', () => {
  it('removes a directory and all descendants', () => {
    const tree: FileTreeNode[] = [
      {
        name: 'artifacts',
        type: 'directory',
        path: 'artifacts',
        children: [
          { name: 'brief.md', type: 'file', path: 'artifacts/brief.md' },
          {
            name: 'nested',
            type: 'directory',
            path: 'artifacts/nested',
            children: [{ name: 'x.txt', type: 'file', path: 'artifacts/nested/x.txt' }],
          },
        ],
      },
      { name: 'readme.md', type: 'file', path: 'readme.md' },
    ];

    const pruned = pruneFileTreeNodes(tree, ['artifacts']);
    expect(pruned.map((node) => node.path)).toEqual(['readme.md']);
  });
});
