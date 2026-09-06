import { describe, expect, it, vi } from 'vitest';
import {
  buildLiveTimelineSteps,
  coalesceLiveDockTimelineSteps,
  isEnglishProcessNarration,
  mergeCompletedTimelineSteps,
  normalizeProcessSteps,
} from './processTimelineBuilder';
import type { ProcessTraceStep } from '../components/chat-v2/ProcessTrace';

const t = ((key: string, options?: { defaultValue?: string; done?: number; total?: number; [k: string]: unknown }) => {
  const raw = ({
    'process.recovery.autoContinue': '继续推进',
    'process.recovery.toolRecovery': '自动调整',
    'process.recovery.softFetchRecovery': '换路处理中',
    'process.recovery.autoCompact': '压缩上下文',
    'process.recovery.deliverableValidateFailed': '调整中',
    'process.recovery.adjusting': '调整中',
    'process.stage.sessionPrepare': '正在准备对话',
    'process.stage.memoryRetrieve': '正在读取相关记忆',
    'process.stage.routerJudge': '正在判断任务类型与执行方式',
    'process.thinking.placeholder': '正在整理思路…',
    'process.thinking.activeTitle': '正在思考任务方案',
    'process.thinking.planningTitle': '正在整理执行方案',
    'process.thinking.repairTitle': '正在核对第 {{done}}/{{total}} 项成果',
    'working.thinking': '思考中',
  }[key] ?? options?.defaultValue ?? key) as string;
  return raw
    .replace(/\{\{done\}\}/g, String(options?.done ?? ''))
    .replace(/\{\{total\}\}/g, String(options?.total ?? ''));
}) as never;

describe('processTimelineBuilder', () => {
  it('filters English process narration in zh mode', () => {
    expect(isEnglishProcessNarration('The user wants a marketing deck')).toBe(true);
    const steps = normalizeProcessSteps(
      [
        {
          id: '1',
          kind: 'thinking',
          title: '思考',
          detail: 'The user wants me to build slides',
          phase: 'thinking',
        },
        {
          id: '2',
          kind: 'read',
          title: '正在读取 report.md',
          detail: 'report.md',
        },
      ],
      t,
      { localeIsZh: true, processDetailLevel: 'standard' },
    );
    expect(steps[0]?.detail).toBe('正在整理思路…');
    expect(steps[1]?.title).toContain('report');
  });

  it('dedupes consecutive recovery steps', () => {
    const steps = normalizeProcessSteps(
      [
        { id: 'r1', kind: 'recovery', phase: 'recovery', title: 'tool_recovery' },
        { id: 'r2', kind: 'recovery', phase: 'recovery', title: 'auto_continue' },
        { id: 't1', kind: 'read', title: 'read', detail: 'a.md' },
      ],
      t,
      { localeIsZh: true },
    );
    expect(steps.filter((s) => s.kind === 'recovery')).toHaveLength(1);
    expect(steps[0]?.title).toBe('继续推进');
  });

  it('maps raw stage keys before rendering in zh mode', () => {
    const steps = normalizeProcessSteps(
      [
        { id: 's1', title: 'session_prepare', phase: 'tool' },
        { id: 's2', title: 'memory_retrieve', phase: 'tool' },
        { id: 's3', title: 'router_judge', phase: 'tool' },
      ],
      t,
      { localeIsZh: true },
    );
    expect(steps.map((step) => step.title)).toEqual([
      '正在准备对话',
      '正在读取相关记忆',
      '正在判断任务类型与执行方式',
    ]);
    expect(JSON.stringify(steps)).not.toMatch(/session_prepare|memory_retrieve|router_judge/);
  });

  it('drops raw stage key details when the title is already localized', () => {
    const steps = normalizeProcessSteps(
      [
        { id: 's1', title: '正在准备对话', detail: 'session_prepare', phase: 'tool' },
        { id: 's2', title: '正在读取相关记忆', detail: 'memory_retrieve', phase: 'tool' },
        { id: 's3', title: '正在判断任务类型与执行方式', detail: 'router_judge', phase: 'tool' },
      ],
      t,
      { localeIsZh: true },
    );

    expect(steps.map((step) => step.detail)).toEqual([undefined, undefined, undefined]);
    expect(JSON.stringify(steps)).not.toMatch(/session_prepare|memory_retrieve|router_judge/);
  });

  it('maps recovery reason details without leaking raw keys', () => {
    const steps = normalizeProcessSteps(
      [
        { id: 'r1', kind: 'recovery', phase: 'recovery', title: 'auto_continue' },
        { id: 'r2', kind: 'recovery', phase: 'recovery', title: 'deliverable_validate_failed' },
      ],
      t,
      { localeIsZh: true },
    );
    expect(steps[0]?.title).toBe('调整中');
    expect(JSON.stringify(steps)).not.toMatch(/auto_continue|deliverable_validate_failed/);
  });

  it('uses repair thinking title when session is in deliverable repair', () => {
    const steps = normalizeProcessSteps(
      [
        {
          id: 'think-repair',
          kind: 'thinking',
          title: '思考',
          detail: 'The user wants deliverables fixed',
          phase: 'thinking',
        },
      ],
      t,
      {
        localeIsZh: true,
        sessionTaskPhase: 'deliverable_repair_pending',
        sdmProgressDone: 2,
        sdmProgressTotal: 5,
      },
    );
    expect(steps[0]?.title).toBe('正在核对第 2/5 项成果');
  });

  it('uses planning thinking title after exit_plan_mode', () => {
    const steps = normalizeProcessSteps(
      [
        {
          id: 'think-plan',
          kind: 'thinking',
          title: '思考',
          phase: 'thinking',
        },
      ],
      t,
      {
        localeIsZh: true,
        latestToolName: 'exit_plan_mode',
      },
    );
    expect(steps[0]?.title).toBe('正在整理执行方案');
  });

  it('returns empty array on malformed input without throwing', () => {
    expect(normalizeProcessSteps(null as unknown as ProcessTraceStep[], t)).toEqual([]);
  });

  it('buildLiveTimelineSteps slices to maxVisibleSteps for live', () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `tool-${index}`,
      type: 'assistant',
      timestamp: new Date(0).toISOString(),
      isToolUse: true,
      toolName: 'read_file',
      toolInput: { file_path: `file-${index}.md` },
      toolResult: { isError: false },
    }));
    const steps = buildLiveTimelineSteps(messages, [], t, {
      maxVisibleSteps: 5,
      localeIsZh: true,
    });
    expect(steps.length).toBeLessThanOrEqual(5);
  });

  it('preserves Chinese thinking summary', () => {
    const steps = buildLiveTimelineSteps(
      [
        {
          id: 'think-1',
          type: 'assistant',
          timestamp: new Date(0).toISOString(),
          isThinking: true,
          content: '先梳理用户需求，再确定交付结构。',
        },
      ],
      [],
      t,
      { localeIsZh: true, processDetailLevel: 'standard' },
    );
    expect(steps.some((s) => s.kind === 'thinking')).toBe(true);
    const thinking = steps.find((s) => s.kind === 'thinking');
    expect(thinking?.title).toBe('正在思考任务方案');
    expect(thinking?.detail).toMatch(/梳理|需求/);
  });

  it('turns English thinking narration into a positive zh placeholder', () => {
    const steps = buildLiveTimelineSteps(
      [
        {
          id: 'think-english',
          type: 'assistant',
          timestamp: new Date(0).toISOString(),
          isThinking: true,
          content: 'The user asked me to inspect the repo before editing',
        },
      ],
      [],
      t,
      { localeIsZh: true, processDetailLevel: 'standard' },
    );
    const thinking = steps.find((s) => s.kind === 'thinking');
    expect(thinking?.title).toBe('正在思考任务方案');
    expect(thinking?.detail).toBe('正在整理思路…');
  });

  it('coalesceLiveDockTimelineSteps uses fallback when tool rows are empty', () => {
    const fallback = {
      id: 'live-thinking',
      title: '正在思考任务方案',
      state: 'running',
      phase: 'thinking',
    };
    expect(coalesceLiveDockTimelineSteps([], fallback)).toEqual([fallback]);
    expect(coalesceLiveDockTimelineSteps([{ id: 's1', title: '搜索', kind: 'search' }], fallback)).toHaveLength(1);
  });

  it('preserves English tool activity rows in zh UI', () => {
    const steps = buildLiveTimelineSteps(
      [],
      [
        {
          id: 'activity-1',
          type: 'system',
          timestamp: new Date(0).toISOString(),
          isAgentActivity: true,
          activityId: 'activity-1',
          title: 'Searching files',
          phase: 'rag',
          state: 'running',
        },
      ],
      t,
      { localeIsZh: true },
    );
    expect(steps.some((step) => step.title === 'Searching files')).toBe(true);
  });

  it('mergeCompletedTimelineSteps returns [] for malformed attachments', () => {
    expect(mergeCompletedTimelineSteps(null as never, t)).toEqual([]);
  });
});
