import { describe, expect, it } from 'vitest';
import i18n from '../i18n/config.js';
import { localizeToolName, localizeToolUiString, localizeTodoStatus } from './localizeToolDisplayText';

const t = i18n.getFixedT('zh-CN', 'chat');

describe('localizeToolDisplayText', () => {
  it('localizes static tool UI strings in zh-CN', () => {
    expect(localizeToolUiString('Parameters', t)).toBe('参数');
    expect(localizeToolUiString('Updating todo list', t)).toBe('正在更新待办清单');
    expect(localizeToolUiString('Found 3 files', t)).toBe('找到 3 个文件');
    expect(localizeToolUiString('in src/', t)).toBe('在 src/ 中');
  });

  it('localizes tool names', () => {
    expect(localizeToolName('read_skill', t)).toBe('读取技能');
    expect(localizeToolName('TodoWrite', t)).toBe('更新待办');
    expect(localizeToolName('write_file', t)).toBe('写入');
  });

  it('localizes todo status chips', () => {
    expect(localizeTodoStatus('in_progress', t)).toBe('进行中');
    expect(localizeTodoStatus('completed', t)).toBe('已完成');
  });

  it('passes through filenames unchanged', () => {
    expect(localizeToolUiString('report.md', t)).toBe('report.md');
  });
});
