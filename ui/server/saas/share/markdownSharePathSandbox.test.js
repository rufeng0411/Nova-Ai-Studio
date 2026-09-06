import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  isPathInsideMarkdownSubtree,
  resolveShareAssetPath,
} from './markdownSharePathSandbox.js';

describe('markdownSharePathSandbox', () => {
  const mdAbs = path.join('F:', 'ws', 'artifacts', 'task-1', 'report.md');

  it('allows same-dir and nested assets', () => {
    const a = resolveShareAssetPath(mdAbs, 'assets/hero.png');
    assert.equal(a.ok, true);
    assert.ok(isPathInsideMarkdownSubtree(mdAbs, a.absolutePath));
  });

  it('rejects traversal and absolute', () => {
    assert.equal(resolveShareAssetPath(mdAbs, '../secret.txt').ok, false);
    assert.equal(resolveShareAssetPath(mdAbs, '/etc/passwd').ok, false);
  });
});
