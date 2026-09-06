// @vitest-environment jsdom
/**
 * PD-SAAS-FORK: deep acceptance — deliverable summary table DOM position (5 real scenarios).
 */
import React from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../chat/types/types';
import MessageRowV2 from './MessageRowV2';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DeliverableValidationSessionProvider } from '../../shared/DeliverableValidationSessionContext';
import { selectLatestDeliverableSummaryTurn } from '../../shared/selectLatestDeliverableSummaryTurn';

vi.mock('../chat/deliverables/DeliverablePreviewOverlay', () => ({
  default: () => null,
}));

vi.mock('../../shared/validateDeliverables', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../shared/validateDeliverables')>();
  return {
    ...mod,
    validateDeliverablesClient: vi.fn(async (_projectName, items) =>
      items.map((item) => ({
        ...item,
        validationStatus: 'verified' as const,
        resolvedPath: item.resolvedPath || item.apiPath || item.path,
      }))),
  };
});

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  cleanup();
});

const PROJECT = {
  name: 'general',
  displayName: 'general',
  fullPath: '/workspace/general',
  path: 'general',
};

type RenderRowOptions = {
  message: ChatMessage;
  prevMessage?: ChatMessage | null;
  nextMessage?: ChatMessage | null;
  turnMessages?: ChatMessage[];
  sessionMessages: ChatMessage[];
  isLatestAssistantInSession?: boolean;
  sessionRepairActive?: boolean;
};

function resolveTurnMessages(
  message: ChatMessage,
  sessionMessages: ChatMessage[],
  turnMessages?: ChatMessage[],
): ChatMessage[] {
  if (turnMessages) return turnMessages;
  const assistantIndex = sessionMessages.findIndex((item) => item.id === message.id);
  if (assistantIndex < 0) return [message];
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (sessionMessages[index]?.type === 'user') {
      return sessionMessages.slice(index, assistantIndex + 1);
    }
  }
  return sessionMessages.slice(0, assistantIndex + 1);
}

function renderAssistantRow(options: RenderRowOptions) {
  const {
    message,
    prevMessage = null,
    nextMessage = null,
    turnMessages,
    sessionMessages,
    isLatestAssistantInSession = true,
    sessionRepairActive = false,
  } = options;
  const latest = selectLatestDeliverableSummaryTurn({
    messages: sessionMessages,
    projectRoot: PROJECT.fullPath,
    hasMoreMessages: false,
  });

  return renderWithProviders(
    <DeliverableValidationSessionProvider
      sessionId="web-s_acceptance"
      projectName={PROJECT.name}
      latest={latest}
      chatMessages={sessionMessages}
    >
      <MessageRowV2
        message={message}
        prevMessage={prevMessage}
        nextMessage={nextMessage}
        turnMessages={resolveTurnMessages(message, sessionMessages, turnMessages)}
        sessionMessages={sessionMessages}
        provider="pilotdeck"
        selectedProject={PROJECT}
        createDiff={() => []}
        isLatestAssistantInSession={isLatestAssistantInSession}
        sessionRepairActive={sessionRepairActive}
      />
    </DeliverableValidationSessionProvider>,
  );
}

function assertFooterAfterConclusion(conclusionText: string) {
  const conclusion = screen.getByText(conclusionText);
  const footer = screen.getByTestId('deliverable-summary-footer');
  const table = within(footer).getByTestId('deliverable-summary-table');

  expect(Boolean(
    conclusion.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
  )).toBe(true);

  const bubble = conclusion.closest('.min-w-0.text-\\[14px\\]')
    ?? conclusion.closest('.min-w-0')
    ?? conclusion.parentElement?.parentElement;
  expect(bubble).toBeTruthy();
  expect(bubble!.contains(footer)).toBe(true);
  expect(bubble!.contains(table)).toBe(true);
}

describe('交付汇总表位置深度验收（5 个实际案例）', () => {
  it('案例1 吴裕泰 GEO 全案：表在助手结论之后、footer 内，正文无重复四列表', () => {
    const now = '2026-06-28T10:00:00.000Z';
    const conclusion = 'GEO 全案六阶段已交付，审计清单与 schema 均在 artifacts/geo/吴裕泰/ 目录。';
    const user: ChatMessage = {
      id: 'u-wuyutai',
      type: 'user',
      content: '帮【吴裕泰】做品牌 GEO 全案，按阶段交付，存 artifacts/geo/吴裕泰/',
      timestamp: now,
    };
    const assistant: ChatMessage = {
      id: 'a-wuyutai',
      type: 'assistant',
      content: [
        conclusion,
        '',
        '📁 交付文件汇总',
        '| 交付物名称 | 文件类型 | 状态 | 链接 |',
        '| audit-checklist.md | Markdown | 已交付 | audit-checklist.md |',
      ].join('\n'),
      timestamp: now,
      turnArtifactDir: 'artifacts/geo/吴裕泰',
      verifiedDeliverablePaths: [
        'artifacts/geo/吴裕泰/audit-checklist.md',
        'artifacts/geo/吴裕泰/keywords.md',
        'artifacts/geo/吴裕泰/optimized.md',
        'artifacts/geo/吴裕泰/schema.jsonld',
        'artifacts/geo/吴裕泰/score-estimate.md',
      ],
      turnAcceptanceMeta: {
        expectedManifest: [
          { id: 'audit', kind: 'md', label: '审计清单', required: true },
          { id: 'keywords', kind: 'md', label: '关键词库', required: true },
          { id: 'optimized', kind: 'md', label: '优化稿', required: true },
          { id: 'schema', kind: 'jsonld', label: 'Schema', required: true },
          { id: 'score', kind: 'md', label: '引用评分', required: true },
        ],
        verifiedPaths: [
          'artifacts/geo/吴裕泰/audit-checklist.md',
          'artifacts/geo/吴裕泰/keywords.md',
          'artifacts/geo/吴裕泰/optimized.md',
          'artifacts/geo/吴裕泰/schema.jsonld',
          'artifacts/geo/吴裕泰/score-estimate.md',
        ],
        missingPaths: [],
        acceptanceStatus: 'passed',
      },
    };

    renderAssistantRow({
      message: assistant,
      prevMessage: user,
      sessionMessages: [user, assistant],
    });

    assertFooterAfterConclusion(conclusion);
    expect(screen.queryByText(/成果名称.*文件类型.*状态.*链接/)).toBeNull();
    expect(screen.getByText('成果清单')).toBeTruthy();
    expect(within(screen.getByTestId('deliverable-summary-footer')).getByText('审计清单')).toBeTruthy();
  });

  it('案例2 Nova 幻灯部分交付 2/5：表在 footer，repair 行「补齐中…」', () => {
    const now = '2026-07-02T08:00:00.000Z';
    const conclusion = '已完成 2 页美学幻灯，剩余 3 页正在补齐。';
    const turnDir = 'artifacts/slides-nova-demo-20260702';
    const user: ChatMessage = {
      id: 'u-nova',
      type: 'user',
      content: '生成 6 页 Nova 美学幻灯 PPT，并交付 PNG 文件与 manifest',
      timestamp: now,
    };
    const assistant: ChatMessage = {
      id: 'a-nova',
      type: 'assistant',
      content: conclusion,
      timestamp: now,
      turnArtifactDir: turnDir,
      turnAcceptanceMeta: {
        expectedManifest: [{ id: 'deck', kind: 'png', count: 6, required: true }],
        verifiedPaths: [`${turnDir}/slide-01.png`, `${turnDir}/slide-02.png`],
        missingPaths: [
          `${turnDir}/slide-03.png`,
          `${turnDir}/slide-04.png`,
          `${turnDir}/slide-05.png`,
          `${turnDir}/slide-06.png`,
        ],
        continuationOwner: 'deliverable_repair',
        acceptanceStatus: 'needs_repair',
      },
      verifiedDeliverablePaths: [`${turnDir}/slide-01.png`, `${turnDir}/slide-02.png`],
    };

    renderAssistantRow({
      message: assistant,
      prevMessage: user,
      sessionMessages: [user, assistant],
      sessionRepairActive: true,
    });

    assertFooterAfterConclusion(conclusion);
    const footer = screen.getByTestId('deliverable-summary-footer');
    expect(within(footer).getAllByText('补齐中…').length).toBeGreaterThanOrEqual(3);
    expect(within(footer).getByText('第 1 页')).toBeTruthy();
  });

  it('案例3 纯聊天脑爆：无汇总表 footer', () => {
    const now = '2026-07-02T09:00:00.000Z';
    const user: ChatMessage = {
      id: 'u-chat',
      type: 'user',
      content: '聊聊最近 AI 趋势，不用交付文件',
      timestamp: now,
    };
    const assistant: ChatMessage = {
      id: 'a-chat',
      type: 'assistant',
      content: '好的，我从模型迭代、Agent 工作流和产品形态三方面聊聊……',
      timestamp: now,
    };

    renderAssistantRow({
      message: assistant,
      prevMessage: user,
      sessionMessages: [user, assistant],
    });

    expect(screen.queryByTestId('deliverable-summary-footer')).toBeNull();
  });

  it('案例4 同会话两轮回合：各回合 footer 在各自结论之后', () => {
    const now = '2026-06-23T14:00:00.000Z';
    const conclusion1 = '第一版调研报告已完成，可在下方汇总表打开。';
    const conclusion2 = '已追加 HTML 互动版报告，详见下方汇总表。';
    const u1: ChatMessage = {
      id: 'u1',
      type: 'user',
      content: '用 Nova-用户研究 做吴裕泰八段式调研并交付 md',
      timestamp: now,
    };
    const a1: ChatMessage = {
      id: 'a1',
      type: 'assistant',
      content: conclusion1,
      timestamp: now,
      verifiedDeliverablePaths: ['artifacts/research/吴裕泰/综述.md'],
      turnAcceptanceMeta: {
        expectedManifest: [{ id: 'brief', kind: 'md', label: '综述', required: true }],
        verifiedPaths: ['artifacts/research/吴裕泰/综述.md'],
        missingPaths: [],
        acceptanceStatus: 'passed',
      },
      turnArtifactDir: 'artifacts/research/吴裕泰',
    };
    const u2: ChatMessage = {
      id: 'u2',
      type: 'user',
      content: '再做一个 HTML 版本报告并交付',
      timestamp: now,
    };
    const a2: ChatMessage = {
      id: 'a2',
      type: 'assistant',
      content: conclusion2,
      timestamp: now,
      verifiedDeliverablePaths: ['artifacts/research/吴裕泰/index.html'],
      turnAcceptanceMeta: {
        expectedManifest: [{ id: 'html', kind: 'html', label: '互动报告', required: true }],
        verifiedPaths: ['artifacts/research/吴裕泰/index.html'],
        missingPaths: [],
        acceptanceStatus: 'passed',
      },
      turnArtifactDir: 'artifacts/research/吴裕泰',
    };
    const session = [u1, a1, u2, a2];

    const { unmount: u1Unmount } = renderAssistantRow({
      message: a1,
      prevMessage: u1,
      nextMessage: u2,
      sessionMessages: session,
      isLatestAssistantInSession: false,
    });
    assertFooterAfterConclusion(conclusion1);
    expect(within(screen.getByTestId('deliverable-summary-footer')).getByText('综述')).toBeTruthy();
    u1Unmount();

    renderAssistantRow({
      message: a2,
      prevMessage: u2,
      sessionMessages: session,
      isLatestAssistantInSession: true,
    });
    assertFooterAfterConclusion(conclusion2);
    expect(within(screen.getByTestId('deliverable-summary-footer')).getByText('互动报告')).toBeTruthy();
  });

  it('案例5 streaming 中无 footer，回合结束后 footer 出现在结论之后', () => {
    const now = '2026-07-02T10:30:00.000Z';
    const streamingConclusion = '正在写入最后一页 slide-06.png…';
    const user: ChatMessage = {
      id: 'u-stream',
      type: 'user',
      content: '生成 6 页 Nova 美学幻灯 PPT，并交付 PNG 文件',
      timestamp: now,
    };
    const streaming: ChatMessage = {
      id: 'a-stream',
      type: 'assistant',
      content: streamingConclusion,
      timestamp: now,
      isStreaming: true,
      turnAcceptanceMeta: {
        expectedManifest: [{ id: 'deck', kind: 'png', count: 6, required: true }],
        verifiedPaths: ['artifacts/slides-x/slide-01.png'],
        missingPaths: ['artifacts/slides-x/slide-06.png'],
      },
    };

    const { unmount } = renderAssistantRow({
      message: streaming,
      prevMessage: user,
      sessionMessages: [user, streaming],
      isLatestAssistantInSession: true,
    });
    expect(screen.queryByTestId('deliverable-summary-footer')).toBeNull();
    unmount();

    const doneConclusion = '6 页幻灯已全部导出。';
    const done: ChatMessage = {
      ...streaming,
      isStreaming: false,
      content: doneConclusion,
      verifiedDeliverablePaths: [
        'artifacts/slides-x/slide-01.png',
        'artifacts/slides-x/slide-06.png',
      ],
      turnAcceptanceMeta: {
        expectedManifest: [{ id: 'deck', kind: 'png', count: 6, required: true }],
        verifiedPaths: [
          'artifacts/slides-x/slide-01.png',
          'artifacts/slides-x/slide-06.png',
        ],
        missingPaths: [],
        acceptanceStatus: 'passed',
      },
    };

    renderAssistantRow({
      message: done,
      prevMessage: user,
      sessionMessages: [user, done],
    });
    assertFooterAfterConclusion(doneConclusion);
  });
});
