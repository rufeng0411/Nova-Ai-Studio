import { describe, expect, it } from 'vitest';
import {
  NoProgressReadRepeatTracker,
  readOnlySignature,
  buildNoProgressReadNudgeMessage,
  buildNoProgressReadStopMessage,
} from './noProgressReadRepeatTracker.js';

const read = (file: string) => ({ name: 'read_file', input: { file_path: file } });
const write = (file: string) => ({ name: 'write_file', input: { file_path: file, content: 'x' } });

describe('readOnlySignature', () => {
  it('keys read_file/read by file path across param aliases', () => {
    expect(readOnlySignature('read_file', { file_path: 'a/b.html' })).toBe('read:a/b.html');
    expect(readOnlySignature('read', { path: 'a/b.html' })).toBe('read:a/b.html');
    expect(readOnlySignature('read_file', { target_file: 'a/b.html' })).toBe('read:a/b.html');
  });

  it('keys search/skill/grep/glob read-only tools', () => {
    expect(readOnlySignature('web_search', { query: 'world cup' })).toBe('web_search:world cup');
    expect(readOnlySignature('read_skill', { skill: 'nova-research' })).toBe('read_skill:nova-research');
    expect(readOnlySignature('grep', { pattern: 'foo', path: 'src' })).toBe('grep:foo|src|');
    expect(readOnlySignature('glob', { glob_pattern: '**/*.ts' })).toBe('glob:**/*.ts|');
  });

  it('returns null for progress (write/edit/export) tools', () => {
    expect(readOnlySignature('write_file', { file_path: 'a.md' })).toBeNull();
    expect(readOnlySignature('edit_file', { file_path: 'a.md' })).toBeNull();
    expect(readOnlySignature('export_document', {})).toBeNull();
  });
});

describe('NoProgressReadRepeatTracker', () => {
  it('nudges at the 3rd identical read and terminates at the 5th (the worldcup loop)', () => {
    const tracker = new NoProgressReadRepeatTracker();
    const file = 'artifacts/research/worldcup-competitor-benchmark/index.html';
    expect(tracker.record([read(file)])).toBe('none'); // 1
    expect(tracker.record([read(file)])).toBe('none'); // 2
    expect(tracker.record([read(file)])).toBe('nudge'); // 3
    expect(tracker.record([read(file)])).toBe('nudge'); // 4
    expect(tracker.record([read(file)])).toBe('terminal'); // 5
  });

  it('resets when a write/progress tool runs in between (no false positive)', () => {
    const tracker = new NoProgressReadRepeatTracker();
    const file = 'a/b.html';
    expect(tracker.record([read(file)])).toBe('none'); // 1
    expect(tracker.record([read(file)])).toBe('none'); // 2
    expect(tracker.record([write(file)])).toBe('none'); // progress → reset
    expect(tracker.record([read(file)])).toBe('none'); // 1 again
    expect(tracker.record([read(file)])).toBe('none'); // 2
  });

  it('resets when the read target changes (different file = progress)', () => {
    const tracker = new NoProgressReadRepeatTracker();
    expect(tracker.record([read('a.html')])).toBe('none');
    expect(tracker.record([read('a.html')])).toBe('none');
    expect(tracker.record([read('b.html')])).toBe('none'); // new signature resets streak
    expect(tracker.record([read('b.html')])).toBe('none');
    expect(tracker.record([read('b.html')])).toBe('nudge');
  });

  it('does not trip on text-only turns and keeps loop state', () => {
    const tracker = new NoProgressReadRepeatTracker();
    const file = 'a.html';
    expect(tracker.record([read(file)])).toBe('none'); // 1
    expect(tracker.record([read(file)])).toBe('none'); // 2
    expect(tracker.record([])).toBe('none'); // text-only, state preserved
    expect(tracker.record([read(file)])).toBe('nudge'); // 3
  });

  it('treats a mixed read+write turn as progress', () => {
    const tracker = new NoProgressReadRepeatTracker();
    const file = 'a.html';
    expect(tracker.record([read(file)])).toBe('none');
    expect(tracker.record([read(file)])).toBe('none');
    expect(tracker.record([read(file), write(file)])).toBe('none'); // has progress tool → reset
    expect(tracker.record([read(file)])).toBe('none');
  });

  it('honors custom thresholds', () => {
    const tracker = new NoProgressReadRepeatTracker(2, 3);
    const file = 'a.html';
    expect(tracker.record([read(file)])).toBe('none'); // 1
    expect(tracker.record([read(file)])).toBe('nudge'); // 2
    expect(tracker.record([read(file)])).toBe('terminal'); // 3
  });
});

describe('no-progress recovery messages', () => {
  it('builds localized synthetic nudge (user) and stop (assistant) messages', () => {
    const nudgeZh = buildNoProgressReadNudgeMessage('zh-CN');
    expect(nudgeZh.role).toBe('user');
    expect(nudgeZh.metadata?.purpose).toBe('no_progress_read_nudge');
    expect(nudgeZh.metadata?.synthetic).toBe(true);
    expect((nudgeZh.content[0] as { text: string }).text).toContain('write_file');

    const stopZh = buildNoProgressReadStopMessage('zh-CN');
    expect(stopZh.role).toBe('assistant');
    expect(stopZh.metadata?.purpose).toBe('no_progress_read_stop');

    const nudgeEn = buildNoProgressReadNudgeMessage('en');
    expect((nudgeEn.content[0] as { text: string }).text).toContain('write_file');
  });
});
