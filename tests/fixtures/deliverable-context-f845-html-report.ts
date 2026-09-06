/**
 * PD-SAAS-FORK: f845-class duplicate basename + progress contradiction fixture (anonymous).
 */
import type { ChatMessage } from '../../ui/src/components/chat/types/types';

export const F845_HTML_REPORT_GOAL = '写一份 VS Code HTML 竞品分析报告，须交付 index.html';

export const F845_SESSION_MANIFEST = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: F845_HTML_REPORT_GOAL,
  profileId: 'html-report',
  slots: [
    {
      id: 'slot_html',
      label: 'HTML 网页',
      kind: 'html',
      pathHint: 'index.html',
      pathHints: ['index.html'],
      status: 'done' as const,
    },
  ],
};

export function buildF845FixtureMessages(): ChatMessage[] {
  const user: ChatMessage = {
    id: 'u-f845',
    type: 'user',
    role: 'user',
    content: F845_HTML_REPORT_GOAL,
  };
  const assistant: ChatMessage = {
    id: 'a-f845',
    type: 'assistant',
    role: 'assistant',
    content: '报告已完成，见 `artifacts/task-f845/index.html`。',
    turnArtifactDir: 'artifacts/task-f845',
    sessionDeliverableManifest: F845_SESSION_MANIFEST,
    turnAcceptanceMeta: {
      acceptanceStatus: 'passed',
      verifiedPaths: ['artifacts/task-f845/index.html'],
      completionState: 'complete',
      slotBindings: [{
        slotId: 'slot_html',
        resolvedPath: 'artifacts/task-f845/index.html',
        status: 'delivered',
      }],
    },
  };
  return [user, assistant];
}

/** Rows that mimic the pre-fix contradiction: delivered index + checking HTML label. */
export const F845_CONTRADICTORY_ROWS = [
  {
    id: 'slot_html',
    label: 'index',
    path: 'artifacts/task-f845/index.html',
    resolvedPath: 'artifacts/task-f845/index.html',
    status: 'delivered' as const,
    previewable: true,
    linkable: true,
  },
  {
    id: 'slot_html_dup',
    label: 'HTML 网页',
    path: 'index.html',
    status: 'checking' as const,
    previewable: false,
    linkable: false,
  },
];
