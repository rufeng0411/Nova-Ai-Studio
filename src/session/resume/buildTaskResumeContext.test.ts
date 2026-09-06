import { describe, expect, it } from 'vitest';
import {
  buildTaskResumeContextFromTranscript,
  detectIncompleteTurn,
} from './buildTaskResumeContext.js';
import type { AgentTranscriptEntry } from '../transcript/TranscriptEntry.js';

describe('buildTaskResumeContext', () => {
  it('detects incomplete turn without turn_result', () => {
    const entries: AgentTranscriptEntry[] = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '写 summer 营销方案' }] }],
      },
      {
        type: 'tool_result_message',
        sessionId: 's1',
        turnId: 't1',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'wrote artifacts/plan.md' }],
        },
      },
    ];
    const summary = detectIncompleteTurn(entries);
    expect(summary?.turnId).toBe('t1');
    expect(summary?.userGoal).toContain('营销');
    const xml = buildTaskResumeContextFromTranscript(entries);
    expect(xml).toContain('<task-resume');
  });

  it('returns null when turn completed', () => {
    const entries: AgentTranscriptEntry[] = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      },
      {
        type: 'turn_result',
        sessionId: 's1',
        turnId: 't1',
        sequence: 2,
        createdAt: '2026-01-01T00:00:02.000Z',
        result: {
          type: 'success',
          sessionId: 's1',
          turnId: 't1',
          stopReason: 'end_turn',
          usage: {},
          permissionDenials: [],
          turns: 1,
          startedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:00:02.000Z',
        },
      },
    ];
    expect(detectIncompleteTurn(entries)).toBeNull();
  });

  it('does not cold-resume pure greeting without deliverable slots', () => {
    const entries: AgentTranscriptEntry[] = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '你好啊' }] }],
      },
      {
        type: 'assistant_message',
        sessionId: 's1',
        turnId: 't1',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '你好！有什么可以帮你的？' }],
        },
      },
    ];
    expect(detectIncompleteTurn(entries)).toBeNull();
    expect(buildTaskResumeContextFromTranscript(entries)).toBeNull();
  });

  it('includes verified/missing files, stuck step, and recovery owner in resume XML', () => {
    const entries = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '做 campaign 全案并交付 docx' }] }],
      },
      {
        type: 'turn_progress',
        sessionId: 's1',
        turnId: 't1',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        stepIndex: 3,
        toolName: 'write_file',
        artifactPaths: ['artifacts/research.md'],
        verifiedPaths: ['artifacts/research.md'],
        missingPaths: ['artifacts/brief.docx'],
        summaryZh: '卡在 Word 导出',
        recoveryOwner: 'deliverable_repair',
      },
    ] as unknown as AgentTranscriptEntry[];

    const xml = buildTaskResumeContextFromTranscript(entries);
    expect(xml).toContain('<verified_paths>artifacts/research.md</verified_paths>');
    expect(xml).toContain('<missing_paths>artifacts/brief.docx</missing_paths>');
    expect(xml).toContain('<stuck_step>卡在 Word 导出</stuck_step>');
    expect(xml).toContain('<recovery_owner>deliverable_repair</recovery_owner>');
  });

  it('includes acceptance meta verified, missing, and broken deliverables in resume XML', () => {
    const entries = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '做 campaign 全案' }] }],
      },
      {
        type: 'turn_acceptance_meta',
        sessionId: 's1',
        turnId: 't1',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        verifiedPaths: ['artifacts/campaign/research.md'],
        missingPaths: ['artifacts/campaign/brief.docx'],
        brokenPaths: ['artifacts/campaign/index.html'],
        continuationOwner: 'deliverable_repair',
      },
    ] as unknown as AgentTranscriptEntry[];

    const xml = buildTaskResumeContextFromTranscript(entries);
    expect(xml).toContain('<verified_paths>artifacts/campaign/research.md</verified_paths>');
    expect(xml).toContain('<missing_paths>artifacts/campaign/brief.docx</missing_paths>');
    expect(xml).toContain('<broken_paths>artifacts/campaign/index.html</broken_paths>');
    expect(xml).toContain('<recovery_owner>deliverable_repair</recovery_owner>');
  });

  it('keeps original user goal when latest user text is only continue', () => {
    const entries = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '帮我做吴裕泰夏季营销 campaign 全案' }] }],
      },
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't2',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '继续' }] }],
      },
    ] as unknown as AgentTranscriptEntry[];

    const summary = detectIncompleteTurn(entries);
    expect(summary?.turnId).toBe('t2');
    expect(summary?.userGoal).toContain('吴裕泰夏季营销');
  });

  it('skips nested task-resume prompts when resolving user goal', () => {
    const resumeXml = [
      '<task-resume context="infra_interrupt">',
      '  <last_turn_id>t0</last_turn_id>',
      '  <user_goal>为啥不开始？</user_goal>',
      '</task-resume>',
    ].join('\n');
    const entries = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't1',
        sequence: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '帮我做韩国市场 PPT' }] }],
      },
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 't2',
        sequence: 2,
        createdAt: '2026-01-01T00:00:01.000Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: resumeXml }] }],
      },
    ] as unknown as AgentTranscriptEntry[];

    const summary = detectIncompleteTurn(entries);
    expect(summary?.turnId).toBe('t2');
    expect(summary?.userGoal).toContain('韩国市场 PPT');
    expect(summary?.userGoal).not.toContain('<task-resume');
  });

  it('detects latest incomplete turn after aborted_streaming + subagent (not synthetic turn-1)', () => {
    const entries = [
      {
        type: 'accepted_input',
        sessionId: 's1',
        turnId: 'turn-1',
        sequence: 1,
        synthetic: true,
        createdAt: '2026-07-24T06:43:03.432Z',
        messages: [{ role: 'user', content: [{ type: 'text', text: '为蔚来ES9做 Battlecard 三步交付' }] }],
      },
      {
        type: 'turn_result',
        sessionId: 's1',
        turnId: 'turn-a',
        sequence: 8,
        createdAt: '2026-07-24T06:44:39.981Z',
        result: { type: 'aborted', stopReason: 'aborted_streaming' },
      },
      {
        type: 'assistant_message',
        sessionId: 's1',
        turnId: 'turn-b',
        sequence: 11,
        createdAt: '2026-07-24T06:46:24.832Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_call', id: 'call_0', name: 'agent', input: {} }],
        },
      },
      {
        type: 'subagent_started',
        sessionId: 's1',
        turnId: 'turn-b',
        sequence: 12,
        createdAt: '2026-07-24T06:46:24.842Z',
        subagentId: 'sub-1',
        subagentType: 'general-purpose',
      },
    ] as unknown as AgentTranscriptEntry[];

    const summary = detectIncompleteTurn(entries);
    expect(summary?.turnId).toBe('turn-b');
    expect(summary?.userGoal).toContain('蔚来ES9');
    expect(summary?.stuckStep).toContain('子任务');
  });
});
