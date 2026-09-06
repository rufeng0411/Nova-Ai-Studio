#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Unit tests for the pure deliverable-path extractor used by the
 * multi-task isolation sim. The WS harness itself needs a live Gateway, but the
 * path extraction from tool_call_started.argsPreview is pure and must be robust.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractDeliverablePaths, extractResultPaths } from './gatewaySessionHarness.mjs';

test('extracts write_file path from JSON.stringify argsPreview', () => {
  const preview = JSON.stringify({ path: 'artifacts/qxalpha-brief.md', content: 'hello world' });
  assert.deepEqual(extractDeliverablePaths(preview), ['artifacts/qxalpha-brief.md']);
});

test('extracts snake_case file_path key (write_file actual schema)', () => {
  const preview = JSON.stringify({ file_path: 'artifacts/qxecho-notes.md', content: 'x' });
  assert.deepEqual(extractDeliverablePaths(preview), ['artifacts/qxecho-notes.md']);
});

test('extracts compose/export output path keys', () => {
  const preview = JSON.stringify({ outputPath: 'artifacts/deck/out.pptx', images: ['a.png', 'b.png'] });
  assert.deepEqual(extractDeliverablePaths(preview), ['artifacts/deck/out.pptx']);
});

test('extracts multiple distinct path-like keys without duplicates', () => {
  const preview = JSON.stringify({ path: 'artifacts/x.md', target: 'artifacts/x.md', dest: 'artifacts/y.pdf' });
  const paths = extractDeliverablePaths(preview);
  assert.ok(paths.includes('artifacts/x.md'));
  assert.ok(paths.includes('artifacts/y.pdf'));
  assert.equal(paths.length, 2);
});

test('handles escaped quotes and backslashes in paths', () => {
  // JSON.stringify of a Windows-ish path with a quote is exercised here.
  const preview = '{"path":"artifacts\\\\sub\\\\file.md"}';
  assert.deepEqual(extractDeliverablePaths(preview), ['artifacts\\sub\\file.md']);
});

test('returns empty for inputs without path keys', () => {
  const preview = JSON.stringify({ query: 'hello', limit: 5 });
  assert.deepEqual(extractDeliverablePaths(preview), []);
});

test('returns empty for non-string / empty argsPreview', () => {
  assert.deepEqual(extractDeliverablePaths(undefined), []);
  assert.deepEqual(extractDeliverablePaths(''), []);
  assert.deepEqual(extractDeliverablePaths(null), []);
  assert.deepEqual(extractDeliverablePaths(42), []);
});

test('does not leak foreign slugs when only own path present', () => {
  const preview = JSON.stringify({ path: 'artifacts/qxbravo-titles.md', content: 'x' });
  const paths = extractDeliverablePaths(preview);
  assert.ok(paths.every((p) => !p.includes('qxalpha')));
  assert.ok(paths.some((p) => p.includes('qxbravo')));
});

test('extractResultPaths parses "Created <path>." tool result', () => {
  assert.deepEqual(extractResultPaths('Created artifacts\\diag-probe.md.'), ['artifacts\\diag-probe.md']);
});

test('extractResultPaths parses "Wrote ... to <path>" forms', () => {
  assert.deepEqual(extractResultPaths('Wrote report to artifacts/sub/out.pdf'), ['artifacts/sub/out.pdf']);
});

test('extractResultPaths parses Chinese "已创建/已保存" forms', () => {
  assert.deepEqual(extractResultPaths('已创建 artifacts/qxalpha-brief.md。'), ['artifacts/qxalpha-brief.md']);
});

test('extractResultPaths returns empty for non-path results', () => {
  assert.deepEqual(extractResultPaths('Done. No files changed.'), []);
  assert.deepEqual(extractResultPaths(undefined), []);
  assert.deepEqual(extractResultPaths(''), []);
});
