import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../components/file-tree/types/types';
import { ancestorFolderPaths, findFileTreeDirectoryMatch, findFileTreeDirectoryNode, findFileTreeNodePath } from './fileTreeNavigation';

const tree: FileTreeNode[] = [
  {
    name: 'artifacts',
    path: 'artifacts',
    type: 'directory',
    children: [
      {
        name: 'geo',
        path: 'artifacts/geo',
        type: 'directory',
        children: [
          {
            name: 'run-a',
            path: 'artifacts/geo/run-a',
            type: 'directory',
            children: [
              { name: '[1] brief.md', path: 'artifacts/geo/run-a/[1] brief.md', type: 'file' },
              { name: 'chart.png', path: 'artifacts/geo/run-a/chart.png', type: 'file' },
            ],
          },
        ],
      },
    ],
  },
];

describe('fileTreeNavigation', () => {
  it('finds exact tree paths', () => {
    expect(findFileTreeNodePath(tree, 'artifacts/geo/run-a/chart.png'))
      .toBe('artifacts/geo/run-a/chart.png');
  });

  it('resolves bare filenames to the artifacts match', () => {
    expect(findFileTreeNodePath(tree, 'chart.png'))
      .toBe('artifacts/geo/run-a/chart.png');
  });

  it('rejects multiple bare index.html basename matches without hintDir', () => {
    const multi: FileTreeNode[] = [
      {
        name: 'artifacts',
        path: 'artifacts',
        type: 'directory',
        children: [
          {
            name: 'task-a',
            path: 'artifacts/task-a',
            type: 'directory',
            children: [{ name: 'index.html', path: 'artifacts/task-a/index.html', type: 'file' }],
          },
          {
            name: 'task-b',
            path: 'artifacts/task-b',
            type: 'directory',
            children: [{ name: 'index.html', path: 'artifacts/task-b/index.html', type: 'file' }],
          },
        ],
      },
    ];
    expect(findFileTreeNodePath(multi, 'index.html')).toBeNull();
    expect(findFileTreeNodePath(multi, 'index.html', 'artifacts/task-b')).toBe('artifacts/task-b/index.html');
  });

  it('prefers numbered primary files when multiple suffix matches exist', () => {
    const multi: FileTreeNode[] = [
      {
        name: 'artifacts',
        path: 'artifacts',
        type: 'directory',
        children: [
          {
            name: 'a',
            path: 'artifacts/a',
            type: 'directory',
            children: [{ name: 'report.md', path: 'artifacts/a/report.md', type: 'file' }],
          },
          {
            name: 'b',
            path: 'artifacts/b',
            type: 'directory',
            children: [{ name: 'report.md', path: 'artifacts/b/report.md', type: 'file' }],
          },
        ],
      },
    ];
    expect(findFileTreeNodePath(multi, 'artifacts/b/report.md')).toBe('artifacts/b/report.md');
  });

  it('collects ancestor folders down to the file parent', () => {
    expect(ancestorFolderPaths('artifacts/geo/run-a/chart.png')).toEqual([
      'artifacts',
      'artifacts/geo',
      'artifacts/geo/run-a',
    ]);
  });

  it('finds directory node for task folder scope', () => {
    const dir = findFileTreeDirectoryNode(tree, 'artifacts/geo/run-a');
    expect(dir?.path).toBe('artifacts/geo/run-a');
    expect(dir?.children?.length).toBe(2);
  });

  it('returns ancestor paths for directory match', () => {
    const match = findFileTreeDirectoryMatch(tree, 'artifacts/geo/run-a');
    expect(match?.node.path).toBe('artifacts/geo/run-a');
    expect(match?.ancestorPaths).toEqual(['artifacts', 'artifacts/geo']);
  });

  it('prefers hintDir when multiple directory suffix matches exist', () => {
    const multi: FileTreeNode[] = [
      {
        name: 'artifacts',
        path: 'artifacts',
        type: 'directory',
        children: [
          {
            name: 'task-a',
            path: 'artifacts/task-a',
            type: 'directory',
            children: [{ name: 'report.md', path: 'artifacts/task-a/report.md', type: 'file' }],
          },
          {
            name: 'task-b',
            path: 'artifacts/task-b',
            type: 'directory',
            children: [{ name: 'report.md', path: 'artifacts/task-b/report.md', type: 'file' }],
          },
        ],
      },
    ];
    expect(findFileTreeDirectoryNode(multi, 'artifacts/task-b', 'artifacts/task-b')?.path)
      .toBe('artifacts/task-b');
  });
});
