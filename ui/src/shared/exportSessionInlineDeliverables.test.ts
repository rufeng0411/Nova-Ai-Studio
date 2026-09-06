import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '../stores/useSessionStore';
import {
  buildExportInlineDeliverableRows,
  chatMessagesFromNormalized,
  groupExportConversationTurns,
  renderExportInlineDeliverableTableHtml,
  renderExportTurnPointerHtml,
  renderExportUiSummaryLinkCell,
  exportUiStatusLabel,
  turnMessagesForAssistant,
} from './exportSessionInlineDeliverables';
import { classifyDeliverablePath } from './artifactPaths';
import { buildUnifiedDeliverableView } from './buildUnifiedDeliverableView';
import { buildSessionExportHtml, type SessionExportLabels } from './exportSessionHtml';

const exportLabels: SessionExportLabels = {
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
  qualityStatus: 'Quality status',
  qualityComplete: 'Quality accepted',
  qualityOfficialMediaDegraded: 'Partial results accepted · Official media degraded',
  qualityUserAcknowledged: 'Accepted with your confirmation',
  qualityBlocked: 'Quality acceptance blocked',
  qualityNeedsRepair: 'Quality needs improvement',
  qualityNotApplicable: 'Quality check not applicable',
};

describe('exportSessionInlineDeliverables', () => {
  it('groups turns and folds process messages', () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'u1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'user',
        content: '做审计报告和 PDF',
      },
      {
        id: 't1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:01.000Z',
        provider: 'pilotdeck',
        kind: 'thinking',
        content: '思考中',
      },
      {
        id: 'a1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:02.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'assistant',
        content: '已完成 md',
      },
    ];

    const turns = groupExportConversationTurns(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.processMessages).toHaveLength(1);
    expect(turns[0]?.finalAssistant?.id).toBe('a1');
  });

  it('renders ui-like deliverable table html without injected api urls', () => {
    const html = renderExportInlineDeliverableTableHtml([
      {
        id: 'slot_md',
        label: '审计报告',
        typeLabel: 'Markdown',
        statusLabel: exportUiStatusLabel('delivered'),
        path: 'artifacts/report.md',
        kind: classifyDeliverablePath('artifacts/report.md'),
        apiPath: 'artifacts/report.md',
        status: 'delivered',
      },
      {
        id: 'slot_pdf',
        label: '审计报告',
        typeLabel: 'PDF',
        statusLabel: exportUiStatusLabel('missing'),
        path: 'artifacts/report.pdf',
        kind: classifyDeliverablePath('artifacts/report.pdf'),
        apiPath: 'artifacts/report.pdf',
        status: 'missing',
      },
    ]);
    expect(html).toContain('inline-deliverable-summary');
    expect(html).toContain('成果清单');
    expect(html).toContain('文件链接');
    expect(html).toContain('未完成');
    expect(html).toContain('已完成');
    expect(html).toContain('report.md');
    expect(html).not.toContain('/api/projects/');
    expect(html).not.toContain('access-links');
  });

  it('renders project file link as basename text without href', () => {
    const cell = renderExportUiSummaryLinkCell(
      'artifacts/report.md',
      classifyDeliverablePath('artifacts/report.md'),
      'delivered',
    );
    expect(cell).toContain('export-file-link');
    expect(cell).toContain('report.md');
    expect(cell).not.toContain('href=');
  });

  it('renders external url as anchor when present', () => {
    const cell = renderExportUiSummaryLinkCell(
      'https://example.com/file.pdf',
      classifyDeliverablePath('https://example.com/file.pdf'),
      'delivered',
    );
    expect(cell).toContain('href="https://example.com/file.pdf"');
  });

  it('reuses one unified view for inline rows and the HTML export', () => {
    const scopeDir = 'artifacts/task-export-unified';
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: '交付报告',
      compiledAtTurnId: 'a1',
      taskArtifactDir: scopeDir,
      slots: [{
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
        required: true,
        status: 'active' as const,
      }],
    };
    const normalized: NormalizedMessage[] = [
      {
        id: 'u1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'user',
        content: '请交付报告',
      },
      {
        id: 'm1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:30.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'assistant',
        content: '',
        sessionDeliverableManifest: manifest,
      },
      {
        id: 'a1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:01:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'assistant',
        content: '报告已完成。',
        verifiedDeliverablePaths: [`${scopeDir}/report.md`],
        turnAcceptanceMeta: {
          verifiedPaths: [`${scopeDir}/report.md`],
          acceptanceStatus: 'passed',
        },
      },
    ];
    const chatMessages = chatMessagesFromNormalized(normalized);
    const unifiedView = buildUnifiedDeliverableView({
      messages: chatMessages,
      projectRoot: '/project',
      sessionManifest: manifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [`${scopeDir}/report.md`],
    });
    const assistantMessage = chatMessages[chatMessages.length - 1]!;
    const inlineRows = buildExportInlineDeliverableRows({
      message: assistantMessage,
      turnMessages: turnMessagesForAssistant(chatMessages, assistantMessage),
      sessionMessages: chatMessages,
      projectName: 'general',
      isLatestAssistantInSession: true,
      unifiedView,
      scopeDir,
    });

    expect(inlineRows.map(({ id, path, status }) => ({ id, path, status }))).toEqual(
      unifiedView.rows.map((row) => ({
        id: row.id,
        path: row.resolvedPath || row.path,
        status: row.status,
      })),
    );

    const uniqueLabel = '来自统一视图的唯一标签';
    const prebuiltUnifiedView = {
      ...unifiedView,
      rows: unifiedView.rows.map((row) => ({ ...row, label: uniqueLabel })),
      summaryRows: unifiedView.summaryRows.map((row) => ({ ...row, label: uniqueLabel })),
      contractHash: 'prebuilt-contract-hash',
      progress: { ...unifiedView.progress, done: 7, total: 9 },
      qualityStatus: {
        completionState: 'accepted_partial' as const,
        partialReason: 'official_media_degraded' as const,
        qualityCompletion: 'degraded_acceptable' as const,
      },
    };
    const html = buildSessionExportHtml({
      title: '统一成果导出',
      projectName: 'general',
      sessionId: 's1',
      messages: normalized,
      labels: exportLabels,
      prebuiltUnifiedView,
    });

    expect(html).toContain(uniqueLabel);
    expect(html).toContain('prebuilt-contract-hash');
    expect(html).toContain('data-progress-done="1"');
    expect(html).toContain('data-progress-total="1"');
  });

  it('does not rebuild latest inline rows when the unified view is empty', () => {
    const normalized: NormalizedMessage[] = [
      {
        id: 'u1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'user',
        content: '请交付报告',
      },
      {
        id: 'a1',
        sessionId: 's1',
        timestamp: '2026-01-01T00:01:00.000Z',
        provider: 'pilotdeck',
        kind: 'text',
        role: 'assistant',
        content: '见 `artifacts/task-empty/report.md`',
      },
    ];
    const chatMessages = chatMessagesFromNormalized(normalized);
    const assistantMessage = chatMessages[1]!;

    const rows = buildExportInlineDeliverableRows({
      message: assistantMessage,
      turnMessages: turnMessagesForAssistant(chatMessages, assistantMessage),
      sessionMessages: chatMessages,
      projectName: 'general',
      isLatestAssistantInSession: true,
      unifiedView: {
        rows: [],
        summaryRows: [],
        progress: { done: 0, total: 0 },
        contractHash: 'empty-contract',
        folderPath: null,
        folderItems: [],
        scopeDir: null,
        totalSlots: 0,
        expectedManifest: [],
      },
    });

    expect(rows).toEqual([]);
  });

  it('turn pointer export markup references session summary', () => {
    const html = renderExportTurnPointerHtml({ done: 2, total: 4 });
    expect(html).toContain('export-turn-pointer');
    expect(html).toContain('2/4');
    expect(html).toContain('查看会话成果清单');
  });
});
