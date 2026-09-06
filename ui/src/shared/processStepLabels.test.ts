import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
  formatToolDisplayName,
  localizeProcessTraceStep,
  summarizeThinkingContent,
} from './processStepLabels';

const ZH_KEYS: Record<string, string> = {
  'process.tool.read': '读取',
  'process.tool.readFile': '读取文件',
  'process.tool.fetchPageImages': '抓取页面图片',
  'process.tool.webSearch': '联网搜索',
  'process.tool.thinking': '思考',
  'process.tool.grep': '搜索代码',
  'process.tool.exportDocument': '导出文档',
  'process.stage.sessionPrepare': '正在准备对话',
  'process.stage.memoryRetrieve': '正在读取相关记忆',
  'process.stage.routerJudge': '正在判断任务类型与执行方式',
  'process.status.deliverableRepair': '正在修复成果',
  'process.live.runningSearchTarget': '正在搜索 {{target}}',
  'process.step': '步骤',
};

const t = ((key: string, opts?: { defaultValue?: string; target?: string; tool?: string }) => {
  const mapped = ZH_KEYS[key];
  if (mapped) {
    return mapped.replace('{{target}}', String(opts?.target ?? ''));
  }
  return opts?.defaultValue ?? key;
}) as TFunction<'chat'>;

describe('processStepLabels', () => {
  it('formatToolDisplayName uses i18n keys', () => {
    expect(formatToolDisplayName('read_file', t)).toBe('读取文件');
    expect(formatToolDisplayName('fetch_page_images', t)).toBe('抓取页面图片');
  });

  it('formatToolDisplayName hides common raw tool keys in zh labels', () => {
    expect(formatToolDisplayName('export_document', t)).toBe('导出文档');
    expect(formatToolDisplayName('ExportDocument', t)).toBe('导出文档');
  });

  it('localizeProcessTraceStep maps raw stage and status keys', () => {
    expect(localizeProcessTraceStep({ title: 'session_prepare' }, t).title).toBe('正在准备对话');
    expect(localizeProcessTraceStep({ title: 'memory_retrieve' }, t).title).toBe('正在读取相关记忆');
    expect(localizeProcessTraceStep({ title: 'router_judge' }, t).title).toBe('正在判断任务类型与执行方式');
    expect(localizeProcessTraceStep({ title: 'deliverable_repair' }, t).title).toBe('正在修复成果');
  });

  it('localizeProcessTraceStep resolves structured kind', () => {
    const localized = localizeProcessTraceStep(
      { kind: 'search', toolName: 'web_search', target: '发烧硬件' },
      t,
    );
    expect(localized.title).toContain('发烧硬件');
  });

  it('localizeProcessTraceStep maps thinking kind', () => {
    const localized = localizeProcessTraceStep(
      { kind: 'thinking', detail: '先梳理需求再搜索资料' },
      t,
    );
    expect(localized.title).toBe('思考');
  });

  it('summarizeThinkingContent truncates long text', () => {
    const long = 'a'.repeat(200);
    expect(summarizeThinkingContent(long, 50).endsWith('…')).toBe(true);
  });
});
