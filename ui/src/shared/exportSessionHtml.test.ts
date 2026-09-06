import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedMessage } from '../stores/useSessionStore';
import {
  buildSessionExportFilename,
  buildSessionExportHtml,
  coSourceExportSessionHistory,
  DIAGNOSTIC_EXPORT_MAX_BYTES,
  fetchAllSessionMessagesForExport,
  filterMessagesForExport,
  finalizeSessionExportHtml,
  markdownToExportHtml,
  shouldBlockSessionExportForValidation,
  USER_ARCHIVE_EXPORT_MAX_BYTES,
} from './exportSessionHtml';
import { buildExportSnapshotEnvelope } from './exportSnapshotEnvelope';

const { authenticatedFetchMock } = vi.hoisted(() => ({
  authenticatedFetchMock: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  authenticatedFetch: authenticatedFetchMock,
}));

const labels = {
  exportedAt: 'Exported',
  project: 'Project',
  sessionId: 'Session',
  messageCount: 'Messages',
  messageId: 'Message ID',
  messageKind: 'Kind',
  messageIndex: 'Index',
  turnId: 'Turn ID',
  toolId: 'Tool ID',
  runId: 'Run ID',
  sequence: 'Sequence',
  messageIndexTable: 'Message ID index',
  debugManifest: 'Structured index',
  timestamp: 'Time',
  user: 'User',
  assistant: 'Assistant',
  toolCall: 'Tool',
  toolResult: 'Result',
  thinking: 'Thinking',
  error: 'Error',
  system: 'System',
  attachments: 'Attachments',
  images: 'Image',
  activity: 'Activity',
  noMessages: 'No messages',
};

describe('shouldBlockSessionExportForValidation', () => {
  it('allows chat-only sessions even when pipeline is unsettled', () => {
    expect(shouldBlockSessionExportForValidation({
      requireValidationSettled: true,
      taskKind: 'chat',
      executionStatus: 'idle',
      pipelineSettled: false,
    })).toBe(false);
  });

  it('allows completed deliverable sessions with unsettled validation for RCA export', () => {
    expect(shouldBlockSessionExportForValidation({
      requireValidationSettled: true,
      taskKind: 'deliverable',
      executionStatus: 'paused',
      pipelineSettled: false,
    })).toBe(false);
  });

  it('blocks only in-flight deliverable sessions while validation is pending', () => {
    expect(shouldBlockSessionExportForValidation({
      requireValidationSettled: true,
      taskKind: 'deliverable',
      executionStatus: 'running',
      pipelineSettled: false,
    })).toBe(true);
    expect(shouldBlockSessionExportForValidation({
      requireValidationSettled: true,
      taskKind: 'deliverable',
      executionStatus: 'queued',
      pipelineSettled: false,
    })).toBe(true);
    expect(shouldBlockSessionExportForValidation({
      requireValidationSettled: true,
      taskKind: 'deliverable',
      executionStatus: 'running',
      pipelineSettled: true,
    })).toBe(false);
  });
});

describe('exportSessionHtml', () => {
  afterEach(() => {
    authenticatedFetchMock.mockReset();
  });

  // PD-SAAS-FORK: sidebar HTML export must share messages 503/429 backoff with session open.
  it('retries messages fetch on 503 backpressure then exports successfully', async () => {
    const message: NormalizedMessage = {
      id: 'm-export-503',
      sessionId: 'session-export-503',
      timestamp: '2026-01-01T00:00:00.000Z',
      provider: 'pilotdeck',
      kind: 'text',
      role: 'user',
      content: '导出重试',
    };
    authenticatedFetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: (name: string) => (name === 'Retry-After' ? '0' : null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          messages: [message],
          total: 1,
          nextCursor: null,
          offset: 0,
        }),
      });

    const result = await fetchAllSessionMessagesForExport({
      sessionId: 'session-export-503',
      projectName: 'general',
      mode: 'user_archive',
    });

    expect(authenticatedFetchMock).toHaveBeenCalledTimes(2);
    expect(String(authenticatedFetchMock.mock.calls[0]?.[0] ?? '')).toContain('purpose=export');
    expect(result.messages.map((item) => item.id)).toEqual(['m-export-503']);
    expect(result.truncated).toBe(false);
  });

  it('co-sources history envelopes onto an existing assistant without adding a visible message', () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'u-envelope',
        sessionId: 'session-envelope',
        timestamp: '2026-01-01T00:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'user',
        content: '交付报告',
      },
      {
        id: 'a-envelope',
        sessionId: 'session-envelope',
        timestamp: '2026-01-01T00:00:01.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'assistant',
        content: '已完成',
      },
    ];
    const manifest = {
      manifestVersion: 1,
      goalVersion: 2,
      sessionGoalAnchor: '交付报告',
      slots: [{
        id: 'report',
        label: '报告',
        pathHint: 'report.md',
        required: true,
        status: 'active' as const,
      }],
    };
    const taskDirectory = {
      taskArtifactDir: 'artifacts/task-export-envelope',
      taskDirKey: 'task-export-envelope',
      goalVersion: 2,
      allocatedAt: '2026-01-01T00:00:00.000Z',
    };

    const chatMessages = coSourceExportSessionHistory(messages, {
      latestTurnAcceptanceMeta: {
        acceptanceStatus: 'needs_repair',
        goalVersion: 2,
      },
      sessionDeliverableManifest: manifest,
      sessionTaskDirectory: taskDirectory,
    });

    expect(chatMessages).toHaveLength(2);
    expect(chatMessages[1]).toMatchObject({
      id: 'a-envelope',
      turnAcceptanceMeta: {
        acceptanceStatus: 'needs_repair',
        goalVersion: 2,
      },
      sessionDeliverableManifest: manifest,
      sessionTaskDirectory: taskDirectory,
    });
  });

  it('retains a detached history envelope without inventing an assistant export message', () => {
    const scopeDir = 'artifacts/task-20260718-e7c0ffee';
    const messages: NormalizedMessage[] = [{
      id: 'u-detached-envelope',
      sessionId: 'session-detached-envelope',
      timestamp: '2026-01-01T00:00:00.000Z',
      provider: 'pilotdeck',
      kind: 'text',
      role: 'user',
      content: '交付报告',
    }];

    const html = buildSessionExportHtml({
      title: '无助手历史页',
      projectName: 'general',
      sessionId: 'session-detached-envelope',
      exportMode: 'diagnostic',
      messages,
      labels,
      sessionHistoryEnvelope: {
        latestTurnAcceptanceMeta: {
          acceptanceStatus: 'needs_repair',
          goalVersion: 2,
        },
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 2,
          sessionGoalAnchor: '交付报告',
          taskArtifactDir: scopeDir,
          slots: [{
            id: 'report',
            label: '报告',
            pathHint: 'report.md',
            required: true,
            status: 'active',
          }],
        },
        sessionTaskDirectory: {
          taskArtifactDir: scopeDir,
          taskDirKey: 'task-20260718-e7c0ffee',
          goalVersion: 2,
          allocatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    expect(html).toContain(scopeDir);
    expect(html).toContain('报告');
    expect(html).toContain('u-detached-envelope');
    expect(html).not.toContain('synthetic-history-envelope');
  });

  it('filters streaming noise', () => {
    const messages: NormalizedMessage[] = [
      { id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00.000Z', provider: 'pilotdeck', kind: 'stream_delta', text: 'partial' },
      { id: '2', sessionId: 's1', timestamp: '2026-01-01T00:00:01.000Z', provider: 'pilotdeck', kind: 'text', role: 'user', content: 'hello' },
    ];
    expect(filterMessagesForExport(messages)).toHaveLength(1);
  });

  it('renders readable html with session and message ids', () => {
    const html = buildSessionExportHtml({
      title: '测试对话',
      projectName: 'general',
      sessionId: 'session-1',
      messages: [
        {
          id: 'msg-user-001',
          sessionId: 'session-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '# 标题\n\n正文 **加粗**',
          turnId: 'turn-abc',
        },
      ],
      labels,
    });
    expect(html).toContain('meta name="nova-session-id" content="session-1"');
    expect(html).toContain('data-message-id="msg-user-001"');
    expect(html).toContain('msg-user-001');
    expect(html).toContain('turn-abc');
    expect(html).toContain('nova-session-export-index');
    expect(html).toContain('<h1>标题</h1>');
  });

  it('EX-01: embeds deliverable summary when verified paths present', () => {
    const html = buildSessionExportHtml({
      title: '四格式包',
      projectName: 'general',
      sessionId: 'session-68439f81',
      messages: [
        {
          id: 'msg-a1',
          sessionId: 'session-68439f81',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '已完成交付',
          verifiedDeliverablePaths: [
            'artifacts/report.md',
            'artifacts/report.pdf',
          ],
          turnAcceptanceMeta: {
            acceptanceStatus: 'passed',
            verifiedPaths: ['artifacts/report.md', 'artifacts/report.pdf'],
          },
        },
      ],
      labels,
    });
    expect(html).toContain('成果清单');
    expect(html).toContain('data-testid="deliverable-summary-table"');
    expect(html).toContain('artifacts/report.md');
    expect(html.indexOf('<section class="messages">')).toBeLessThan(
      html.indexOf('data-testid="deliverable-summary-table"'),
    );
  });

  it('keeps unmatched export rows checking when the folder snapshot is truncated', () => {
    const scopeDir = 'artifacts/task-export-truncated';
    const html = buildSessionExportHtml({
      title: '截断快照',
      projectName: 'general',
      sessionId: 'session-export-truncated',
      diskSnapshotVersion: 2,
      diskSnapshotComplete: false,
      diskSnapshot: [{
        path: `${scopeDir}/report-a.md`,
        basename: 'report-a.md',
        inContract: true,
        slotId: 'report_a',
        unitId: 'report_a',
        snapshotState: 'inconclusive',
      }],
      messages: [
        {
          id: 'u1',
          sessionId: 'session-export-truncated',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '交付双报告',
        },
        {
          id: 'a1',
          sessionId: 'session-export-truncated',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '',
          sessionDeliverableManifest: {
            manifestVersion: 1,
            goalVersion: 1,
            sessionGoalAnchor: '交付双报告',
            taskArtifactDir: scopeDir,
            slots: [
              {
                id: 'report_a',
                label: '报告 A',
                kind: 'markdown',
                pathHint: 'report-a.md',
                required: true,
                status: 'active',
              },
              {
                id: 'report_b',
                label: '报告 B',
                kind: 'markdown',
                pathHint: 'report-b.md',
                required: true,
                status: 'active',
              },
            ],
          },
        } as NormalizedMessage,
      ],
      labels,
    });

    expect(html).toContain('class="status-delivered"');
    expect(html).toContain('校验中');
    expect(html).not.toContain('>未完成<');
  });

  it('renders four-line debug block after messages with ids and folder list', () => {
    const html = buildSessionExportHtml({
      title: '调试导出',
      projectName: 'general',
      sessionId: 'web-s_test-session',
      exportMode: 'diagnostic',
      workspaceUuid: 'ws-uuid-001',
      diskSnapshot: [
        {
          path: 'artifacts/faq-dutch-goji/index.html',
          basename: 'index.html',
          inContract: true,
          slotId: 'slot_1',
        },
      ],
      messages: [
        {
          id: 'user-1',
          sessionId: 'web-s_test-session',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '生成 FAQ',
        },
        {
          id: 'assist-1',
          sessionId: 'web-s_test-session',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '已完成',
          sessionTaskDirectory: {
            taskArtifactDir: 'artifacts/faq-dutch-goji',
            taskDirKey: 'faq-dutch-goji',
            goalVersion: 1,
          },
          verifiedDeliverablePaths: ['artifacts/faq-dutch-goji/index.html'],
        } as NormalizedMessage,
      ],
      labels,
    });

    expect(html).toContain('data-testid="export-four-line-debug"');
    expect(html).toContain('data-testid="export-debug-ids"');
    expect(html).toContain('data-testid="folder-content-table"');
    expect(html).toContain('web-s_test-session');
    expect(html).toContain('faq-dutch-goji');
    expect(html).toContain('artifacts/faq-dutch-goji/index.html');
    expect(html).toContain('ws-uuid-001');
    expect(html).toContain('fourLineDebug');
    expect(html.indexOf('<section class="messages">')).toBeLessThan(
      html.indexOf('data-testid="export-four-line-debug"'),
    );
  });

  it('prefixes export filename with session id', () => {
    const filename = buildSessionExportFilename('测试对话', 'session-1');
    expect(filename.startsWith('session-1__')).toBe(true);
    expect(filename.endsWith('.html')).toBe(true);
  });

  it('escapes raw html in markdown conversion', () => {
    expect(markdownToExportHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });

  it('rejects executable markdown link protocols while preserving safe links', () => {
    const html = markdownToExportHtml([
      '[http](http://example.com/a?x=1&y=2)',
      '[https](https://example.com/report)',
      '[mail](mailto:owner@example.com)',
      '[relative](artifacts/task-x/report.html)',
      '[js](javascript:alert(1))',
      '[data](data:text/html;base64,PHNjcmlwdD4=)',
      '[vb](vbscript:msgbox(1))',
      '[traversal](%2e%2e/private.txt)',
    ].join('\n'));

    expect(html).toContain('href="http://example.com/a?x=1&amp;y=2"');
    expect(html).toContain('href="https://example.com/report"');
    expect(html).toContain('href="mailto:owner@example.com"');
    expect(html).toContain('href="artifacts/task-x/report.html"');
    expect(html).not.toMatch(/href="(?:javascript|data|vbscript):/i);
    expect(html).not.toContain('href="%2e%2e/private.txt"');
  });

  it('escapes image attributes and rejects unsafe image sources', () => {
    const html = buildSessionExportHtml({
      title: '图片安全',
      projectName: 'general',
      sessionId: 'session-image-xss',
      messages: [
        {
          id: 'a1',
          sessionId: 'session-image-xss',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '图片如下',
          images: [
            'https://cdn.example.com/safe.png?x=1&y=2',
            'artifacts/task-x/safe.png',
            'https://evil.example/x.png" onerror="alert(1)',
            'javascript:alert(2)',
            'data:image/png;base64,QQ==',
          ],
        },
        {
          id: 'tool-1',
          sessionId: 'session-image-xss',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_file',
          toolResult: { content: 'ok', isError: false },
          toolResultImages: [{
            data: 'https://cdn.example.com/tool.png',
            name: '" onerror="alert(3)',
          }],
        },
      ],
      labels,
    });

    expect(html).toContain('src="https://cdn.example.com/safe.png?x=1&amp;y=2"');
    expect(html).toContain('src="artifacts/task-x/safe.png"');
    expect(html).toContain('src="https://cdn.example.com/tool.png"');
    expect(html).toContain('alt="&quot; onerror=&quot;alert(3)"');
    expect(html).not.toContain('onerror="alert');
    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('src="[embedded-data-redacted]"');
    expect(html).not.toMatch(/<img[^>]+src="(?:javascript|data):/i);
  });

  it('renders markdown tables as readable html', () => {
    const html = markdownToExportHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<table class="md-table">');
    expect(html).toContain('<td>1</td>');
  });

  it('embeds inline deliverable summary in assistant turns', () => {
    const html = buildSessionExportHtml({
      title: '审计',
      projectName: 'general',
      sessionId: 'session-inline',
      exportOrigin: 'https://example.test',
      messages: [
        {
          id: 'u1',
          sessionId: 'session-inline',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '做报告',
        },
        {
          id: 'a1',
          sessionId: 'session-inline',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '交付如下',
          verifiedDeliverablePaths: ['artifacts/report.md'],
          expectedManifest: [
            { id: 'slot_md', label: '报告', kind: 'markdown', path: 'artifacts/report.md' },
            { id: 'slot_pdf', label: 'PDF', kind: 'pdf', path: 'artifacts/report.pdf' },
          ],
          missingPaths: ['artifacts/report.pdf'],
        },
      ],
      labels,
    });
    expect(html).toContain('data-testid="export-turn-pointer"');
    expect(html).toContain('1/2 项成果');
    const visibleHtml = html.split('<details class="debug-manifest">')[0]!;
    expect(visibleHtml).not.toContain('access-links');
    expect(visibleHtml).not.toMatch(/<a href="[^"]*\/api\/projects\//);
  });

  it('keeps access urls in json manifest only, not visible html tables', () => {
    const html = buildSessionExportHtml({
      title: '链接导出',
      projectName: 'general',
      sessionId: 'session-urls',
      exportMode: 'diagnostic',
      exportOrigin: 'https://example.test',
      diskSnapshot: [
        {
          path: 'artifacts/faq-dutch-goji/index.html',
          basename: 'index.html',
          inContract: true,
          slotId: 'slot_html',
        },
      ],
      messages: [
        {
          id: 'a1',
          sessionId: 'session-urls',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '已完成',
          sessionTaskDirectory: {
            taskArtifactDir: 'artifacts/faq-dutch-goji',
            taskDirKey: 'faq-dutch-goji',
            goalVersion: 1,
          },
          verifiedDeliverablePaths: ['artifacts/faq-dutch-goji/index.html'],
        } as NormalizedMessage,
      ],
      labels,
    });

    expect(html).toContain('index.html');
    expect(html).toContain('&quot;access&quot;');
    expect(html).toContain('taskFolderSnapshotAbsoluteUrl');
    const visibleHtml = html.split('<details class="debug-manifest">')[0]!;
    expect(visibleHtml).not.toContain('class="access-links"');
    expect(visibleHtml).not.toMatch(/<a href="https:\/\/example\.test\/api\/projects/);
  });

  it('embeds snapshot envelope in manifest json when provided', () => {
    const html = buildSessionExportHtml({
      title: '快照导出',
      projectName: 'general',
      sessionId: 'session-snapshot',
      exportMode: 'user_archive',
      snapshotEnvelope: buildExportSnapshotEnvelope({
        mode: 'user_archive',
        taskKind: 'chat',
      }),
      messages: [
        {
          id: 'u1',
          sessionId: 'session-snapshot',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '你好',
        },
      ],
      labels,
    });

    expect(html).toContain('data-export-mode="user_archive"');
    expect(html).toContain('&quot;snapshotVersion&quot;: 2');
    expect(html).toContain('&quot;taskKind&quot;: &quot;chat&quot;');
    expect(html).toContain('&quot;snapshotCompleteness&quot;: &quot;chat_only&quot;');
    expect(html).not.toContain('data-testid="export-debug-ids"');
  });

  it.each([
    {
      lifecyclePhase: 'turn_streaming' as const,
      executionStatus: 'running' as const,
    },
    {
      lifecyclePhase: 'turn_queued' as const,
      executionStatus: 'queued' as const,
    },
    {
      lifecyclePhase: 'deliverable_repair_pending' as const,
      executionStatus: 'idle' as const,
    },
  ])('labels $lifecyclePhase deliverable exports as in-progress snapshots', ({
    lifecyclePhase,
    executionStatus,
  }) => {
    const html = buildSessionExportHtml({
      title: '非终态成果',
      projectName: 'general',
      sessionId: 'session-nonterminal',
      exportMode: 'user_archive',
      snapshotEnvelope: buildExportSnapshotEnvelope({
        mode: 'user_archive',
        taskKind: 'deliverable',
        lifecyclePhase,
        executionStatus,
        completionState: 'complete',
      }),
      messages: [
        {
          id: 'a1',
          sessionId: 'session-nonterminal',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '阶段成果',
          verifiedDeliverablePaths: ['artifacts/task-x/report.html'],
          expectedManifest: [
            { id: 'slot_html', label: '报告', kind: 'html', path: 'artifacts/task-x/report.html' },
          ],
        },
      ],
      labels,
    });

    expect(html).toContain('进行中快照');
    expect(html).toContain('非终态');
    expect(html).not.toContain('成果清单（会话结束态');
  });

  it.each([
    {
      lifecyclePhase: 'turn_streaming' as const,
      executionStatus: 'running' as const,
    },
    {
      lifecyclePhase: 'turn_queued' as const,
      executionStatus: 'queued' as const,
    },
    {
      lifecyclePhase: 'deliverable_repair_pending' as const,
      executionStatus: 'idle' as const,
    },
  ])('keeps $lifecyclePhase semantics nonterminal when snapshot v2 serialization is off', ({
    lifecyclePhase,
    executionStatus,
  }) => {
    const semanticSnapshotEnvelope = buildExportSnapshotEnvelope({
      mode: 'user_archive',
      taskKind: 'deliverable',
      lifecyclePhase,
      executionStatus,
      completionState: 'complete',
    });
    const input = {
      title: '关闭 v2 的非终态成果',
      projectName: 'general',
      sessionId: 'session-v2-off',
      semanticSnapshotEnvelope,
      messages: [
        {
          id: 'a1',
          sessionId: 'session-v2-off',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '阶段成果',
          verifiedDeliverablePaths: ['artifacts/task-x/report.html'],
          expectedManifest: [
            { id: 'slot_html', label: '报告', kind: 'html', path: 'artifacts/task-x/report.html' },
          ],
        },
      ],
      labels,
    } as Parameters<typeof buildSessionExportHtml>[0] & {
      semanticSnapshotEnvelope: ReturnType<typeof buildExportSnapshotEnvelope>;
    };

    const html = buildSessionExportHtml(input);
    expect(html).toContain('成果清单（进行中快照 · 非终态');
    expect(html).not.toContain('成果清单（会话结束态');
    expect(html).not.toContain('data-testid="export-snapshot-banner"');
    expect(html).not.toContain('&quot;snapshotVersion&quot;: 2');
  });

  it('uses the ending-state deliverable heading only for a terminal envelope', () => {
    const html = buildSessionExportHtml({
      title: '终态成果',
      projectName: 'general',
      sessionId: 'session-terminal',
      exportMode: 'user_archive',
      snapshotEnvelope: buildExportSnapshotEnvelope({
        mode: 'user_archive',
        taskKind: 'deliverable',
        lifecyclePhase: 'idle',
        executionStatus: 'completed',
        completionState: 'complete',
      }),
      messages: [
        {
          id: 'a1',
          sessionId: 'session-terminal',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '全部完成',
          verifiedDeliverablePaths: ['artifacts/task-x/report.html'],
          expectedManifest: [
            { id: 'slot_html', label: '报告', kind: 'html', path: 'artifacts/task-x/report.html' },
          ],
        },
      ],
      labels,
    });

    expect(html).toContain('终态快照');
    expect(html).toContain('成果清单（终态成果清单');
    expect(html).not.toContain('进行中快照');
  });

  it('keeps terminal heading semantics without serializing a disabled v2 envelope', () => {
    const semanticSnapshotEnvelope = buildExportSnapshotEnvelope({
      mode: 'user_archive',
      taskKind: 'deliverable',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      completionState: 'complete',
    });
    const input = {
      title: '关闭 v2 的终态成果',
      projectName: 'general',
      sessionId: 'session-v2-off-terminal',
      semanticSnapshotEnvelope,
      messages: [
        {
          id: 'a1',
          sessionId: 'session-v2-off-terminal',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: '全部完成',
          verifiedDeliverablePaths: ['artifacts/task-x/report.html'],
          expectedManifest: [
            { id: 'slot_html', label: '报告', kind: 'html', path: 'artifacts/task-x/report.html' },
          ],
        },
      ],
      labels,
    } as Parameters<typeof buildSessionExportHtml>[0] & {
      semanticSnapshotEnvelope: ReturnType<typeof buildExportSnapshotEnvelope>;
    };

    const html = buildSessionExportHtml(input);
    expect(html).toContain('成果清单（终态成果清单');
    expect(html).not.toContain('data-testid="export-snapshot-banner"');
    expect(html).not.toContain('&quot;snapshotVersion&quot;: 2');
  });

  it('scrubs local roots, tenant and user ids, local APIs, and secrets from user archives', () => {
    const html = buildSessionExportHtml({
      title: '脱敏归档',
      projectName: 'general',
      sessionId: 'session-redaction',
      exportMode: 'user_archive',
      snapshotEnvelope: buildExportSnapshotEnvelope({
        mode: 'user_archive',
        taskKind: 'chat',
      }),
      messages: [
        {
          id: 'u1',
          sessionId: 'session-redaction',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: [
            String.raw`C:\nova\data\tenants\tenant-x\users\user-y\workspaces\ws-1\artifacts\task-x\report.html`,
            String.raw`C:\Nova Data\saas\tenants\tenant-x\users\user-y\artifacts\task-x\report.html`,
            'C:/Nova Data/saas/tenants/tenant-x/users/user-y/artifacts/task-x/report.html',
            String.raw`\\fileserver\private-share\users\user-y\notes.txt`,
            '//fileserver/private-share/users/user-y/notes.txt',
            '/data/saas/tenants/tenant-x/users/user-y/workspaces/ws-1/artifacts/task-x/report.html',
            '/srv/nova-root/tenants/tenant-x/users/user-y/artifacts/task-x/report.html',
            '/tmp/nova-export/private/session.json',
            '/custom-mounted-root/private/session.json',
            '{"cachePath":"/custom-json-root/private/session.json"}',
            'http://localhost:3001/api/projects/tenant-x/files/content?path=artifacts/task-x/report.html',
            'http://127.0.0.1:3001/api/projects/user-y/file/resolve',
            'http://[::1]:3001/api/projects/user-y/file/resolve',
            '/api/projects/tenant-x/files/content?path=private.txt',
            'C%3A%5CUsers%5Crufen%5Cprivate%5Csession.json',
            '%5C%5Cfileserver%5Cprivate-share%5Csession.json',
            '%2Ftmp%2Fnova-export%2Fsession.json',
            '%2Fhome%2Frufen%2F.nova%2Fsession.json',
            '%2FUsers%2Frufen%2FLibrary%2FNova%2Fsession.json',
            '%2Fdata%2Fsaas%2Ftenants%2Ftenant-x%2Fsession.json',
            'file:///home/rufen/.nova/private-session.json',
            'file%3A%2F%2F%2FC%3A%2FUsers%2Frufen%2Fprivate-session.json',
            'http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fprojects%2Ftenant-x',
            '%2Fapi%2Fprojects%2Ftenant-x%2Ffiles',
            '外部参考 https://example.com/docs/report.html',
            'Authorization: Bearer bearer-secret-value',
            'apiKey=sk-secret-value',
            'token=token-secret-value',
            '相对成果 artifacts/task-x/report.html',
            '编码相对成果 artifacts%2Ftask-x%2Fencoded-report.html',
            'basename 链接 artifacts/task-x/user-report.html',
          ].join('\n'),
        },
      ],
      labels,
    });

    expect(html).not.toContain('tenant-x');
    expect(html).not.toContain('user-y');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
    expect(html).not.toContain('[::1]');
    expect(html).toContain('https://example.com/docs/report.html');
    expect(html).not.toContain('bearer-secret-value');
    expect(html).not.toContain('sk-secret-value');
    expect(html).not.toContain('token-secret-value');
    expect(html).not.toContain(String.raw`C:\nova\data`);
    expect(html).not.toContain(String.raw`Data\saas`);
    expect(html).not.toContain('C:/Nova Data');
    expect(html).not.toContain('fileserver');
    expect(html).not.toContain('private-share');
    expect(html).not.toContain('/data/saas/tenants/');
    expect(html).not.toContain('/srv/nova-root');
    expect(html).not.toContain('/tmp/nova-export');
    expect(html).not.toContain('/custom-mounted-root');
    expect(html).not.toContain('/custom-json-root');
    expect(html).not.toContain('%5CUsers%5C');
    expect(html).not.toContain('%5C%5Cfileserver');
    expect(html).not.toContain('%2Ftmp%2F');
    expect(html).not.toContain('%2Fhome%2F');
    expect(html).not.toContain('%2FUsers%2F');
    expect(html).not.toContain('%2Fdata%2Fsaas');
    expect(html).not.toContain('file:///home/');
    expect(html).not.toContain('file://');
    expect(html).not.toContain('file%3A%2F%2F%2F');
    expect(html).not.toContain('file%3A');
    expect(html).not.toContain('%2Fapi%2Fprojects');
    expect(html).not.toContain('/api/projects/');
    expect(html).toContain('artifacts/task-x/report.html');
    expect(html).toContain('artifacts%2Ftask-x%2Fencoded-report.html');
    expect(html).toContain('artifacts/task-x/user-report.html');
  });

  it('scrubs diagnostic secrets while preserving relative diagnostic fields', () => {
    const html = buildSessionExportHtml({
      title: '脱敏诊断',
      projectName: 'general',
      sessionId: 'session-diagnostic-redaction',
      exportMode: 'diagnostic',
      diskSnapshot: [
        {
          path: 'artifacts/task-x/report.html',
          basename: 'report.html',
          inContract: true,
          slotId: 'slot_html',
        },
      ],
      messages: [
        {
          id: 'a1',
          sessionId: 'session-diagnostic-redaction',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'assistant',
          content: [
            'Authorization: Bearer diagnostic-bearer-secret',
            'apiKey=diagnostic-api-secret',
            'password: diagnostic-password-secret with-trailing-secret-phrase',
            'passwd=diagnostic-passwd-secret',
            'pwd: diagnostic-pwd-secret',
            'AWS_SECRET_ACCESS_KEY=diagnostic-aws-secret',
            'SECRET_KEY: diagnostic-secret-key',
            'PRIVATE_KEY="diagnostic-private-key"',
            '{"access_token":"diagnostic-access-token","refresh_token":"diagnostic-refresh-token"}',
            'https://example.test/callback?access_token=diagnostic-query-token&safe=1',
            '-----BEGIN ' + 'PRIVATE KEY-----\ndiagnostic-pem-body\n-----END PRIVATE KEY-----',
            'A strong password policy is useful for ordinary prose.',
          ].join('\n'),
          sessionTaskDirectory: {
            taskArtifactDir: 'artifacts/task-x',
            taskDirKey: 'task-x',
            goalVersion: 3,
          },
          verifiedDeliverablePaths: ['artifacts/task-x/report.html'],
        } as NormalizedMessage,
      ],
      labels,
    });

    expect(html).not.toContain('diagnostic-bearer-secret');
    expect(html).not.toContain('diagnostic-api-secret');
    expect(html).not.toContain('diagnostic-password-secret');
    expect(html).not.toContain('with-trailing-secret-phrase');
    expect(html).not.toContain('diagnostic-passwd-secret');
    expect(html).not.toContain('diagnostic-pwd-secret');
    expect(html).not.toContain('diagnostic-aws-secret');
    expect(html).not.toContain('diagnostic-secret-key');
    expect(html).not.toContain('diagnostic-private-key');
    expect(html).not.toContain('diagnostic-access-token');
    expect(html).not.toContain('diagnostic-refresh-token');
    expect(html).not.toContain('diagnostic-query-token');
    expect(html).not.toContain('diagnostic-pem-body');
    expect(html).toContain('A strong password policy is useful for ordinary prose.');
    expect(html).toContain('artifacts/task-x/report.html');
    expect(html).toContain('taskArtifactDir');
    expect(html).toContain('scopeDir');
  });

  it('scrubs broad secret families, credentials, cookies, JWTs, and encoded assignments', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature-secret-value';
    const secretValues = [
      'sk-openai-sensitive',
      'sk-anthropic-sensitive',
      'custom-api-sensitive',
      'webhook-secret-sensitive',
      'deploy-token-sensitive',
      'oauth-client-sensitive',
      'db-user',
      'db-password-sensitive',
      'redis-user',
      'redis-password-sensitive',
      'loose-user',
      'loose-password-sensitive',
      'session-cookie-sensitive',
      'set-cookie-sensitive',
      'connect-session-sensitive',
      'session-id-cookie-sensitive',
      'encoded-openai-sensitive',
      'encoded-client-sensitive',
      'encoded-auth-sensitive',
      'signature-secret-value',
      jwt,
    ];
    const html = buildSessionExportHtml({
      title: 'Secret families',
      projectName: 'general',
      sessionId: 'session-secret-families',
      exportMode: 'diagnostic',
      messages: [
        {
          id: 'tool-secret',
          sessionId: 'session-secret-families',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'inspect_env',
          toolResult: {
            content: [
              'OPENAI_API_KEY=sk-openai-sensitive',
              'ANTHROPIC_API_KEY: "sk-anthropic-sensitive"',
              '{"CUSTOM_PROVIDER_API_KEY":"custom-api-sensitive"}',
              'WEBHOOK_SECRET: webhook-secret-sensitive',
              'DEPLOY_TOKEN=deploy-token-sensitive',
              'client_secret: oauth-client-sensitive',
              'DATABASE_URL=postgresql://db-user:db-password-sensitive@db.internal/app',
              'REDIS_URL: redis://redis-user:redis-password-sensitive@redis.internal:6379/0',
              'postgresql://loose-user:loose-password-sensitive@db.internal/loose',
              'Cookie: session=session-cookie-sensitive; theme=dark',
              'Set-Cookie: connect.sid=set-cookie-sensitive; HttpOnly; Secure',
              'connect.sid=connect-session-sensitive',
              'session_id=session-id-cookie-sensitive',
              `JWT ${jwt}`,
              'https://example.test/callback?CUSTOM_TOKEN=query-token-sensitive&safe=1',
              'OPENAI_API_KEY%3Dencoded-openai-sensitive%26safe%3D1',
              '%22client_secret%22%3A%22encoded-client-sensitive%22',
              'Authorization%3A%20Bearer%20encoded-auth-sensitive',
              'The database URL format is documented in ordinary prose.',
              'Cookie recipes are ordinary prose and contain no assignment.',
            ].join('\n'),
            isError: false,
          },
        },
      ],
      labels,
    });

    for (const secret of [...secretValues, 'query-token-sensitive']) {
      expect(html).not.toContain(secret);
    }
    expect(html).toContain('[redacted]');
    expect(html).toContain('The database URL format is documented in ordinary prose.');
    expect(html).toContain('Cookie recipes are ordinary prose and contain no assignment.');
  });

  it.each(['user_archive', 'diagnostic'] as const)(
    'scrubs high-confidence naked token fingerprints and password-only connection urls in %s',
    (exportMode) => {
      const nakedTokens = [
        'token_github_classic_example',
        'github_' + 'pat_11AA22BB33CC44DD55EE66FF77GG88HH99II',
        'xox' + 'b-123456789012-123456789012-abcdefghijklmnopqrstuvwx',
        'xox' + 'p-123456789012-123456789012-abcdefghijklmnopqrstuvwx',
        'sk-0123456789abcdefghijklmnopqrstuv',
        'sk-proj-0123456789abcdefghijklmnopqrstuvwxyzABCD',
        'sk-ant-api03-0123456789abcdefghijklmnopqrstuvwxyz',
        'hf_0123456789abcdefghijklmnopqrstuvwxyzABCD',
      ];
      const html = buildSessionExportHtml({
        title: 'Naked token fingerprints',
        projectName: 'general',
        sessionId: `session-naked-${exportMode}`,
        exportMode,
        messages: [
          {
            id: 'u-naked',
            sessionId: `session-naked-${exportMode}`,
            timestamp: '2026-01-01T00:00:00.000Z',
            provider: 'pilotdeck',
            kind: 'text',
            role: 'user',
            content: [
              ...nakedTokens,
              'redis://:password-only-sensitive@cache.internal:6379/0',
              '普通文字保留 sk-short、token_github_classic_example 和 xoxb-prefix。',
            ].join('\n'),
          },
        ],
        labels,
      });

      for (const token of nakedTokens) expect(html).not.toContain(token);
      expect(html).not.toContain('password-only-sensitive');
      expect(html).toContain('[redacted]');
      expect(html).toContain('sk-short');
      expect(html).toContain('token_github_classic_example');
      expect(html).toContain('xoxb-prefix');
    },
  );

  it('uses the P0 export budgets and emits an explicit sanitized truncation summary', () => {
    expect(USER_ARCHIVE_EXPORT_MAX_BYTES).toBeGreaterThanOrEqual(20 * 1024 * 1024);
    expect(USER_ARCHIVE_EXPORT_MAX_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024);
    expect(DIAGNOSTIC_EXPORT_MAX_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024);

    const html = finalizeSessionExportHtml({
      html: `<html><body>Authorization: Bearer summary-secret data:image/png;base64,${'A'.repeat(2048)}</body></html>`,
      mode: 'user_archive',
      maxBytes: 512,
      title: '超限归档',
      projectName: 'general',
      sessionId: 'session-large',
      messageCount: 1,
      snapshotEnvelope: buildExportSnapshotEnvelope({
        mode: 'user_archive',
        taskKind: 'chat',
      }),
    });

    expect(html).toContain('truncated=true');
    expect(html).toContain('data-truncated="true"');
    expect(html).not.toContain('summary-secret');
    expect(html).not.toContain('data:image/png;base64');
    expect(html.length).toBeLessThan(2048);

    const expandedByRedaction = finalizeSessionExportHtml({
      html: 'token=x',
      mode: 'diagnostic',
      maxBytes: 10,
      title: '脱敏后超限',
      projectName: 'general',
      sessionId: 'session-redaction-expansion',
      messageCount: 1,
    });
    expect(expandedByRedaction).toContain('truncated=true');
  });

  it('removes short and line-wrapped base64 payloads from messages and tool results', () => {
    const html = buildSessionExportHtml({
      title: 'Base64 脱敏',
      projectName: 'general',
      sessionId: 'session-base64',
      messages: [
        {
          id: 'u1',
          sessionId: 'session-base64',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: 'short=data:image/png;base64,QQ==',
          images: ['data:image/png;base64,WA=='],
        },
        {
          id: 'tool-1',
          sessionId: 'session-base64',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_file',
          toolResult: {
            content: 'wrapped=data:application/octet-stream;base64,QUJD\nREVG',
            isError: false,
          },
        },
      ],
      labels,
    });

    expect(html).not.toContain('data:image/png;base64');
    expect(html).not.toContain('data:application/octet-stream;base64');
    expect(html).not.toContain('QQ==');
    expect(html).not.toContain('WA==');
    expect(html).not.toContain('QUJD');
    expect(html).not.toContain('REVG');
    expect(html).toContain('embedded-data-redacted');
  });

  it('removes bare short and folded base64 only from tool payload contexts', () => {
    const html = buildSessionExportHtml({
      title: 'Contextual Base64',
      projectName: 'general',
      sessionId: 'session-contextual-base64',
      messages: [
        {
          id: 'u1',
          sessionId: 'session-contextual-base64',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '普通自然语言保留示例 QUJD 与 REVG，不应按 Base64 误删。',
        },
        {
          id: 'tool-short',
          sessionId: 'session-contextual-base64',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_binary',
          toolResult: {
            content: 'QUJD',
            isError: false,
            toolUseResult: {
              attachmentBody: 'SGVsbG8=',
            },
          },
        },
        {
          id: 'tool-folded',
          sessionId: 'session-contextual-base64',
          timestamp: '2026-01-01T00:00:02.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_binary',
          toolResult: {
            content: 'QUJD\nREVG',
            isError: false,
          },
        },
        {
          id: 'tool-input',
          sessionId: 'session-contextual-base64',
          timestamp: '2026-01-01T00:00:03.000Z',
          provider: 'pilotdeck',
          kind: 'tool_use',
          toolName: 'upload_attachment',
          toolInput: {
            attachmentBody: 'V29ybGQ=',
          },
        },
      ],
      labels,
    });

    expect(html.match(/QUJD/g)).toHaveLength(1);
    expect(html.match(/REVG/g)).toHaveLength(1);
    expect(html).not.toContain('SGVsbG8=');
    expect(html).not.toContain('V29ybGQ=');
    expect(html).toContain('base64-redacted');
    expect(html).toContain('普通自然语言保留示例');
  });

  it('routes tool result image data and folded labeled base64 through tool sanitization', () => {
    const html = buildSessionExportHtml({
      title: 'Tool payload routing',
      projectName: 'general',
      sessionId: 'session-tool-payload-routing',
      exportMode: 'diagnostic',
      messages: [
        {
          id: 'u-tool-payload',
          sessionId: 'session-tool-payload-routing',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'text',
          role: 'user',
          content: '普通用户正文保留 SGVsbG8=，也保留示例 base64=QU\nJD。',
        },
        {
          id: 'tool-payload',
          sessionId: 'session-tool-payload-routing',
          timestamp: '2026-01-01T00:00:01.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_binary',
          toolResult: {
            content: 'base64=QU\nJD',
            isError: false,
          },
          toolResultImages: [{
            data: 'SGVsbG8=',
            name: 'tool-preview.png',
          }],
        },
      ],
      labels,
    });

    expect(html.match(/SGVsbG8=/g)).toHaveLength(1);
    expect(html.match(/base64=QU/g)).toHaveLength(1);
    expect(html).toContain('普通用户正文保留');
    expect(html).toContain('base64-redacted');
    expect(html).not.toContain('src="SGVsbG8="');
  });

  it('stops backward pagination at the message budget and preserves chronological order', async () => {
    const message = (id: string, content: string): NormalizedMessage => ({
      id,
      sessionId: 'session-pagination-budget',
      timestamp: `2026-01-01T00:00:0${id.slice(1)}.000Z`,
      provider: 'pilotdeck',
      kind: 'text',
      role: 'assistant',
      content,
    });
    authenticatedFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [message('m3', 'newest-3'), message('m4', 'newest-4')],
          total: 4,
          offset: 2,
          nextCursor: '2',
          latestTurnAcceptanceMeta: {
            acceptanceStatus: 'needs_repair',
            goalVersion: 2,
          },
          sessionDeliverableManifest: {
            manifestVersion: 1,
            goalVersion: 2,
            sessionGoalAnchor: '交付报告',
            slots: [{
              id: 'report',
              label: '报告',
              pathHint: 'report.md',
              required: true,
              status: 'active',
            }],
          },
          sessionTaskDirectory: {
            taskArtifactDir: 'artifacts/task-export-envelope',
            taskDirKey: 'task-export-envelope',
            goalVersion: 2,
            allocatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [
            message('m1', 'oversized-oldest|'.repeat(180)),
            message('m2', 'older-2'),
          ],
          total: 4,
          offset: 0,
          nextCursor: '1',
        }),
      })
      .mockRejectedValueOnce(new Error('must not request another page'));

    const result = await fetchAllSessionMessagesForExport({
      sessionId: 'session-pagination-budget',
      projectName: 'general',
      mode: 'user_archive',
      maxExportBytes: 1600,
    });

    expect(authenticatedFetchMock).toHaveBeenCalledTimes(2);
    expect(result.messages.map((item) => item.id)).toEqual(['m2', 'm3', 'm4']);
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toBe('message_budget');
    expect(result.estimatedBytes).toBeLessThan(1600);
    expect(result.transcriptCursor).toBe('1');
    expect(result.sourceOffset).toBe(0);
    expect(result.latestTurnAcceptanceMeta).toMatchObject({
      acceptanceStatus: 'needs_repair',
      goalVersion: 2,
    });
    expect(result.sessionDeliverableManifest).toMatchObject({
      goalVersion: 2,
    });
    expect(result.sessionTaskDirectory).toMatchObject({
      taskArtifactDir: 'artifacts/task-export-envelope',
      goalVersion: 2,
    });

    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'chat',
      mode: 'user_archive',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      truncated: result.truncated,
      truncationReason: result.truncationReason,
      transcriptCursor: result.transcriptCursor,
      sourceOffset: result.sourceOffset,
    });
    const html = buildSessionExportHtml({
      title: 'Bounded pages',
      projectName: 'general',
      sessionId: 'session-pagination-budget',
      messages: result.messages,
      labels,
      snapshotEnvelope: envelope,
      sourceTruncated: result.truncated,
      sourceTruncationReason: result.truncationReason,
    });

    expect(envelope.truncated).toBe(true);
    expect(envelope.truncationReason).toBe('message_budget');
    expect(envelope.transcriptCursor).toBe('1');
    expect(envelope.sourceOffset).toBe(0);
    expect(html).toContain('data-truncated="true"');
    expect(html).toContain('truncated=true');
    expect(html.indexOf('older-2')).toBeLessThan(html.indexOf('newest-3'));
    expect(html.indexOf('newest-3')).toBeLessThan(html.indexOf('newest-4'));
    expect(html).not.toContain('oversized-oldest');
  });

  it('short-circuits oversized message input before raw html assembly', () => {
    const input = {
      title: '输入预算',
      projectName: 'general',
      sessionId: 'session-input-budget',
      maxExportBytes: 1024,
      messages: [
        {
          id: 'tool-large',
          sessionId: 'session-input-budget',
          timestamp: '2026-01-01T00:00:00.000Z',
          provider: 'pilotdeck',
          kind: 'tool_result',
          toolName: 'read_file',
          toolResult: {
            content: 'oversized-input-marker|'.repeat(200),
            isError: false,
          },
        },
      ],
      labels,
    } as Parameters<typeof buildSessionExportHtml>[0] & { maxExportBytes: number };

    const html = buildSessionExportHtml(input);
    expect(html).toContain('truncated=true');
    expect(html).toContain('input_budget');
    expect(html).not.toContain('oversized-input-marker');
  });
});
